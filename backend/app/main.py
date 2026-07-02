from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import io
from pypdf import PdfReader
from sqlalchemy.orm import Session
from app.services.graph import agent_graph
from app.services.state import GraphState
from app.core.database import get_db
from app.models import schema
from app.models.schema import User, JobTarget, DaemonStatus
from app.core.database import engine

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
import traceback

schema.Base.metadata.create_all(bind=engine)
import threading
import sys
import os
from contextlib import asynccontextmanager

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from daemon_scout import run_scout

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Starting Web Scout background thread...")
    thread = threading.Thread(target=run_scout, daemon=True)
    thread.start()
    
    # Programmatically install Playwright Chromium on server startup
    def install_playwright():
        try:
            import subprocess
            import sys
            print("Installing Playwright Chromium...")
            subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
            print("Playwright Chromium installed successfully!")
        except Exception as e:
            print("Failed to install Playwright Chromium programmatically:", e)

    threading.Thread(target=install_playwright, daemon=True).start()
    yield


app = FastAPI(title="VectorPath API", version="0.1.0", lifespan=lifespan)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc), "traceback": traceback.format_exc()},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "VectorPath Agent Cluster Online"}

@app.post("/api/resume/parse")
async def parse_resume(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Extract text from PDF
    try:
        content = await file.read()
        pdf = PdfReader(io.BytesIO(content))
        text = ""
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
            
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from PDF. It may be an image-based PDF.")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading PDF: {str(e)}")
        
    # Pass to LangGraph
    print(f"Passing {len(text)} characters to LangGraph ensemble...")
    initial_state = GraphState(raw_resume_text=text, target_job_description=None)
    final_state = agent_graph.invoke(initial_state)
    
    # Return extracted skills
    skills = final_state.get("final_skills", [])
    skill_dicts = [{"name": s.name, "confidence": s.confidence} for s in skills]
    
    # Save User Profile and parsed Resume
    new_user = User(resume_text=text, skill_map=skill_dicts)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "status": "success",
        "user_id": new_user.id,
        "skills": skill_dicts
    }

@app.get("/api/user/latest")
def get_latest_user(db: Session = Depends(get_db)):
    user = db.query(User).order_by(User.created_at.desc()).first()
    if not user:
        return {"user_id": None}
    return {
        "user_id": user.id,
        "skills": user.skill_map
    }

@app.get("/api/daemon/status")
def get_daemon_status(user_id: int, db: Session = Depends(get_db)):
    daemon = db.query(DaemonStatus).filter_by(user_id=user_id).first()
    if not daemon:
        return {"is_running": False, "total_jobs_scraped": 0, "last_error": "Waiting for Daemon to start..."}
    
    return {
        "is_running": daemon.is_running,
        "total_jobs_scraped": daemon.total_jobs_scraped,
        "last_error": daemon.last_error,
        "last_updated": daemon.last_updated
    }

from pydantic import BaseModel, Field
from typing import List, Optional
from app.services.state import Skill
from app.services.matchmaker_agent import score_with_gemini, score_with_groq, ensemble_scores

class SkillsRequest(BaseModel):
    user_id: int
    skills: List[dict]
    skip: int = 0
    limit: int = 10

from concurrent.futures import ThreadPoolExecutor

def score_job(job, skills):
    if job.match_score is not None and job.match_score > 0:
        return job

    state = GraphState(
        target_job_description=job.description,
        final_skills=skills,
        user_id=job.user_id
    )
    state.update(score_with_gemini(state))
    state.update(score_with_groq(state))
    state.update(ensemble_scores(state))
    
    match_score = round(state.get("final_match_score", 0))
    job.match_score = match_score
    return job


@app.post("/api/jobs/recommend")
def recommend_jobs(req: SkillsRequest, db: Session = Depends(get_db)):
    if not req.skills:
        raise HTTPException(status_code=400, detail="No skills provided")
        
    skills = [Skill(**s) for s in req.skills]
    
    # Get IDs of jobs the user has already applied to
    applied_job_ids = [app.job_id for app in db.query(JobApplication.job_id).filter_by(user_id=req.user_id).all()]
    
    query = db.query(JobTarget).filter_by(user_id=req.user_id)
    if applied_job_ids:
        query = query.filter(~JobTarget.id.in_(applied_job_ids))
        
    # Fetch pre-scored jobs sorted by match_score descending
    jobs_from_db = query.order_by(
        JobTarget.match_score.desc().nullslast(),
        JobTarget.tier1_score.desc(),
        JobTarget.created_at.desc()
    ).offset(req.skip).limit(req.limit).all()
    
    if not jobs_from_db:
        return {"jobs": []}
        
    # Failsafe: only score jobs in real-time if they are missing a match_score
    unscored_jobs = [job for job in jobs_from_db if job.match_score is None]
    if unscored_jobs:
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(score_job, job, skills) for job in unscored_jobs]
            for f in futures:
                f.result()
        db.commit()
    
    results = [{
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "tags": job.tags,
        "salary": job.salary,
        "description": job.description,
        "job_skill_map": job.job_skill_map,
        "match_score": job.match_score if job.match_score is not None else 0
    } for job in jobs_from_db]
    
    results.sort(key=lambda x: x["match_score"], reverse=True)
    return {"jobs": results}


