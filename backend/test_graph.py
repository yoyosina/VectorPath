import os
import sys

# Ensure app module can be found
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.services.graph import agent_graph
from app.services.state import GraphState

def test_dual_agent_graph():
    resume_text = """
    Software Engineer with 5 years of experience.
    Proficient in Python, React, Next.js, and PostgreSQL.
    Experienced in building scalable microservices and REST APIs using FastAPI.
    Familiar with Docker and AWS for deployment.
    Strong problem-solving and communication skills.
    """
    
    job_description = """
    We are looking for a Full Stack Engineer.
    Requirements:
    - Strong proficiency in Python and FastAPI.
    - Experience with relational databases like PostgreSQL.
    - Familiarity with containerization (Docker).
    - Frontend experience with React/Next.js is highly desired.
    - Excellent communication skills.
    """
    
    initial_state = GraphState(
        raw_resume_text=resume_text,
        target_job_description=job_description
    )
    
    print("--- Starting LangGraph Dual Execution ---")
    print("Parsing resume with Gemini & Groq...")
    final_state = agent_graph.invoke(initial_state)
    
    print("\n--- Ensembled Skills Extracted ---")
    for skill in final_state.get('final_skills', []):
        print(f"* {skill.name} ({skill.confidence} Confidence)")
        
    print("\n--- Match Scoring ---")
    print(f"Gemini Score (60% weight): {final_state.get('gemini_score')}")
    print(f"Groq Score (40% weight): {final_state.get('groq_score')}")
    print(f"Final Averaged Score: {final_state.get('final_match_score')}")

if __name__ == "__main__":
    test_dual_agent_graph()
