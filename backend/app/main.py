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

from pydantic import BaseModel
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
        final_skills=skills
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
        
    jobs_from_db = query.order_by(JobTarget.created_at.desc(), JobTarget.tier1_score.desc()).offset(req.skip).limit(req.limit).all()
    
    if not jobs_from_db:
        return {"jobs": []}
        
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(score_job, job, skills) for job in jobs_from_db]
        scored_jobs = [f.result() for f in futures]
        
    db.commit()
    
    results = [{
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "tags": job.tags,
        "salary": job.salary,
        "match_score": job.match_score
    } for job in scored_jobs]
    
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

@app.post("/api/jobs/apply")
def apply_to_job(req: ApplyRequest, db: Session = Depends(get_db)):
    job = db.query(JobTarget).filter_by(id=req.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    app_exists = db.query(JobApplication).filter_by(user_id=req.user_id, job_id=req.job_id).first()
    if app_exists:
        return {"status": "Already applied"}
        
    new_app = JobApplication(
        user_id=req.user_id,
        job_id=req.job_id,
        company=job.company,
        title=job.title,
        status="Applied"
    )
    db.add(new_app)
    db.commit()
    return {"status": "Applied"}
