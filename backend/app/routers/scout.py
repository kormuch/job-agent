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


class SearchRequest(BaseModel):
    query: str          # z.B. "AI Product Owner Stuttgart"
    max_results: int = 10


@router.post("/search")
async def search_jobs(req: SearchRequest):
    """
    Sucht via DuckDuckGo nach Stellenanzeigen.
    Gibt URLs + Titel zurück — kein Import, nur Vorschau.
    """
    import asyncio

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "de-DE,de;q=0.9",
    }

    # DuckDuckGo HTML-Suche (kein API-Key nötig)
    search_url = "https://html.duckduckgo.com/html/"
    params = {"q": req.query + " Stellenanzeige", "kl": "de-de"}

    results = []
    try:
        await asyncio.sleep(1)
        async with httpx.AsyncClient(headers=headers, timeout=15, follow_redirects=True) as client:
            r = await client.post(search_url, data=params)
            html = r.text

        # Links aus DuckDuckGo-Ergebnis extrahieren
        # DDG wraps links in //duckduckgo.com/l/?uddg=<encoded_url>
        encoded_urls = re.findall(r'uddg=(https?[^&"]+)', html)
        seen = set()
        job_domains = ["stepstone", "linkedin", "indeed", "xing", "monster",
                       "jobware", "jobs.de", "karriere", "stellenanzeigen"]

        for enc in encoded_urls:
            try:
                from urllib.parse import unquote
                url = unquote(enc)
            except Exception:
                url = enc

            if url in seen:
                continue
            seen.add(url)

            # Titel aus DDG-Ergebnis holen
            # Suche nach dem Anchor-Text nahe dieser URL
            title_m = re.search(
                rf'{re.escape(enc[:40])}[^"]*"[^>]*>\s*<[^>]+>([^<]{{5,120}})',
                html
            )
            title = title_m.group(1).strip() if title_m else url

            source = "Web"
            for d in ["stepstone", "linkedin", "indeed", "xing", "jobs.de"]:
                if d in url:
                    source = d.capitalize()
                    break

            # Nur relevante Job-Seiten
            if any(d in url.lower() for d in job_domains) or "job" in url.lower() or "stell" in url.lower():
                results.append({"url": url, "title": title, "source": source})

            if len(results) >= req.max_results:
                break

    except Exception as e:
        return {"results": [], "error": str(e)}

    return {"results": results}


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
