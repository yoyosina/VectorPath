from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from app.services.state import GraphState

class MatchScore(BaseModel):
    score: float = Field(description="A score from 0.0 to 100.0 indicating how well the skills match the job.")

def score_with_gemini(state: GraphState) -> GraphState:
    if not state.get("target_job_description"):
        return {"gemini_score": 0.0}
        
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0).with_structured_output(MatchScore)
    skills_str = ", ".join([f"{s.name} ({s.confidence} confidence)" for s in state.get("final_skills", [])])
    prompt = f"Evaluate how well these skills:\n{skills_str}\n\nMatch this job description:\n{state['target_job_description']}\n\nProvide a score from 0 to 100."
    try:
        res = llm.invoke(prompt)
        return {"gemini_score": res.score}
    except Exception as e:
        return {"error": str(e), "gemini_score": 0.0}

def score_with_groq(state: GraphState) -> GraphState:
    if not state.get("target_job_description"):
        return {"groq_score": 0.0}
        
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0).with_structured_output(MatchScore)
    skills_str = ", ".join([f"{s.name} ({s.confidence} confidence)" for s in state.get("final_skills", [])])
    prompt = f"Evaluate how well these skills:\n{skills_str}\n\nMatch this job description:\n{state['target_job_description']}\n\nProvide a score from 0 to 100."
    try:
        res = llm.invoke(prompt)
        return {"groq_score": res.score}
    except Exception as e:
        return {"error": str(e), "groq_score": 0.0}

def ensemble_scores(state: GraphState) -> GraphState:
    gemini_score = state.get("gemini_score", 0.0)
    groq_score = state.get("groq_score", 0.0)
    
    # Calculate final score: 60% weight to Gemini, 40% weight to Groq
    final_score = (gemini_score * 0.60) + (groq_score * 0.40)
    
    return {"final_match_score": final_score, "status": "scoring_complete"}
