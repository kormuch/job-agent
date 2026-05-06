"""
Gespeicherte Jobsuchen (Personas) — CRUD + Run
Jede Suche ist eine eigene Persona mit CV, System-Prompt, Suchbegriff und Ort.
Deaktivieren statt loeschen — Suchen bleiben reaktivierbar.
"""
import asyncio
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.models import SearchProfile

router = APIRouter(prefix="/searches", tags=["searches"])

JOB_DOMAINS = [
    "stepstone", "linkedin", "indeed", "xing", "monster",
    "jobware", "jobs.de", "karriere", "stellenanzeigen",
    "arbeitsagentur", "jobvector", "absolventa", "heise.de/jobs",
    "glassdoor", "jobs.heise",
    "jobs.ch", "jobup.ch", "jobscout24", "jobwinner", "jobs4it.ch",
    "workable.com",
]

_AGGREGAT = re.compile(
    r"\d[\d\.]*\s+\w*\s*(jobs?|stellen?|stellenangebote?|ergebnisse?|treffer|angebote?|offene)"
    r"|\bjetzt\s+\d"
    r"|\bstellenangebote\b|\bstellenanzeigen\b|\bgehälter?\b|\bgehaelter?\b"
    r"|\bwas\s+macht\s+ein\b|\barbeiten\s+(für|fuer|bei|als)\b"
    r"|jobs?\s+in\s+\w|\d+\s+offene|\boffene\s+stellen\b"
    r"|\balle\b.{0,15}\bjobs?\b|\baktuelle[rns]?\b.{0,30}\bjobs?\b"
    r"|\.de\s*$|\bsuche\b.{0,20}\bjobs?\b|\bfinde\b.{0,20}\bjobs?\b"
    r"|\b\d+\s+aktuelle|\bstellen\s+für\b|\bjobs\s+für\b"
    r"|\bmeinestadt\b|\bjooble\b|\bzuhausejobs\b|\bstartup\s*jobs\b"
    r"|\bremote.*jobs\b|\bhomeoffice.*jobs\b|\bdringend!\b"
    r"|\bvakans[ií]\b|\btuyển\s+dụng\b",
    re.I,
)
_LIST_URL = re.compile(
    r"/search|/jobs\?|/ergebnisse|/suchergebnis|query=|/jobs/search"
    r"|[?&]q=|indeed\.com/jobs(?!/\d)|indeed\.com/q-"
    r"|/gehalt|/salary|/ratgeber|/karrieretipps"
    r"|/stellen\?|/stellenangebote\?|/stellenanzeigen\?"
    r"|jobs\.de/(?:suche|branchen|berufe)|glassdoor\.de/Job/jobs\.htm"
    r"|meinestadt\.de|jooble\.|zuhausejobs|startupjobs"
    r"|linkedin\.com/in/|xing\.com/profile/|xing\.com/xing/",
    re.I,
)

GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"
_CFG_PATH  = Path(__file__).resolve().parents[3] / "db" / "config.json"


