import time
import os
import json
import re
import requests
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from typing import List, Optional

from app.core.database import SessionLocal
from app.models.schema import User, JobTarget, DaemonStatus

load_dotenv()

class ParsedJob(BaseModel):
    id: str = Field(description="The numeric ID of the job from the batch")
    skill_map: List[str] = Field(description="List of 3 to 7 core technical skills extracted from the description")

class BatchParsedJobs(BaseModel):
    jobs: List[ParsedJob]

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

def strip_html(text):
    if not text: return ""
    clean = re.sub('<[^<]+?>', ' ', text)
    return ' '.join(clean.split())

def run_scout():
    print("Starting Web Scout v2.0 (Direct API Pipeline)...")
    page_tracker = 1
    
    while True:
        db: Session = SessionLocal()
        try:
            # 1. Get latest user
            user = db.query(User).order_by(User.created_at.desc()).first()
            if not user or not user.skill_map:
                print("No user or skill map found. Sleeping for 30s...")
                time.sleep(30)
                continue
                
            # 2. Update DaemonStatus
            daemon = db.query(DaemonStatus).filter_by(user_id=user.id).first()
            if not daemon:
                daemon = DaemonStatus(user_id=user.id, is_running=True)
                db.add(daemon)
            daemon.is_running = True
            db.commit()
            
            # 3. Fetch from Arbeitnow
            print(f"Fetching Arbeitnow Page {page_tracker}...")
            api_url = f"https://www.arbeitnow.com/api/job-board-api?page={page_tracker}"
            try:
                res = requests.get(api_url, timeout=15)
                if res.status_code != 200:
                    time.sleep(30)
                    continue
                jobs_data = res.json().get('data', [])
            except Exception as e:
                daemon.last_error = f"API Fetch Error: {e}"
                db.commit()
                time.sleep(30)
                continue
                
            if not jobs_data:
                print("Reached end of API. Resetting to page 1.")
                page_tracker = 1
                time.sleep(60)
                continue
                
            # 4. Filter duplicates locally
            new_jobs = []
            for j in jobs_data:
                title = j.get('title', '')
                company = j.get('company_name', '')
                existing = db.query(JobTarget).filter_by(user_id=user.id, title=title, company=company).first()
                if not existing:
                    new_jobs.append(j)
                    
            print(f"Found {len(new_jobs)} new jobs on page {page_tracker}. Processing in batches...")
            
            # 5. Process new jobs via LLM in batches
            llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.1).with_structured_output(BatchParsedJobs)
            
            for i in range(0, len(new_jobs), 10): # Batch 10 at a time
                batch = new_jobs[i:i+10]
                prompt_text = "Extract the core technical skills (skill_map) for each job below. Return the numeric ID exactly as provided.\n\n"
                
                for idx, bj in enumerate(batch):
                    desc = strip_html(bj.get('description', ''))[:1000] # Use first 1000 chars for speed
                    prompt_text += f"ID: {idx}\nTitle: {bj.get('title')}\nTags: {bj.get('tags')}\nDesc: {desc}\n\n---\n\n"
                    
                try:
                    extracted = llm.invoke(prompt_text)
                    
                    # Map extracted skills back to batch
                    for parsed in extracted.jobs:
                        try:
                            idx = int(parsed.id)
                            job = batch[idx]
                        except:
                            continue # Ignore bad IDs
                            
                        t1_score = compute_tier1_score(user.skill_map, parsed.skill_map)
                        
                        # Apply limits
                        total_jobs = db.query(JobTarget).filter_by(user_id=user.id).count()
                        if total_jobs >= 10000:
                            lowest = db.query(JobTarget).filter_by(user_id=user.id).order_by(JobTarget.tier1_score.asc()).first()
                            if lowest and t1_score > lowest.tier1_score:
                                db.delete(lowest)
                                db.commit()
                            else:
                                continue
                                
                        new_target = JobTarget(
                            user_id=user.id,
                            title=job.get('title', ''),
                            company=job.get('company_name', ''),
                            location=job.get('location', 'Remote'),
                            description=strip_html(job.get('description', ''))[:2000],
                            salary="Competitive", # Arbeitnow rarely has salary
                            tags=job.get('tags', []),
                            job_skill_map=parsed.skill_map,
                            tier1_score=t1_score
                        )
                        db.add(new_target)
                    db.commit()
                except Exception as e:
                    print(f"LLM Batch Error: {e}")
                    # Skip batch on error to keep moving
                    continue
                    
            # 6. Finalize page
            page_tracker += 1
            daemon.total_jobs_scraped = db.query(JobTarget).filter_by(user_id=user.id).count()
            daemon.last_error = None
            db.commit()
            
            print(f"Page processed. Total db jobs: {daemon.total_jobs_scraped}")
            time.sleep(5) # brief pause between pages
            
        except Exception as e:
            print(f"Daemon Critical Error: {e}")
            try:
                db.rollback()
            except:
                pass
            time.sleep(30)
        finally:
            db.close()

if __name__ == "__main__":
    run_scout()