from app.models.schema import JobApplication, EducationProgram

class ApplyRequest(BaseModel):
    user_id: int
    job_id: int

@app.get("/api/dashboard/metrics")
def get_dashboard_metrics(user_id: int, db: Session = Depends(get_db)):
    applied_count = db.query(JobApplication).filter_by(user_id=user_id, status="Applied").count()
    interview_count = db.query(JobApplication).filter_by(user_id=user_id, status="Interviewing").count()
    selected_count = db.query(JobApplication).filter_by(user_id=user_id, status="Selected").count()
    education_count = db.query(EducationProgram).filter_by(user_id=user_id).count()

    return {
        "applied": applied_count,
        "interviews": interview_count,
        "selected": selected_count,
        "education": education_count
    }

@app.get("/api/telemetry/stats")
def get_telemetry_stats(user_id: int, db: Session = Depends(get_db)):
    total_jobs = db.query(JobTarget).filter_by(user_id=user_id).count()
    high_match = db.query(JobTarget).filter_by(user_id=user_id).filter(JobTarget.match_score >= 80).count()
    medium_match = db.query(JobTarget).filter_by(user_id=user_id).filter(JobTarget.match_score >= 50, JobTarget.match_score < 80).count()
    low_match = db.query(JobTarget).filter_by(user_id=user_id).filter(JobTarget.match_score < 50, JobTarget.match_score >= 0).count()
    unscored = db.query(JobTarget).filter_by(user_id=user_id).filter(JobTarget.match_score.is_(None)).count()
    
    daemon = db.query(DaemonStatus).filter_by(user_id=user_id).first()
    daemon_running = daemon.is_running if daemon else False
    last_scraped = daemon.last_updated if daemon else None
    
    return {
        "total_jobs": total_jobs,
        "high_match": high_match,
        "medium_match": medium_match,
        "low_match": low_match,
        "unscored": unscored,
        "daemon_running": daemon_running,
        "last_scraped": last_scraped
    }

@app.get("/api/logs/latest")
def get_latest_logs(user_id: int, level: Optional[str] = None, db: Session = Depends(get_db)):
    from app.models.schema import SystemLog
    query = db.query(SystemLog).filter_by(user_id=user_id)
    if level:
        query = query.filter_by(log_level=level)
    logs = query.order_by(SystemLog.created_at.desc()).limit(30).all()
    logs.reverse()
    return {"logs": [{"level": l.log_level, "message": l.message, "timestamp": l.created_at} for l in logs]}

@app.get("/api/jobs/application/status")
def get_application_status(user_id: int, job_id: int, db: Session = Depends(get_db)):
    app_rec = db.query(JobApplication).filter_by(user_id=user_id, job_id=job_id).first()
    if not app_rec:
        return {"status": "Not Applied", "cover_letter": None}
    return {
        "status": app_rec.autopilot_status or "Agentic AI Triggered",
        "cover_letter": app_rec.cover_letter
    }



