import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from app.services.state import GraphState, Skill

class SkillExtraction(BaseModel):
    skills: list[str] = Field(description="List of technical and professional skills extracted from the text.")

def parse_with_gemini(state: GraphState) -> GraphState:
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0).with_structured_output(SkillExtraction)
    prompt = f"Extract all professional skills from this resume:\n\n{state.get('raw_resume_text', '')}"
    try:
        result = llm.invoke(prompt)
        return {"gemini_skills": [s.lower().strip() for s in result.skills], "status": "gemini_parsed"}
    except Exception as e:
        return {"error": str(e), "gemini_skills": []}

def parse_with_groq(state: GraphState) -> GraphState:
    # Llama-3 handles JSON structured output excellently
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0).with_structured_output(SkillExtraction)
    prompt = f"Extract all professional skills from this resume:\n\n{state.get('raw_resume_text', '')}"
    try:
        result = llm.invoke(prompt)
        return {"groq_skills": [s.lower().strip() for s in result.skills], "status": "groq_parsed"}
    except Exception as e:
        return {"error": str(e), "groq_skills": []}

def ensemble_skills(state: GraphState) -> GraphState:
    gemini_set = set(state.get("gemini_skills", []))
    groq_set = set(state.get("groq_skills", []))
    
    final_skills = []
    all_unique_skills = gemini_set.union(groq_set)
    
    for skill in all_unique_skills:
        # High confidence if both models extracted it
        if skill in gemini_set and skill in groq_set:
            final_skills.append(Skill(name=skill.title(), confidence="High"))
        else:
            # Low confidence if only one model found it
            final_skills.append(Skill(name=skill.title(), confidence="Low"))
            
    return {"final_skills": final_skills, "status": "skills_ensembled"}
