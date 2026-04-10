from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.models import Application, Job, Company

router = APIRouter(prefix="/applications", tags=["applications"])


class NewApplicationRequest(BaseModel):
    company_name: str
    company_website: str | None = None
    company_location: str | None = None
    job_title: str
    job_url: str | None = None
    status: str = "offen"
    priority: str = "mittel"
    match_score: int | None = None
    salary_target: int | None = None
    applied_at: str | None = None   # ISO date string "YYYY-MM-DD"
    notes: str | None = None


class UpdateCompanyWebsiteRequest(BaseModel):
    website: str

@router.get("/")
def get_applications(db: Session = Depends(get_db)):
    apps = db.query(Application).options(
        joinedload(Application.job).joinedload(Job.company)
    ).all()
    return [
        {
            "id": a.id,
            "status": a.status,
            "priority": a.priority,
            "applied_at": str(a.applied_at) if a.applied_at else None,
            "salary_target": a.salary_target,
            "portfolio_sent": a.portfolio_sent,
            "follow_up_date": str(a.follow_up_date) if a.follow_up_date else None,
            "notes": a.notes,
            "job": {
                "id": a.job.id,
                "title": a.job.title,
                "match_score": a.job.match_score,
                "salary_min": a.job.salary_min,
                "salary_max": a.job.salary_max,
                "company": {
                    "id": a.job.company.id,
                    "name": a.job.company.name,
                    "location": a.job.company.location,
                    "website": a.job.company.website,
                }
            } if a.job else None,
        }
        for a in apps
    ]

@router.post("/")
def create_application(req: NewApplicationRequest, db: Session = Depends(get_db)):
    # Find or create company
    company = db.query(Company).filter(Company.name == req.company_name).first()
    if not company:
        company = Company(
            name=req.company_name,
            website=req.company_website or "",
            location=req.company_location or "",
        )
        db.add(company)
        db.flush()
    elif req.company_website and not company.website:
        company.website = req.company_website

    # Create job
    job = Job(
        company_id=company.id,
        title=req.job_title,
        source_url=req.job_url or "",
        match_score=req.match_score,
    )
    db.add(job)
    db.flush()

    # Create application
    applied = None
    if req.applied_at:
        try:
            applied = date_type.fromisoformat(req.applied_at)
        except ValueError:
            pass

    application = Application(
        job_id=job.id,
        status=req.status,
        priority=req.priority,
        salary_target=req.salary_target,
        applied_at=applied,
        notes=req.notes or "",
    )
    db.add(application)
    db.commit()
    db.refresh(application)
    return {"id": application.id, "status": application.status}


@router.patch("/{app_id}/status")
def update_status(app_id: int, status: str, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    app.status = status
    db.commit()
    return {"id": app_id, "status": status}


@router.patch("/companies/{company_id}/website")
def update_company_website(
    company_id: int,
    req: UpdateCompanyWebsiteRequest,
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    company.website = req.website
    db.commit()
    return {"id": company_id, "website": company.website}