@app.post("/api/jobs/apply")
def apply_to_job(req: ApplyRequest, db: Session = Depends(get_db)):
    import re
    import threading
    from sqlalchemy.orm.attributes import flag_modified
    from app.services.autopilot_agent import execute_autopilot
    from langchain_google_genai import ChatGoogleGenerativeAI
    
    job = db.query(JobTarget).filter_by(id=req.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    user = db.query(User).filter_by(id=req.user_id).first()
    
    app_exists = db.query(JobApplication).filter_by(user_id=req.user_id, job_id=req.job_id).first()
    if app_exists:
        return {
            "status": "Already applied",
            "job_title": job.title,
            "company": job.company,
            "cover_letter": app_exists.cover_letter or "Tailored Cover Letter already generated.",
            "autopilot_status": app_exists.autopilot_status or "Completed"
        }

    # 1. Generate tailored cover letter using Groq (sub-second latency)
    resume_text = (user.resume_text if user else "")[:3000]
    job_desc = (job.description if job else "")[:3000]
    
    cover_letter = ""
    try:
        from langchain_groq import ChatGroq
        llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.3)
        prompt = f"""Write a compelling, professional, and highly tailored cover letter for this job application.
Candidate Resume Context:
{resume_text}

Target Job Details:
Title: {job.title}
Company: {job.company}
Description: {job_desc}

Write a persuasive 3-paragraph cover letter formatted cleanly. Address the hiring team at {job.company} directly."""
        res = llm.invoke(prompt)
        cover_letter = str(res.content)
    except Exception as cl_err:
        print("Cover letter generation error:", cl_err)
        cover_letter = f"Dear Hiring Manager at {job.company},\n\nI am writing to express my strong interest in the {job.title} position. Based on my technical background and skills, I am confident in my ability to contribute effectively to your team.\n\nSincerely,\nCandidate"

        
    new_app = JobApplication(
        user_id=req.user_id,
        job_id=req.job_id,
        company=job.company,
        title=job.title,
        status="Applied",
        cover_letter=cover_letter,
        autopilot_status="Agentic AI Triggered"
    )
    db.add(new_app)
    
    # 2. Self-learning feedback loop: adjust weights or append new skills
    if user:
        skill_map = user.skill_map or []
        existing_skills = {s.get("name", "").lower(): s for s in skill_map if s.get("name")}
        
        matched_job_skills = [s.lower() for s in (job.job_skill_map or [])]
        title_words = [w.lower() for w in re.split(r'\W+', job.title) if len(w) > 2]
        
        # Boost existing matched skills
        for s_name, s_info in existing_skills.items():
            if s_name in matched_job_skills or any(w in s_name or s_name in w for w in title_words):
                current_weight = s_info.get("weight", 1.0)
                s_info["weight"] = min(5.0, current_weight + 0.5)
                s_info["confidence"] = "High"
                
        # Extract and insert new technical skills
        for j_skill in (job.job_skill_map or []):
            j_skill_lower = j_skill.lower()
            if j_skill_lower not in existing_skills:
                new_skill_entry = {
                    "name": j_skill,
                    "confidence": "High",
                    "weight": 2.0
                }
                skill_map.append(new_skill_entry)
                existing_skills[j_skill_lower] = new_skill_entry
                
        # Extract and insert clean job title roles
        for role in ["architect", "manager", "developer", "engineer", "designer", "scientist"]:
            if role in title_words:
                cleaned_title = job.title
                for word in ["senior", "junior", "lead", "staff", "principal", "associate"]:
                    cleaned_title = re.sub(r'(?i)\b' + word + r'\b', '', cleaned_title)
                cleaned_title = " ".join(cleaned_title.split())
                if len(cleaned_title) < 40 and cleaned_title.lower() not in existing_skills:
                    skill_map.append({
                        "name": cleaned_title,
                        "confidence": "High",
                        "weight": 2.5
                    })
                    existing_skills[cleaned_title.lower()] = {"name": cleaned_title}
                    
        user.skill_map = skill_map
        flag_modified(user, "skill_map")
        
    db.commit()
    
    # 3. Launch autonomous Agentic AI browser task in background
    thread = threading.Thread(target=execute_autopilot, args=(req.user_id, req.job_id, cover_letter), daemon=True)
    thread.start()
    
    return {
        "status": "Applied",
        "job_title": job.title,
        "company": job.company,
        "cover_letter": cover_letter,
        "autopilot_status": "Agentic AI Triggered"
    }

class JobIntelligenceSummary(BaseModel):
    summary: str = Field(description="A concise 2-sentence executive summary of what this job is and its main purpose.")
    responsibilities: List[str] = Field(description="3 to 5 clear bullet points of what the candidate is expected to do in this role.")
    recruiter_expectations: List[str] = Field(description="3 to 5 clear bullet points of what technical skills and qualifications the recruiter is looking for.")

@app.get("/api/jobs/{job_id}/summary")
def get_job_summary(job_id: int, db: Session = Depends(get_db)):
    job = db.query(JobTarget).filter_by(id=job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.1).with_structured_output(JobIntelligenceSummary)
        prompt = f"""Analyze this job posting and extract an executive summary briefing for candidate review.
Title: {job.title}
Company: {job.company}
Location: {job.location}
Salary: {job.salary}
Description: {job.description[:2500]}
"""
        res = llm.invoke(prompt)
        return {
            "id": job.id,
            "title": job.title,
            "company": job.company,
            "location": job.location,
            "salary": job.salary,
            "summary": res.summary,
            "responsibilities": res.responsibilities,
            "recruiter_expectations": res.recruiter_expectations,
            "job_skill_map": job.job_skill_map
        }
    except Exception as e:
        print("Summary error:", e)
        return {
            "id": job.id,
            "title": job.title,
            "company": job.company,
            "location": job.location,
            "salary": job.salary,
            "summary": (job.description[:300] if job.description else "No description available") + "...",
            "responsibilities": ["Refer to primary job posting for daily expectations."],
            "recruiter_expectations": job.job_skill_map or ["Relevant engineering experience."],
            "job_skill_map": job.job_skill_map
        }



