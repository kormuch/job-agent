"""
Orchestrator Router — A2A Pipeline Endpoint

POST /orchestrator/run
  Startet den vollständigen A2A-Lauf:
  ScoutAgent → MatchAgent → FilterAgent (Guardrail)

POST /orchestrator/run/auto
  Wie /run, aber Queries werden per LLM aus dem System-Prompt generiert
  (identisch zu /scout/auto-search).
"""
import json
import os
import re
import httpx
from pathlib import Path
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..agents.pipeline import OrchestratorAgent

router = APIRouter(prefix="/orchestrator", tags=["orchestrator"])

_ROOT     = Path(__file__).resolve().parents[3]
_CFG_PATH = _ROOT / "db" / "config.json"

_DEFAULT_QUERIES = [
    "AI Product Owner Stuttgart",
    "AI Consultant Remote Deutschland",
    "AI Solution Architect München",
    "Agentic AI Consultant Remote",
    "LLM Product Manager Stuttgart",
    "Head of AI Baden-Württemberg",
]


class RunRequest(BaseModel):
    queries:       list[str] = _DEFAULT_QUERIES
    min_score:     int       = 60
    max_per_query: int       = 5


@router.post("/run")
async def run_pipeline(req: RunRequest, db: Session = Depends(get_db)):
    """
    Startet die A2A-Pipeline mit expliziten Queries.
    Gibt Run-Summary, gefilterte Ergebnisse und Agent-Log zurück.
    """
    orchestrator = OrchestratorAgent()
    return await orchestrator.run(
        db            = db,
        queries       = req.queries,
        min_score     = req.min_score,
        max_per_query = req.max_per_query,
    )


@router.post("/run/auto")
async def run_pipeline_auto(
    min_score:     int = 60,
    max_per_query: int = 5,
    db: Session = Depends(get_db),
):
    """
    Generiert Queries per LLM aus dem System-Prompt, dann startet die A2A-Pipeline.
    Fallback auf Default-Queries wenn kein Key / kein Prompt vorhanden.
    """
    queries = await _generate_queries()
    orchestrator = OrchestratorAgent()
    return await orchestrator.run(
        db            = db,
        queries       = queries,
        min_score     = min_score,
        max_per_query = max_per_query,
    )


async def _generate_queries() -> list[str]:
    """Lässt das LLM passende Suchqueries aus dem System-Prompt ableiten."""
    groq_key   = os.getenv("GROQ_API_KEY", "")
    gemini_key = os.getenv("GEMINI_API_KEY", "")

    config = {}
    if _CFG_PATH.exists():
        try:
            config = json.loads(_CFG_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass

    system_prompt = config.get("system_prompt", "").strip()

    if not system_prompt or not (groq_key or gemini_key):
        return _DEFAULT_QUERIES

    prompt = f"""Generiere genau 8 DuckDuckGo-Suchbegriffe für Stellenanzeigen.
Antworte NUR mit einem JSON-Array von Strings. Kein Markdown, keine Erklärung.
Zielregionen: Stuttgart, München, Remote Deutschland, Baden-Württemberg.

Kandidaten-Profil:
{system_prompt[:1500]}"""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            if groq_key:
                r = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": prompt}],
                          "temperature": 0.3, "max_tokens": 256},
                    headers={"Authorization": f"Bearer {groq_key}"},
                )
                raw = r.json()["choices"][0]["message"]["content"]
            else:
                r = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}",
                    json={"contents": [{"parts": [{"text": prompt}]}]},
                )
                raw = r.json()["candidates"][0]["content"]["parts"][0]["text"]

        raw = re.sub(r"```(?:json)?", "", raw).strip()
        m = re.search(r"\[.*\]", raw, re.S)
        if m:
            parsed = json.loads(m.group(0))
            if isinstance(parsed, list) and all(isinstance(q, str) for q in parsed):
                return parsed[:8]
    except Exception:
        pass

    return _DEFAULT_QUERIES
