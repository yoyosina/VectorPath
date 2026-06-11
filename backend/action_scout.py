import time
import os
import json
import concurrent.futures
from sqlalchemy.orm import Session
from duckduckgo_search import DDGS
from langchain_groq import ChatGroq
from pydantic import BaseModel
from typing import List
from dotenv import load_dotenv

from app.core.database import SessionLocal
from app.models.schema import User, JobTarget, DaemonStatus

load_dotenv()

class JobRecommendation(BaseModel):
    title: str
    company: str
    location: str
    tags: List[str]
    salary: str
    description: str
    skill_map: List[str]

class JobRecommendations(BaseModel):
    jobs: List[JobRecommendation]

def compute_tier1_score(user_skills, job_skills):
    score = 0
    j_skills = [s.lower() for s in job_skills]
    for u_skill in user_skills:
        u_name = u_skill.get("name", "").lower()
        conf = u_skill.get("confidence", "Low")
        match_found = any(u_name in j_skill or j_skill in u_name for j_skill in j_skills)
        if match_found:
            if conf == "High": score += 100
            elif conf == "Medium": score += 50
            elif conf == "Low": score += 10
    return min(1000, score)

def search_duckduckgo(query: str) -> str:
    print(f"Searching DDG for: {query}")
    results = []
    try:
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=10):
                results.append(f"Title: {r.get('title')}\nSnippet: {r.get('body')}")
    except Exception as e:
        print(f"DDG Error on '{query}': {e}")
    return "\n\n---\n\n".join(results)

def extract_jobs_from_text(raw_text: str) -> List[JobRecommendation]:
    if not raw_text.strip():
        return []
    print("Extracting jobs using llama-3.1-8b-instant...")
    llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0.1).with_structured_output(JobRecommendations)
    prompt = f"""
    Extract distinct job postings from these search snippets.
    For each job, extract standard details AND generate a `skill_map` (list of tech skills required).
    Snippets: {raw_text}
    """
    try:
        extracted = llm.invoke(prompt)
        return extracted.jobs
    except Exception as e:
        print(f"LLM Error: {e}")
        return []

def run_burst_scout():
    print("Starting High-Speed Burst Scout...")
    db: Session = SessionLocal()
    try:
        user = db.query(User).order_by(User.created_at.desc()).first()
        if not user or not user.skill_map:
            print("No user profile found. Exiting.")
            return

        daemon = db.query(DaemonStatus).filter_by(user_id=user.id).first()
        if not daemon:
            daemon = DaemonStatus(user_id=user.id)
            db.add(daemon)
        daemon.is_running = True
        daemon.last_error = None
        db.commit()

        # Generate multiple distinct queries
        high_conf = [s['name'] for s in user.skill_map if s.get('confidence') in ['High', 'Medium']]
        if not high_conf:
            high_conf = ["Software"]
        
        # Target the top 3 skills independently to widen the net
        queries = [f"{skill} remote job posting" for skill in high_conf[:3]]
        
        # Parallel Execution: Fetch all DDG searches at once
        raw_texts = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            raw_texts = list(executor.map(search_duckduckgo, queries))
            
        # Parallel Execution: Extract jobs using LLM at once
        all_jobs = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            lists_of_jobs = list(executor.map(extract_jobs_from_text, raw_texts))
            for jlist in lists_of_jobs:
                all_jobs.extend(jlist)
                
        print(f"Extracted {len(all_jobs)} potential jobs. Scoring and inserting...")
        
        inserted_count = 0
        for job in all_jobs:
            t1_score = compute_tier1_score(user.skill_map, job.skill_map)
            
            # 10k Limit Check
            total_jobs = db.query(JobTarget).filter_by(user_id=user.id).count()
            if total_jobs >= 10000:
                lowest_job = db.query(JobTarget).filter_by(user_id=user.id).order_by(JobTarget.tier1_score.asc()).first()
                if lowest_job and t1_score > lowest_job.tier1_score:
                    db.delete(lowest_job)
                    db.commit()
                else:
                    continue
                    
            existing = db.query(JobTarget).filter_by(user_id=user.id, title=job.title, company=job.company).first()
            if not existing:
                new_job = JobTarget(
                    user_id=user.id, title=job.title, company=job.company,
                    location=job.location, description=job.description,
                    salary=job.salary, tags=job.tags,
                    job_skill_map=job.skill_map, tier1_score=t1_score
                )
                db.add(new_job)
                inserted_count += 1
                
        db.commit()
        daemon.total_jobs_scraped = db.query(JobTarget).filter_by(user_id=user.id).count()
        daemon.is_running = False # Turn off status after burst
        db.commit()
        print(f"Burst complete. Inserted {inserted_count} new jobs. Total: {daemon.total_jobs_scraped}")

    except Exception as e:
        print(f"Burst Scout Error: {e}")
        if 'daemon' in locals():
            daemon.last_error = str(e)
            daemon.is_running = False
            db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    run_burst_scout()
