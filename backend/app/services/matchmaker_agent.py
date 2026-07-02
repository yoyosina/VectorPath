from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from app.services.state import GraphState

class MatchScore(BaseModel):
    score: float = Field(description="A score from 0.0 to 100.0 indicating how well the skills match the job.")

def get_few_shot_context(state: GraphState) -> str:
    user_id = state.get("user_id")
    if not user_id:
        return ""
    
    from app.core.database import SessionLocal
    from app.models.schema import JobApplication, JobTarget
    db = SessionLocal()
    try:
        # Check applied jobs first (up to 3)
        applied = db.query(JobApplication).filter_by(user_id=user_id).order_by(JobApplication.applied_at.desc()).limit(3).all()
        examples = ""
        
        # Check high matching jobs (>=90%)
        high_matches = db.query(JobTarget).filter_by(user_id=user_id).filter(JobTarget.match_score >= 90).order_by(JobTarget.match_score.desc()).limit(3).all()
        
        # Hill-climbing optimization: if no >=90% match is found, seed search with the highest-scoring job(s) in the database
        if not high_matches:
            high_matches = db.query(JobTarget).filter_by(user_id=user_id).filter(JobTarget.match_score.isnot(None)).order_by(JobTarget.match_score.desc()).limit(3).all()
            
        if applied or high_matches:
            examples = "\n\nUser Preference Feedback (These are examples of jobs the user has applied to or scored highly, representing positive match preferences):\n"
            applied_ids = {app.job_id for app in applied if app.job_id}
            
            for idx, app in enumerate(applied):
                job_detail = db.query(JobTarget).filter_by(id=app.job_id).first()
                if job_detail:
                    matched_skills = ", ".join(job_detail.job_skill_map) if job_detail.job_skill_map else "None"
                    examples += f"- [APPLIED] Title: {job_detail.title} at {job_detail.company} (Matched Skills: {matched_skills})\n"
                else:
                    examples += f"- [APPLIED] Title: {app.title} at {app.company}\n"
                    
            for idx, job_detail in enumerate(high_matches):
                if job_detail.id in applied_ids:
                    continue
                matched_skills = ", ".join(job_detail.job_skill_map) if job_detail.job_skill_map else "None"
                examples += f"- [HIGH MATCH {job_detail.match_score}%] Title: {job_detail.title} at {job_detail.company} (Matched Skills: {matched_skills})\n"
                
        return examples
    except Exception as e:
        print("Error getting few shot context:", e)
        return ""
    finally:
        db.close()

def score_with_gemini(state: GraphState) -> GraphState:
    if not state.get("target_job_description"):
        return {"gemini_score": 0.0}
        
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0).with_structured_output(MatchScore)
    skills_str = ", ".join([f"{s.name} ({s.confidence} confidence, weight: {getattr(s, 'weight', 1.0)})" for s in state.get("final_skills", [])])
    few_shot = get_few_shot_context(state)
    prompt = f"Evaluate how well these skills:\n{skills_str}\n\nMatch this job description:\n{state['target_job_description']}\n{few_shot}\n\nProvide a score from 0 to 100 indicating how well the candidate's skills match the job requirements, strongly aligning with their applied job preferences."
    try:
        res = llm.invoke(prompt)
        return {"gemini_score": res.score}
    except Exception as e:
        return {"error": str(e), "gemini_score": 0.0}

def score_with_groq(state: GraphState) -> GraphState:
    if not state.get("target_job_description"):
        return {"groq_score": 0.0}
        
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0).with_structured_output(MatchScore)
    skills_str = ", ".join([f"{s.name} ({s.confidence} confidence, weight: {getattr(s, 'weight', 1.0)})" for s in state.get("final_skills", [])])
    few_shot = get_few_shot_context(state)
    prompt = f"Evaluate how well these skills:\n{skills_str}\n\nMatch this job description:\n{state['target_job_description']}\n{few_shot}\n\nProvide a score from 0 to 100 indicating how well the candidate's skills match the job requirements, strongly aligning with their applied job preferences."
    try:
        res = llm.invoke(prompt)
        return {"groq_score": res.score}
    except Exception as e:
        return {"error": str(e), "groq_score": 0.0}


def ensemble_scores(state: GraphState) -> GraphState:
    gemini_score = state.get("gemini_score", 0.0)
    groq_score = state.get("groq_score", 0.0)
    
    # Calculate final score: 60% Gemini / 40% Groq, with full failover if one provider is rate-limited/failed
    if gemini_score > 0 and groq_score > 0:
        final_score = (gemini_score * 0.60) + (groq_score * 0.40)
    elif gemini_score > 0:
        final_score = gemini_score
    elif groq_score > 0:
        final_score = groq_score
    else:
        final_score = 0.0
        
    return {"final_match_score": final_score, "status": "scoring_complete"}

