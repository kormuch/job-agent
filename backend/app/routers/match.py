"""
Match Scorer — CV vs. Stellenbeschreibung via Gemini Free Tier
- GET  /match/cv              → aktuellen CV-Text lesen
- POST /match/cv              → CV-Text speichern
- POST /match/config          → Gemini API Key speichern
- POST /match/{job_id}        → Score berechnen + in DB speichern
- POST /match/text            → Ad-hoc Score (Text direkt übergeben, kein DB-Job nötig)
"""
import re
import json
import os
import httpx
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.models import Job

router = APIRouter(prefix="/match", tags=["match"])

# Pfade
_ROOT    = Path(__file__).resolve().parents[3]
_CV_PATH = _ROOT / "db" / "cv.md"
_CFG_PATH = _ROOT / "db" / "config.json"

GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_URL   = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"


# ── Config / CV I/O ───────────────────────────────────────────────────────────

def _load_config() -> dict:
    if _CFG_PATH.exists():
        try:
            return json.loads(_CFG_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}

def _save_config(data: dict):
    """Speichert nicht-geheime Felder (system_prompt) in config.json."""
    existing = _load_config()
    existing.update(data)
    _CFG_PATH.write_text(json.dumps(existing, indent=2), encoding="utf-8")

def _save_env_key(env_name: str, value: str):
    """Schreibt API-Key in .env und aktualisiert den laufenden Prozess (kein Restart nötig)."""
    env_path = _ROOT / ".env"
    lines = env_path.read_text(encoding="utf-8").splitlines() if env_path.exists() else []
    prefix = f"{env_name}="
    found = False
    new_lines = []
    for line in lines:
        if line.startswith(prefix):
            new_lines.append(f"{env_name}={value}")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"{env_name}={value}")
    env_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    os.environ[env_name] = value  # sofort wirksam ohne Neustart

def _get_gemini_key() -> str:
    return os.getenv("GEMINI_API_KEY", "")

def _get_groq_key() -> str:
    return os.getenv("GROQ_API_KEY", "")

def _get_api_key() -> str:
    return _get_groq_key() or _get_gemini_key()

def _get_cv() -> str:
    if _CV_PATH.exists():
        return _CV_PATH.read_text(encoding="utf-8").strip()
    return ""


# ── Gemini API Call ───────────────────────────────────────────────────────────

async def _call_groq(prompt: str, api_key: str) -> str:
    payload = {
        "model": GROQ_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 1024,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            GROQ_URL,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]


async def _call_gemini(prompt: str, api_key: str) -> str:
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{GEMINI_URL}?key={api_key}",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        r.raise_for_status()
        data = r.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def _call_llm(prompt: str) -> str:
    """Ruft Groq (bevorzugt) oder Gemini auf. Fallback bei 429/5xx."""
    groq_key = _get_groq_key()
    gemini_key = _get_gemini_key()

    if groq_key:
        try:
            return await _call_groq(prompt, groq_key)
        except httpx.HTTPStatusError as e:
            if e.response.status_code in (429, 500, 502, 503) and gemini_key:
                return await _call_gemini(prompt, gemini_key)
            raise

    if gemini_key:
        return await _call_gemini(prompt, gemini_key)
    raise ValueError("Kein API Key (Groq oder Gemini) hinterlegt.")


def _build_prompt(cv_text: str, job_text: str) -> str:
    # Sicherheit: externe Inhalte in XML-Tags kapseln, Länge begrenzen
    cv_safe  = cv_text[:4000]
    job_safe = job_text[:3000]
    system = _get_system_prompt()
    persona_block = f"\n\nPersönliche Präferenzen des Kandidaten:\n{system[:1000]}\n" if system else ""
    return f"""Du bist ein neutraler Karriere-Assistent. Bewerte wie gut der Kandidat zur Stelle passt.{persona_block}

Antworte NUR mit gültigem JSON (kein Markdown, keine Erklärung davor/danach):
{{"score": <0-100>, "strengths": ["...", "..."], "gaps": ["...", "..."], "summary": "...", "salary_min": <Jahresgehalt-Untergrenze in EUR oder null>, "salary_max": <Jahresgehalt-Obergrenze in EUR oder null>}}

Gehaltsschätzung: Leite aus Jobtitel, Seniorität, Branche, Standort und Anforderungen eine realistische Brutto-Jahresgehaltsspanne (Min/Max) in EUR ab. Falls die Stelle ein Gehalt nennt, übernimm es. Falls nicht ableitbar, setze null.

Bewertungsskala:
80-100 = Sehr guter Match, fast alle Anforderungen erfüllt
60-79  = Guter Match, kleinere Lücken
40-59  = Teilweiser Match, deutliche Lücken
0-39   = Schwacher Match

<cv>
{cv_safe}
</cv>

<job_description>
{job_safe}
</job_description>"""


