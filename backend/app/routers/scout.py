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
from ..models.models import Company, Job, Application

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
        meta("publisher") or
        meta("application-name") or
        ""
    )
    # Versuche JSON-LD hiringOrganization für alle Quellen
    if not company:
        m = re.search(r'"hiringOrganization"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"', html)
        if m: company = m.group(1)
    # Versuche employer name aus strukturierten Daten
    if not company:
        m = re.search(r'"employerName"\s*:\s*"([^"]+)"', html)
        if m: company = m.group(1)
    # Aus Titel extrahieren: "Jobtitel - Firma | ..." oder "Jobtitel bei Firma"
    if not company and title:
        m = re.split(r"\s*[|\-–—]\s*", title)
        if len(m) >= 2:
            company = m[-1].strip()  # letztes Segment ist oft die Firma
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

    # Mojibake-Fix (latin-1 fälschlich als Encoding genutzt)
    def _fix_encoding(s: str) -> str:
        try:
            return s.encode('latin-1').decode('utf-8')
        except (UnicodeDecodeError, UnicodeEncodeError):
            return s

    title   = _fix_encoding(title)
    company = _fix_encoding(company)

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
        in_pipeline = db.query(Application).filter(Application.job_id == existing.id).first() is not None
        return {"status": "already_exists", "job_id": existing.id, "in_pipeline": in_pipeline}

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
    description  = meta["description"]

    # Firma: manuell → extrahiert → Domain als letzter Fallback
    if req.company_name:
        company_name = req.company_name
    elif meta["company"]:
        company_name = meta["company"]
    else:
        # Aus JSON-LD name-Felder versuchen
        m2 = re.search(r'"name"\s*:\s*"([^"]{3,80})"', html)
        if m2:
            company_name = m2.group(1).strip()
        else:
            # Domain als Fallback — nie "Unbekannt"
            m3 = re.search(r"https?://(?:www\.)?([^/]+)", req.url)
            if m3:
                domain = m3.group(1)
                company_name = domain.split(".")[0].capitalize()
            else:
                company_name = title.split()[0] if title else "—"

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
    Sucht via ddgs-Bibliothek nach Stellenanzeigen.
    Gibt URLs + Titel zurück — kein Import, nur Vorschau.
    """
    import asyncio
    from concurrent.futures import ThreadPoolExecutor

    job_domains = ["stepstone", "linkedin", "indeed", "xing", "monster",
                   "jobware", "jobs.de", "karriere", "stellenanzeigen",
                   "arbeitsagentur", "jobvector", "absolventa", "heise.de/jobs",
                   "glassdoor", "jobs.heise"]

    _aggregat_patterns = re.compile(
        r"\d[\d\.]*\s+\w*\s*(jobs?|stellen?|stellenangebote?|ergebnisse?|treffer|angebote?|offene)"
        r"|\bjetzt\s+\d"
        r"|\bstellenangebote\b|\bstellenanzeigen\b|\bgehälter?\b"
        r"|\bwas\s+macht\s+ein\b|\barbeiten\s+(für|bei|als)\b"
        r"|jobs?\s+in\s+\w|\d+\s+offene|\boffene\s+stellen\b"
        r"|\balle\b.{0,15}\bjobs?\b|\baktuelle[rns]?\b.{0,30}\bjobs?\b"
        r"|\.de\s*$|\bsuche\b.{0,20}\bjobs?\b|\bfinde\b.{0,20}\bjobs?\b"
        r"|\b\d+\s+aktuelle|\bstellen\s+für\b|\bjobs\s+für\b"
        r"|\bmeinestadt\b|\bjooble\b|\bzuhausejobs\b|\bstartup\s*jobs\b"
        r"|\bremote.*jobs\b|\bhomeoffice.*jobs\b|\bdringend!\b"
        r"|\bvakans[ií]\b|\btuyển\s+dụng\b",   # nicht-deutsche Ergebnisse
        re.I,
    )
    _list_url_patterns = re.compile(
        r"/search|/jobs\?|/ergebnisse|/suchergebnis|query=|/jobs/search"
        r"|[?&]q=|indeed\.com/jobs(?!/\d)|indeed\.com/q-"
        r"|/gehalt|/salary|/ratgeber|/karrieretipps|/karriere-tipps"
        r"|/stellen\?|/stellenangebote\?|/stellenanzeigen\?"
        r"|jobs\.de/(?:suche|branchen|berufe)|glassdoor\.de/Job/jobs\.htm"
        r"|meinestadt\.de|jooble\.|zuhausejobs|startupjobs"
        r"|linkedin\.com/in/|xing\.com/profile/|xing\.com/xing/",  # Personenprofile
        re.I,
    )

    def _fix_title(t: str) -> str:
        """CamelCase aufbrechen und Leerzeichen normalisieren."""
        t = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', t)
        return re.sub(r'\s+', ' ', t).strip()

    def _parse_title_company(raw_title: str, source: str) -> tuple[str, str]:
        cleaned = re.split(r"\s*[|·]\s*(?=[^|·]*$)", raw_title, maxsplit=1)[0].strip()
        m = re.split(r"\s+[-–—]\s+|\s+bei\s+|\s+@\s+", cleaned, maxsplit=1)
        if len(m) == 2:
            return _fix_title(m[0].strip()), m[1].strip()
        return _fix_title(cleaned), ""

    def _sync_search():
        try:
            from ddgs import DDGS
            raw = list(DDGS().text(
                req.query + " Stelle",
                region="de-de",
                max_results=req.max_results * 3,
            ))
            results = []
            for item in raw:
                url   = item.get("href", "")
                title = item.get("title", "") or url
                if not url:
                    continue
                if len(title.strip()) < 10:
                    continue
                # Jahreszahlen (alte Ergebnisse)
                if re.search(r'\b20(1\d|2[0-3])\b', title):
                    continue
                # Kyrillisch / nicht-deutsch
                if re.search(r'[А-Яа-яЁё]', title):
                    continue
                if _aggregat_patterns.search(title):
                    continue
                if _list_url_patterns.search(url):
                    continue
                if re.match(r"^\d+\s+\w+\s+\w+$", title.strip()):
                    continue

                source = "Web"
                for d in ["stepstone", "linkedin", "indeed", "xing", "jobs.de", "glassdoor"]:
                    if d in url.lower():
                        source = d.capitalize()
                        break
                url_low = url.lower()
                if (any(d in url_low for d in job_domains)
                        or "job" in url_low
                        or "stell" in url_low
                        or "karriere" in url_low):
                    job_title, company = _parse_title_company(title, source)
                    results.append({
                        "url": url,
                        "title": job_title,
                        "company": company,
                        "source": source,
                    })
                if len(results) >= req.max_results:
                    break
            return results
        except Exception:
            return []

    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as pool:
        results = await loop.run_in_executor(pool, _sync_search)

    return {"results": results}


@router.post("/auto-search")
async def auto_search(max_results: int = 8):
    """
    Liest den Such-Prompt aus config.json, lässt das LLM Suchqueries generieren
    und führt diese gegen DuckDuckGo aus. Gibt alle gefundenen Stellen zurück.
    """
    import json
    import sys
    from pathlib import Path

    # Config + Prompt laden
    cfg_path = Path(__file__).resolve().parents[3] / "db" / "config.json"
    config = {}
    if cfg_path.exists():
        try:
            config = json.loads(cfg_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    system_prompt = config.get("system_prompt", "").strip()
    groq_key   = config.get("groq_api_key", "")
    gemini_key = config.get("gemini_api_key", "")

    # Fallback-Queries wenn kein Prompt oder kein Key
    default_queries = [
        "AI Product Owner Stuttgart",
        "Head of AI München Remote",
        "AI Solution Architect Stuttgart",
        "AI Solution Architect Remote Deutschland",
        "AI Consultant Stuttgart",
        "AI Consultant München Remote",
        "Technical Product Manager AI Stuttgart",
        "LLM Product Manager Remote Deutschland",
        "Product Owner Digital Baden-Württemberg",
        "Product Owner Softwareentwicklung Stuttgart",
    ]

    queries = default_queries

    if system_prompt and (groq_key or gemini_key):
        try:
            llm_prompt = f"""Basierend auf diesem Kandidaten-Profil, generiere genau 8 DuckDuckGo-Suchbegriffe für Stellenanzeigen.
