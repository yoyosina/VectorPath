import time
import os
import json
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from duckduckgo_search import DDGS
from langchain_groq import ChatGroq
from pydantic import BaseModel
from typing import List

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
    skill_map: List[str] # List of string skills for fast filtering

class JobRecommendations(BaseModel):
    jobs: List[JobRecommendation]

def compute_tier1_score(user_skills, job_skills):
    # Fast JSON to JSON comparison
    score = 0
    # Create normalized list of job skills
    j_skills = [s.lower() for s in job_skills]
    for u_skill in user_skills:
        u_name = u_skill.get("name", "").lower()
        conf = u_skill.get("confidence", "Low")
        
        match_found = any(u_name in j_skill or j_skill in u_name for j_skill in j_skills)
        if match_found:
            if conf == "High": score += 100
            elif conf == "Medium": score += 50
            elif conf == "Low": score += 10
            
    # Max score isn't strictly bounded, we just want relative ranking out of ~1000
    # Let's cap at 1000
    return min(1000, score)

def run_scout():
    print("Starting Continuous Web Scout Daemon...")
    while True:
        db: Session = SessionLocal()
        try:
            # 1. Get latest user
            user = db.query(User).order_by(User.created_at.desc()).first()
            if not user or not user.skill_map:
                print("No user or skill map found. Sleeping for 30s...")
                time.sleep(30)
                continue
                
            # 2. Update/Create DaemonStatus
            daemon = db.query(DaemonStatus).filter_by(user_id=user.id).first()
            if not daemon:
                daemon = DaemonStatus(user_id=user.id, is_running=True)
                db.add(daemon)
                db.commit()
            
            daemon.is_running = True
            db.commit()
                
            # 3. Formulate query based on user's top skills
            import random
            all_skills = [s['name'] for s in user.skill_map] if user.skill_map else []
            if len(all_skills) >= 2:
                selected_skills = random.sample(all_skills, 2)
            elif all_skills:
                selected_skills = all_skills
            else:
                selected_skills = ["Software"]
                
            job_keywords = ["remote job", "hiring", "careers", "job posting", "vacancy"]
            query = f"{' '.join(selected_skills)} {random.choice(job_keywords)}"
            
            print(f"Scouting for: {query}")
            
            # 4. Search DuckDuckGo
            results = []
            try:
                with DDGS() as ddgs:
                    for r in ddgs.text(query, max_results=15):
                        results.append(f"Title: {r.get('title')}\nSnippet: {r.get('body')}")
            except Exception as e:
                daemon.last_error = f"Search Error: {e}"
                db.commit()
                time.sleep(10)
                continue
                
            if not results:
                time.sleep(10)
                continue
                
            # 5. Extract Jobs & Skill Maps using Groq
            raw_search_text = "\n\n---\n\n".join(results)
            llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.2).with_structured_output(JobRecommendations)
            
            prompt = f"""
            Extract distinct job postings from these search snippets.
            For each job, extract the standard details, AND generate a `skill_map` (a list of technical skills required).
            Limit to 5 high quality jobs.
            Snippets: {raw_search_text}
            """
            
            try:
                extracted = llm.invoke(prompt)
            except Exception as e:
                daemon.last_error = f"LLM Error: {e}"
                db.commit()
                time.sleep(10)
                continue
                
            # 6. Score and insert jobs
            for job in extracted.jobs:
                t1_score = compute_tier1_score(user.skill_map, job.skill_map)
                
                # Check 10,000 limit
                total_jobs = db.query(JobTarget).filter_by(user_id=user.id).count()
                
                if total_jobs >= 10000:
                    lowest_job = db.query(JobTarget).filter_by(user_id=user.id).order_by(JobTarget.tier1_score.asc()).first()
                    if lowest_job and t1_score > lowest_job.tier1_score:
                        db.delete(lowest_job)
                        db.commit()
                    else:
                        continue # Don't insert if score is too low
                
                # Deduplication check
                existing = db.query(JobTarget).filter_by(user_id=user.id, title=job.title, company=job.company).first()
                if not existing:
                    new_job = JobTarget(
                        user_id=user.id,
                        title=job.title,
                        company=job.company,
                        location=job.location,
                        description=job.description,
                        salary=job.salary,
                        tags=job.tags,
                        job_skill_map=job.skill_map,
                        tier1_score=t1_score
                    )
                    db.add(new_job)
                
            db.commit()
            
            # Update daemon stats
            daemon.total_jobs_scraped = db.query(JobTarget).filter_by(user_id=user.id).count()
            daemon.last_error = None
            db.commit()
            
            print(f"Scout iteration complete. Total jobs: {daemon.total_jobs_scraped}")
            time.sleep(15) # Wait before next scrape to avoid rate limits
            
        except Exception as e:
            print(f"Daemon crashed: {e}")
            time.sleep(30)
        finally:
            db.close()

if __name__ == "__main__":
    run_scout()