def _load_config():
    if _CFG_PATH.exists():
        try:
            return json.loads(_CFG_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _global_groq_key():
    import os
    return os.getenv("GROQ_API_KEY") or _load_config().get("groq_api_key", "")


def _global_gemini_key():
    import os
    return os.getenv("GEMINI_API_KEY") or _load_config().get("gemini_api_key", "")


def _detect_source(url):
    u = url.lower()
    for p in ["stepstone", "linkedin", "indeed", "xing", "glassdoor"]:
        if p in u: return p.capitalize()
    for p in ["jobs.ch", "jobup.ch", "jobscout24", "workable.com"]:
        if p in u: return p
    return "Web"


def _fix_title(t: str) -> str:
    t = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def _parse_title_company(raw):
    cleaned = re.split(r"\s*[|·]\s*(?=[^|·]*$)", raw, maxsplit=1)[0].strip()
    m = re.split(r"\s+[-–—]\s+|\s+bei\s+|\s+@\s+", cleaned, maxsplit=1)
    if len(m) == 2:
        return _fix_title(m[0].strip()), m[1].strip()
    return _fix_title(cleaned), ""


def _run_ddg(query, max_results=15):
    try:
        from ddgs import DDGS
        raw = list(DDGS().text(query, max_results=max_results * 3))
        results = []
        for item in raw:
            url   = item.get("href", "")
            title = item.get("title", "") or url
            if not url or len(title.strip()) < 10:
                continue
            if re.search(r'\b20(1\d|2[0-3])\b', title):
                continue
            if re.search(r'[А-Яа-яЁё]', title):
                continue
            if _AGGREGAT.search(title) or _LIST_URL.search(url):
                continue
            url_low = url.lower()
            if (any(d in url_low for d in JOB_DOMAINS)
                    or "job" in url_low
                    or "stell" in url_low
                    or "karriere" in url_low):
                job_title, company = _parse_title_company(title)
                results.append({
                    "url": url,
                    "title": job_title,
                    "company": company,
                    "source": _detect_source(url),
                })
            if len(results) >= max_results:
                break
        return results
    except Exception:
        return []


async def _generate_queries(profile):
    base = profile.query + (" " + profile.location if profile.location else "")
    default = [base]
    groq_key   = _global_groq_key()
    gemini_key = _global_gemini_key()
    prompt_text = (profile.system_prompt or "").strip()
    if not prompt_text or not (groq_key or gemini_key):
        return default
    llm_prompt = (
        "Basierend auf diesem Kandidaten-Profil und Suchbegriff, generiere genau 5 "
        "DuckDuckGo-Suchbegriffe fuer Stellenanzeigen.\n"
        "Antworte NUR mit einem JSON-Array von Strings. Keine Erklaerung, kein Markdown.\n"
        f"Suchbegriff: {profile.query}\n"
        f"Zielort: {profile.location or 'flexibel'}\n\n"
        f"Kandidaten-Profil:\n{prompt_text[:1200]}"
    )
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            if groq_key:
                r = await client.post(
                    GROQ_URL,
                    json={
                        "model": GROQ_MODEL,
                        "messages": [{"role": "user", "content": llm_prompt}],
                        "temperature": 0.3,
                        "max_tokens": 200,
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
                return parsed[:5] or default
    except Exception:
        pass
    return default


class SearchProfileIn(BaseModel):
    name:          str
    query:         str
    location:      str | None = None
    cv_text:       str | None = None
    system_prompt: str | None = None


class SearchProfileUpdate(BaseModel):
    name:          str | None = None
    query:         str | None = None
    location:      str | None = None
    cv_text:       str | None = None
    system_prompt: str | None = None


def _serialize(p):
    return {
        "id":            p.id,
        "name":          p.name,
        "query":         p.query,
        "location":      p.location,
        "cv_text":       p.cv_text or "",
        "system_prompt": p.system_prompt or "",
        "active":        bool(p.active) if p.active is not None else True,
    }


@router.get("/")
def list_searches(db: Session = Depends(get_db)):
    profiles = db.query(SearchProfile).order_by(SearchProfile.id).all()
    return [_serialize(p) for p in profiles]


@router.post("/")
def create_search(body: SearchProfileIn, db: Session = Depends(get_db)):
    p = SearchProfile(
        name=body.name,
        query=body.query,
        location=body.location,
        cv_text=body.cv_text,
        system_prompt=body.system_prompt,
        active=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _serialize(p)


@router.patch("/{search_id}")
def update_search(search_id: int, body: SearchProfileUpdate, db: Session = Depends(get_db)):
    p = db.query(SearchProfile).filter(SearchProfile.id == search_id).first()
    if not p:
        return {"error": "nicht gefunden"}
    if body.name          is not None: p.name          = body.name
    if body.query         is not None: p.query         = body.query
    if body.location      is not None: p.location      = body.location
    if body.cv_text       is not None: p.cv_text       = body.cv_text
    if body.system_prompt is not None: p.system_prompt = body.system_prompt
    db.commit()
    db.refresh(p)
    return _serialize(p)


@router.post("/{search_id}/toggle")
def toggle_active(search_id: int, db: Session = Depends(get_db)):
    p = db.query(SearchProfile).filter(SearchProfile.id == search_id).first()
    if not p:
        return {"error": "nicht gefunden"}
    p.active = not bool(p.active)
    db.commit()
    return _serialize(p)


@router.post("/{search_id}/run")
async def run_search(search_id: int, db: Session = Depends(get_db)):
    p = db.query(SearchProfile).filter(SearchProfile.id == search_id).first()
    if not p:
        return {"results": [], "error": "Suche nicht gefunden"}
    queries = await _generate_queries(p)
    loop = asyncio.get_event_loop()
    all_results, seen = [], set()
    for q in queries:
        with ThreadPoolExecutor() as pool:
            results = await loop.run_in_executor(pool, _run_ddg, q, 12)
        for r in results:
            if r["url"] not in seen:
                seen.add(r["url"])
                all_results.append(r)
        await asyncio.sleep(0.4)
    return {"results": all_results, "queries_used": queries}
