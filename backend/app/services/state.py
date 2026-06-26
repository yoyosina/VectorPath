from typing import TypedDict, List, Optional
from pydantic import BaseModel

class Skill(BaseModel):
    name: str
    confidence: str # "High" for overlap, "Low" for non-overlap
    weight: float = 1.0

class GraphState(TypedDict, total=False):
    # Inputs
    raw_resume_text: str
    target_job_description: Optional[str]
    
    # Parsing Outputs
    gemini_skills: List[str]
    groq_skills: List[str]
    final_skills: List[Skill]
    
    # Matching Outputs
    gemini_score: Optional[float]
    groq_score: Optional[float]
    final_match_score: Optional[float]
    
    # Meta
    status: str
    error: Optional[str]
