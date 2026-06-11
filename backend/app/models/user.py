from sqlalchemy import Column, Integer, String, Text
from pgvector.sqlalchemy import Vector
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    
    # Store the user's parsed resume text
    resume_text = Column(Text, nullable=True)

    # pgvector column for storing embedding representing the user's skill stack. 
    # Using 768 dimensions for Gemini embeddings or equivalent open models.
    skill_embedding = Column(Vector(768), nullable=True) 

class JobTarget(Base):
    __tablename__ = "job_targets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    title = Column(String)
    description = Column(Text)
    
    # pgvector column for the job description to match against users
    job_embedding = Column(Vector(768), nullable=True)
