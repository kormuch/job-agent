from sqlalchemy import Column, Integer, String, Text, Boolean, Date, DateTime, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Company(Base):
    __tablename__ = "companies"
    id            = Column(Integer, primary_key=True)
    name          = Column(String(255), nullable=False)
    website       = Column(String(255))
    industry      = Column(String(100))
    location      = Column(String(100))
    size          = Column(String(50))
    revenue       = Column(String(50))
    kununu_score  = Column(Numeric(2, 1))
    remote_policy = Column(String(50))
    tariff              = Column(Boolean, default=False)
    notes               = Column(Text)
    logo_url            = Column(Text)
    description         = Column(Text)
    culture_text        = Column(Text)
    ceo_name            = Column(String(255))
    research_fetched_at = Column(String(32))
    kununu_fetched_at   = Column(String(32))
    created_at          = Column(DateTime, server_default=func.now())
    jobs                = relationship("Job", back_populates="company")
    contacts            = relationship("Contact", back_populates="company")

class Job(Base):
    __tablename__ = "jobs"
    id            = Column(Integer, primary_key=True)
    company_id    = Column(Integer, ForeignKey("companies.id"))
    title         = Column(String(255), nullable=False)
    location      = Column(String(100))
    salary_min    = Column(Integer)
    salary_max    = Column(Integer)
    remote        = Column(Boolean, default=False)
    source        = Column(String(100))
    source_url    = Column(Text)
    description   = Column(Text)
    requirements  = Column(Text)
    match_score   = Column(Integer)
    match_notes   = Column(Text)
    published_at  = Column(Date)
    created_at    = Column(DateTime, server_default=func.now())
    company       = relationship("Company", back_populates="jobs")
    applications  = relationship("Application", back_populates="job")

class Contact(Base):
    __tablename__ = "contacts"
    id            = Column(Integer, primary_key=True)
    company_id    = Column(Integer, ForeignKey("companies.id"))
    name          = Column(String(255), nullable=False)
    role          = Column(String(255))
    email         = Column(String(255))
    phone         = Column(String(50))
    linkedin_url  = Column(Text)
    notes         = Column(Text)
    created_at    = Column(DateTime, server_default=func.now())
    company       = relationship("Company", back_populates="contacts")

class Application(Base):
    __tablename__ = "applications"
    id             = Column(Integer, primary_key=True)
    job_id         = Column(Integer, ForeignKey("jobs.id"))
    contact_id     = Column(Integer, ForeignKey("contacts.id"))
    status         = Column(String(50), nullable=False, default="offen")
    priority       = Column(String(10), default="mittel")
    applied_at     = Column(Date)
    salary_target  = Column(Integer)
    cover_letter   = Column(Boolean, default=False)
    portfolio_sent = Column(Boolean, default=False)
    follow_up_date = Column(Date)
    notes          = Column(Text)
    created_at     = Column(DateTime, server_default=func.now())
    updated_at     = Column(DateTime, server_default=func.now(), onupdate=func.now())
    job            = relationship("Job", back_populates="applications")
    activities     = relationship("Activity", back_populates="application")

class Activity(Base):
    __tablename__ = "activities"
    id             = Column(Integer, primary_key=True)
    application_id = Column(Integer, ForeignKey("applications.id"))
    type           = Column(String(50))
    description    = Column(Text)
    happened_at    = Column(DateTime, server_default=func.now())
    application    = relationship("Application", back_populates="activities")

class SearchProfile(Base):
    __tablename__ = "search_profiles"
    id            = Column(Integer, primary_key=True)
    name          = Column(String(255), nullable=False)   # z.B. "AI Consulting Schweiz"
    query         = Column(String(255), nullable=False)   # z.B. "AI Consultant Zürich"
    location      = Column(String(100))                   # z.B. "Zürich"
    cv_text       = Column(Text)                          # Eigenes Bewerberprofil dieser Persona
    system_prompt = Column(Text)                          # Eigener Such-/Match-Prompt dieser Persona
    active        = Column(Boolean, default=True)         # Deaktiviert statt gelöscht
    created_at    = Column(DateTime, server_default=func.now())
