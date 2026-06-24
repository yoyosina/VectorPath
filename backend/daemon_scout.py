import time
import os
import json
import re
import requests
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field
from typing import List, Optional

from app.core.database import SessionLocal
from app.models.schema import User, JobTarget, DaemonStatus, SystemLog
from app.services.state import Skill, GraphState
from app.services.matchmaker_agent import score_with_gemini, score_with_groq, ensemble_scores

load_dotenv()

def log_msg(db, user_id, level, message):
    try:
        new_log = SystemLog(user_id=user_id, log_level=level, message=message)
        db.add(new_log)
        # Keep only last 50 logs to prevent bloat
        count = db.query(SystemLog).filter_by(user_id=user_id).count()
        if count > 50:
            oldest = db.query(SystemLog).filter_by(user_id=user_id).order_by(SystemLog.created_at.asc()).first()
            if oldest:
                db.delete(oldest)
        db.commit()
    except Exception as e:
        print("Log error:", e)
        db.rollback()

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
            log_msg(db, user.id, "SCOUT", f"Fetching Arbeitnow Job Board (Page {page_tracker})...")
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
                log_msg(db, user.id, "ERROR", f"Failed to fetch jobs: {str(e)[:50]}")
                time.sleep(30)
                continue
                
            if not jobs_data:
                print("Reached end of API. Resetting to page 1.")
                log_msg(db, user.id, "SYS", "Reached end of job database. Resetting to Page 1.")
                page_tracker = 1
                time.sleep(60)
                continue
                
            # 4. Filter duplicates locally (optimized batch query)
            existing_jobs = set(db.query(JobTarget.title, JobTarget.company).filter_by(user_id=user.id).all())
            new_jobs = []
            for j in jobs_data:
                title = j.get('title', '')
                company = j.get('company_name', '')
                if (title, company) not in existing_jobs:
                    new_jobs.append(j)
                    
            print(f"Found {len(new_jobs)} new jobs on page {page_tracker}. Processing in batches...")
            log_msg(db, user.id, "SCOUT", f"Found {len(new_jobs)} new jobs. Processing through AI Ensemble...")
            
            # 5. Process new jobs via LLM in batches
            llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.1).with_structured_output(BatchParsedJobs)
            user_skills = [Skill(**s) for s in user.skill_map]
            
            for i in range(0, len(new_jobs), 10): # Batch 10 at a time
                batch = new_jobs[i:i+10]
                prompt_text = "Extract the core technical skills (skill_map) for each job below. Return the numeric ID exactly as provided.\n\n"
                
                for idx, bj in enumerate(batch):
                    desc = strip_html(bj.get('description', ''))[:1000] # Use first 1000 chars for speed
                    prompt_text += f"ID: {idx}\nTitle: {bj.get('title')}\nTags: {bj.get('tags')}\nDesc: {desc}\n\n---\n\n"
                    
                # Retry wrapper for LLM skill map extraction to handle 429 errors
                extracted = None
                for attempt in range(3):
                    try:
                        log_msg(db, user.id, "MATCH", f"Extracting skill maps for batch {int(i/10)+1} / {int(len(new_jobs)/10)+1} (attempt {attempt+1})...")
                        extracted = llm.invoke(prompt_text)
                        break
                    except Exception as e:
                        if ("429" in str(e) or "rate_limit" in str(e).lower()) and attempt < 2:
                            wait_time = (attempt + 1) * 10
                            log_msg(db, user.id, "WARN", f"Rate limit hit during batch parse. Sleeping for {wait_time}s...")
                            print(f"Rate limit hit during batch parse. Sleeping for {wait_time}s...")
                            time.sleep(wait_time)
                        else:
                            raise e

                try:
                    # Map extracted skills back to batch
                    added_count = 0
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
                        
                        # Run the heavy AI Ensemble scoring in background with retries & rate-limit safety
                        job_desc = strip_html(job.get('description', ''))[:2000]
                        state = GraphState(
                            target_job_description=job_desc,
                            final_skills=user_skills
                        )
                        match_score = 0
                        try:
                            # Gemini call (with 429 retry)
                            for g_attempt in range(3):
                                try:
                                    state.update(score_with_gemini(state))
                                    break
                                except Exception as ge:
                                    if ("429" in str(ge) or "rate" in str(ge).lower()) and g_attempt < 2:
                                        log_msg(db, user.id, "WARN", f"Gemini Rate Limit hit during scoring. Retrying in 5s...")
                                        time.sleep(5)
                                    else:
                                        raise ge
                                        
                            time.sleep(2) # rate limit buffer
                            
                            # Groq call (with 429 retry)
                            for q_attempt in range(3):
                                try:
                                    state.update(score_with_groq(state))
                                    break
                                except Exception as qe:
                                    if ("429" in str(qe) or "rate" in str(qe).lower()) and q_attempt < 2:
                                        log_msg(db, user.id, "WARN", f"Groq Rate Limit hit during scoring. Retrying in 10s...")
                                        time.sleep(10)
                                    else:
                                        raise qe
                                        
                            state.update(ensemble_scores(state))
                            match_score = round(state.get("final_match_score", 0))
                        except Exception as score_err:
                            print(f"Scoring error in background daemon: {score_err}")
                            match_score = 0
                        
                        # Sleep 5 seconds between scoring individual jobs to respect Gemini 15 RPM rate limits
                        time.sleep(5)
                                
                        new_target = JobTarget(
                            user_id=user.id,
                            title=job.get('title', ''),
                            company=job.get('company_name', ''),
                            location=job.get('location', 'Remote'),
                            description=job_desc,
                            salary="Competitive", # Arbeitnow rarely has salary
                            tags=job.get('tags', []),
                            job_skill_map=parsed.skill_map,
                            tier1_score=t1_score,
                            match_score=match_score
                        )
                        db.add(new_target)
                        added_count += 1
                    db.commit()
                    log_msg(db, user.id, "EXEC", f"Successfully evaluated {len(batch)} jobs and saved {added_count} relevant targets with background scoring.")
                    # Sleep 10 seconds between batches to let the API window reset
                    time.sleep(10)
                except Exception as e:
                    print(f"LLM Batch Error: {e}")
                    log_msg(db, user.id, "ERROR", f"LLM Batch Error: {str(e)[:40]}. Cooling down for 30 mins...")
                    # Cool down for 30 minutes to let daily quotas reset and prevent self-inflicted API exhaustion
                    time.sleep(1800)
                    continue
                    
            # 6. Finalize page
            page_tracker += 1
            daemon.total_jobs_scraped = db.query(JobTarget).filter_by(user_id=user.id).count()
            daemon.last_error = None
            db.commit()
            
            print(f"Page processed. Total db jobs: {daemon.total_jobs_scraped}")
            log_msg(db, user.id, "SYS", f"Page {page_tracker-1} complete. Database holding {daemon.total_jobs_scraped} jobs. Resting...")
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
