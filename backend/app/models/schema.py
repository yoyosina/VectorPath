from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    resume_text = Column(Text, nullable=True)
    skill_map = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    jobs = relationship("JobTarget", back_populates="user", cascade="all, delete-orphan")
    daemon_status = relationship("DaemonStatus", back_populates="user", uselist=False, cascade="all, delete-orphan")

class JobTarget(Base):
    __tablename__ = "job_targets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, index=True)
    company = Column(String)
    location = Column(String)
    description = Column(Text)
    salary = Column(String, nullable=True)
    tags = Column(JSON, nullable=True)
    job_skill_map = Column(JSON, nullable=True)
    tier1_score = Column(Integer, default=0, index=True)
    match_score = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="jobs")

class DaemonStatus(Base):
    __tablename__ = "daemon_status"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    is_running = Column(Boolean, default=False)
    total_jobs_scraped = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="daemon_status")

class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    job_id = Column(Integer, ForeignKey("job_targets.id"), nullable=True) # Optional link back to target
    company = Column(String)
    title = Column(String)
    status = Column(String, default="Applied") # Applied, Interviewing, Selected, Rejected
    applied_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
    job = relationship("JobTarget")

class EducationProgram(Base):
    __tablename__ = "education_programs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    program_name = Column(String)
    institution = Column(String)
    status = Column(String, default="Applied") # Applied, Enrolled, Completed
    applied_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")

class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    log_level = Column(String, default="INFO") # e.g., SYS, SCOUT, MATCH, EXEC
    message = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