Antworte NUR mit einem JSON-Array von Strings. Keine Erklärung, kein Markdown.
Berücksichtige folgende Zieltitel: AI Product Owner, AI Consultant, AI Solution Architect, Head of AI, Technical Product Manager AI, LLM Product Manager.
Zielregionen: Stuttgart, München, Tübingen, Remote Deutschland, Baden-Württemberg.
Beispiel: ["AI Product Owner Stuttgart", "AI Solution Architect Remote Deutschland", "AI Consultant München", ...]

Kandidaten-Profil:
{system_prompt[:1500]}"""

            async with httpx.AsyncClient(timeout=20) as client:
                if groq_key:
                    r = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        json={
                            "model": "llama-3.3-70b-versatile",
                            "messages": [{"role": "user", "content": llm_prompt}],
                            "temperature": 0.3,
                            "max_tokens": 256,
                        },
                        headers={"Authorization": f"Bearer {groq_key}"},
                    )
                    raw = r.json()["choices"][0]["message"]["content"]
                else:
                    r = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}",
                        json={"contents": [{"parts": [{"text": llm_prompt}]}]},
                    )
                    raw = r.json()["candidates"][0]["content"]["parts"][0]["text"]

            raw = re.sub(r"```(?:json)?", "", raw).strip()
            m = re.search(r"\[.*\]", raw, re.S)
            if m:
                parsed = json.loads(m.group(0))
                if isinstance(parsed, list) and all(isinstance(q, str) for q in parsed):
                    queries = parsed[:8]
        except Exception:
            queries = default_queries

    # Suchen
    import asyncio
    all_results = []
    seen_urls: set = set()
    for q in queries:
        try:
            r = await search_jobs(SearchRequest(query=q, max_results=max_results))
            for item in r.get("results", []):
                if item["url"] not in seen_urls:
                    seen_urls.add(item["url"])
                    all_results.append(item)
        except Exception:
            pass
        await asyncio.sleep(0.5)

    return {"results": all_results, "queries_used": queries}


@router.post("/fetch-description/{job_id}")
async def fetch_description(job_id: int, db: Session = Depends(get_db)):
    """Re-fetcht die Stellenbeschreibung für einen Job aus der hinterlegten source_url."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job or not job.source_url:
        return {"status": "error", "detail": "Kein Job oder keine URL gefunden"}

    html = ""
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "de-DE,de;q=0.9",
        }) as client:
            resp = await client.get(job.source_url)
            html = resp.text
    except Exception:
        return {"status": "error", "detail": "URL nicht erreichbar"}

    meta = _extract_meta(html, job.source_url)
    description = meta.get("description", "")

    if description:
        job.description = description
        db.commit()
        return {"status": "ok", "description": description}
    return {"status": "empty", "description": ""}


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