def _parse_score_response(text: str) -> dict:
    # JSON aus der Antwort extrahieren (Gemini gibt manchmal Markdown-Wrapper zurück)
    text = re.sub(r"```(?:json)?", "", text).strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("Kein JSON in Antwort")
    data = json.loads(m.group(0))
    score = int(data.get("score", 0))
    if not 0 <= score <= 100:
        raise ValueError("Score außerhalb 0-100")
    salary_min = data.get("salary_min")
    salary_max = data.get("salary_max")
    return {
        "score":      score,
        "strengths":  data.get("strengths", [])[:5],
        "gaps":       data.get("gaps", [])[:5],
        "summary":    str(data.get("summary", ""))[:500],
        "salary_min": int(salary_min) if salary_min is not None else None,
        "salary_max": int(salary_max) if salary_max is not None else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

class CvBody(BaseModel):
    text: str

class ConfigBody(BaseModel):
    gemini_api_key: str | None = None
    groq_api_key:   str | None = None
    system_prompt:  str | None = None

class TextMatchBody(BaseModel):
    job_text: str

@router.get("/cv")
def get_cv():
    return {"text": _get_cv()}

@router.post("/cv")
def save_cv(body: CvBody):
    _CV_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CV_PATH.write_text(body.text.strip(), encoding="utf-8")
    return {"saved": True, "chars": len(body.text)}

def _get_system_prompt() -> str:
    return _load_config().get("system_prompt", "")

@router.post("/config")
def save_config(body: ConfigBody):
    if body.groq_api_key is not None:
        _save_env_key("GROQ_API_KEY", body.groq_api_key.strip())
    if body.gemini_api_key is not None:
        _save_env_key("GEMINI_API_KEY", body.gemini_api_key.strip())
    if body.system_prompt is not None:
        _save_config({"system_prompt": body.system_prompt.strip()})
    return {"saved": True}

@router.get("/config")
def get_config():
    groq   = _get_groq_key()
    gemini = _get_gemini_key()
    active = groq or gemini
    provider = "Groq" if groq else ("Gemini" if gemini else "")
    masked = (active[:8] + "…") if len(active) > 8 else ("" if not active else "…")
    return {
        "gemini_key_set":    bool(gemini),
        "groq_key_set":      bool(groq),
        "active_provider":   provider,
        "gemini_key_preview": masked,
        "system_prompt":     _get_system_prompt(),
        "model":             GROQ_MODEL if groq else (GEMINI_MODEL if gemini else ""),
    }


@router.post("/{job_id}")
async def score_job(job_id: int, db: Session = Depends(get_db)):
    if not _get_api_key():
        raise HTTPException(status_code=400, detail="Kein API Key hinterlegt (Groq oder Gemini).")

    cv = _get_cv()
    if not cv:
        raise HTTPException(status_code=400, detail="Kein CV hinterlegt.")

    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job nicht gefunden.")

    job_text = f"{job.title}\n{job.company.name if job.company else ''}\n{job.description or ''}"

    prompt = _build_prompt(cv, job_text)
    try:
        raw = await _call_llm(prompt)
        result = _parse_score_response(raw)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"LLM API Fehler: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Score-Berechnung fehlgeschlagen: {str(e)}")

    # In DB speichern
    job.match_score = result["score"]
    job.match_notes = json.dumps({
        "strengths": result["strengths"],
        "gaps":      result["gaps"],
        "summary":   result["summary"],
    }, ensure_ascii=False)
    db.commit()

    return result


@router.post("/text/score")
async def score_text(body: TextMatchBody):
    """Ad-hoc Score ohne DB-Job — direkt Text übergeben."""
    if not _get_api_key():
        raise HTTPException(status_code=400, detail="Kein API Key hinterlegt (Groq oder Gemini).")

    cv = _get_cv()
    if not cv:
        raise HTTPException(status_code=400, detail="Kein CV hinterlegt.")

    prompt = _build_prompt(cv, body.job_text)
    try:
        raw = await _call_llm(prompt)
        return _parse_score_response(raw)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"LLM API Fehler: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Score-Berechnung fehlgeschlagen: {str(e)}")
