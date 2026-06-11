from langgraph.graph import StateGraph, END
from app.services.state import GraphState
from app.services.parser_agent import parse_with_gemini, parse_with_groq, ensemble_skills
from app.services.matchmaker_agent import score_with_gemini, score_with_groq, ensemble_scores

def build_graph():
    workflow = StateGraph(GraphState)
    
    # 1. Parsing Nodes
    workflow.add_node("parse_gemini", parse_with_gemini)
    workflow.add_node("parse_groq", parse_with_groq)
    workflow.add_node("ensemble_skills", ensemble_skills)
    
    # 2. Scoring Nodes
    workflow.add_node("score_gemini", score_with_gemini)
    workflow.add_node("score_groq", score_with_groq)
    workflow.add_node("ensemble_scores", ensemble_scores)
    
    # Build Edges
    workflow.set_entry_point("parse_gemini")
    
    workflow.add_edge("parse_gemini", "parse_groq")
    workflow.add_edge("parse_groq", "ensemble_skills")
    
    # Conditional Routing: Only proceed to scoring if a job description is provided
    def route_to_scoring(state: GraphState):
        if state.get("target_job_description"):
            return "score_gemini"
        return END
        
    workflow.add_conditional_edges("ensemble_skills", route_to_scoring)
    
    workflow.add_edge("score_gemini", "score_groq")
    workflow.add_edge("score_groq", "ensemble_scores")
    workflow.add_edge("ensemble_scores", END)
    
    return workflow.compile()

agent_graph = build_graph()
