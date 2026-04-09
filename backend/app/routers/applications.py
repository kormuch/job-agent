from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.models import Application, Job, Company

router = APIRouter(prefix="/applications", tags=["applications"])

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
                }
            } if a.job else None,
        }
        for a in apps
    ]

@router.patch("/{app_id}/status")
def update_status(app_id: int, status: str, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Nicht gefunden")
    app.status = status
    db.commit()
    return {"id": app_id, "status": status}
