"""
Job Scout — URL-basierter Import
Stellenanzeige-URL eingeben → Titel, Firma, Beschreibung automatisch extrahieren
Funktioniert mit Stepstone, LinkedIn, Indeed, Unternehmenswebsites usw.
"""
import re
import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.models import Company, Job

router = APIRouter(prefix="/scout", tags=["scout"])


class ImportRequest(BaseModel):
    url: str
    title: str | None = None        # optional: manuell überschreiben
    company_name: str | None = None
    notes: str | None = None


def _extract_meta(html: str, url: str) -> dict:
    """Extrahiert Job-Infos aus HTML via Meta-Tags und heuristischen Patterns."""

    def meta(prop: str) -> str:
        m = re.search(rf'<meta[^>]+(?:property|name)="{re.escape(prop)}"[^>]+content="([^"]+)"', html, re.I)
        if not m:
            m = re.search(rf'<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="{re.escape(prop)}"', html, re.I)
        return m.group(1).strip() if m else ""

    def tag(t: str) -> str:
        m = re.search(rf"<{t}[^>]*>([^<]{{3,200}})</{t}>", html, re.I)
        return m.group(1).strip() if m else ""

    # Titel
    title = (
        meta("og:title") or
        meta("twitter:title") or
        tag("h1") or
        tag("title") or
        ""
    )
    # Firma
    company = (
        meta("og:site_name") or
        meta("author") or
        ""
    )
    # Beschreibung
    description = (
        meta("og:description") or
        meta("description") or
        meta("twitter:description") or
        ""
    )

    # Stepstone-spezifisch
    if "stepstone" in url:
        m = re.search(r'"hiringOrganization"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"', html)
        if m: company = m.group(1)
        m = re.search(r'"title"\s*:\s*"([^"]+)"', html)
        if m and not title: title = m.group(1)

    # LinkedIn-spezifisch
    if "linkedin" in url:
        m = re.search(r'class="top-card-layout__title[^"]*"[^>]*>([^<]+)<', html)
        if m: title = m.group(1).strip()
        m = re.search(r'class="topcard__org-name-link[^"]*"[^>]*>([^<]+)<', html)
        if m: company = m.group(1).strip()

    # Cleanup
    title   = re.sub(r"\s+", " ", title).strip()[:255]
    company = re.sub(r"\s+", " ", company).strip()[:255]
    description = re.sub(r"<[^>]+>", " ", description)
    description = re.sub(r"\s+", " ", description).strip()[:2000]

    return {"title": title, "company": company, "description": description}


@router.post("/import")
async def import_job(req: ImportRequest, db: Session = Depends(get_db)):
    """Importiert eine Stelle per URL in die Datenbank."""

    # Duplikat-Check
    existing = db.query(Job).filter(Job.source_url == req.url).first()
    if existing:
        return {"status": "already_exists", "job_id": existing.id}

    # HTML laden
    html = ""
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "de-DE,de;q=0.9",
        }) as client:
            resp = await client.get(req.url)
            html = resp.text
    except Exception as e:
        html = ""

    meta = _extract_meta(html, req.url)

    # Manuelle Überschreibung
    title        = req.title        or meta["title"]        or "Unbekannte Stelle"
    company_name = req.company_name or meta["company"]      or "Unbekanntes Unternehmen"
    description  = meta["description"]

    # Quelle aus URL ableiten
    source = "Direkt"
    if "stepstone"  in req.url: source = "Stepstone"
    elif "linkedin" in req.url: source = "LinkedIn"
    elif "indeed"   in req.url: source = "Indeed"
    elif "xing"     in req.url: source = "Xing"
    elif "arbeitsagentur" in req.url: source = "Bundesagentur"

    # Unternehmen anlegen / finden
    company = db.query(Company).filter(Company.name == company_name).first()
    if not company:
        company = Company(name=company_name)
        db.add(company)
        db.flush()

    job = Job(
        company_id  = company.id,
        title       = title,
        source      = source,
        source_url  = req.url,
        description = description,
        match_notes = req.notes or "",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return {
        "status":     "saved",
        "job_id":     job.id,
        "company_id": company.id,
        "extracted":  {"title": title, "company": company_name, "description": description[:200]},
    }


@router.get("/jobs")
def list_imported_jobs(db: Session = Depends(get_db)):
    """Alle importierten Stellen (noch nicht als Bewerbung angelegt)."""
    jobs = db.query(Job).filter(Job.id.notin_(
        db.query(Job.id).join(Job.applications)
    )).all()
    return [
        {
            "id":          j.id,
            "title":       j.title,
            "company":     j.company.name if j.company else "—",
            "source":      j.source,
            "source_url":  j.source_url,
            "match_score": j.match_score,
        }
        for j in jobs
    ]
