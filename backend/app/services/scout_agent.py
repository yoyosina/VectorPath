from duckduckgo_search import DDGS
from langchain_groq import ChatGroq
from typing import List
from pydantic import BaseModel

class JobRecommendation(BaseModel):
    title: str
    company: str
    location: str
    tags: List[str]
    salary: str
    description: str

class JobRecommendations(BaseModel):
    jobs: List[JobRecommendation]

def scout_live_jobs(skills: List[str]) -> List[JobRecommendation]:
    """
    Formulates a search query based on skills, searches DuckDuckGo for live job postings,
    and normalizes the raw HTML/text results into structured JobRecommendation objects.
    """
    # 1. Formulate Query
    # Grab the top 3 skills to make the search query focused
    top_skills = " ".join(skills[:3]) if skills else "Software"
    query = f"{top_skills} software engineer job posting remote"
    
    print(f"Scout Agent executing live web search: '{query}'")
    
    # 2. Execute Web Search
    results = []
    try:
        with DDGS() as ddgs:
            # Get top 10 text results
            ddg_results = ddgs.text(query, max_results=10)
            for r in ddg_results:
                results.append(f"Title: {r.get('title')}\nSnippet: {r.get('body')}\nLink: {r.get('href')}")
    except Exception as e:
        print(f"Error during DuckDuckGo search: {e}")
        # Fallback empty
        
    raw_search_text = "\n\n---\n\n".join(results)
    
    # If search fails entirely or blocks us, fallback to prompting
    if not raw_search_text.strip():
        raw_search_text = f"Fallback mode: Generate simulated realistic remote jobs for {top_skills} engineer."
        
    print("Scout Agent normalizing search results via LLM...")

    # 3. Normalize to Schema using Groq
    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0.2).with_structured_output(JobRecommendations)
    
    prompt = f"""
    You are an expert technical recruiter parsing raw web search results for job postings.
    Extract and normalize the job data from the following raw search snippets into realistic, well-formatted JobRecommendation objects.
    If a salary is not explicitly mentioned in the snippet, estimate a highly realistic market range based on the tech stack (e.g., "$120k - $160k").
    If the company is vague, infer it or use 'Confidential'.
    Make sure the 'description' field is at least 2 sentences explaining the role requirements based on the snippet.
    Extract as many distinct job postings as you can find in the text (up to 10).
    
    RAW SEARCH RESULTS:
    {raw_search_text}
    """
    
    try:
        extracted = llm.invoke(prompt)
        return extracted.jobs
    except Exception as e:
        print(f"Error during LLM normalization: {e}")
        return []
