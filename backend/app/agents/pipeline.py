"""
A2A Pipeline — Agent-to-Agent Jobsuche

Architektur:
  OrchestratorAgent
    → ScoutAgent     (DuckDuckGo-Suche + DB-Import)
    → MatchAgent     (LLM-Scoring je Job)
    → FilterAgent    (Guardrail: Score-Schwelle)

Jeder Agent hat eine run()-Methode und gibt sein Ergebnis
an den Orchestrator zurück, der es an den nächsten Agent weitergibt.
"""
import re
import asyncio
import json
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.orm import Session

from ..models.models import Company, Job
from ..routers.match import (
    _call_llm,
    _build_prompt,
    _parse_score_response,
    _get_cv,
    _get_api_key,
)


# ── Scout Agent ───────────────────────────────────────────────────────────────

class ScoutAgent:
    """
    Sucht über DuckDuckGo nach Stellenanzeigen und importiert neue Jobs in die DB.
    Gibt job_ids aller neu angelegten Jobs zurück.
    """

    _job_domains = [
        "stepstone", "linkedin", "indeed", "xing", "monster",
        "jobware", "jobs.de", "karriere", "stellenanzeigen",
        "arbeitsagentur", "jobvector", "absolventa", "heise.de/jobs",
        "glassdoor", "jobs.heise",
    ]
    _skip_url = re.compile(
        r"/search|/jobs\?|query=|[?&]q=|/gehalt|/salary|/ratgeber"
        r"|indeed\.com/q-|linkedin\.com/in/|xing\.com/profile/"
        # Aggregator-Listenseiten (keine Einzelstellen)
        r"|glassdoor\.[a-z]+/Job/.+-jobs-SRCH"
        r"|himalayas\.app/jobs/(?:countries|remote|categories)"
        r"|remoterocketship\.com(?!/de/unternehmen/[^/]+/stellen/[^/]+/)"
        r"|ycombinator\.com/jobs(?!\?nav=)"
        r"|jobs\.de/(?:suche|branchen)|meinestadt\.de|jooble\."
        r"|/jobs/search|/jobs\?page=|/jobs/countries/",
        re.I,
    )
    _skip_title = re.compile(
        r"\d[\d\.]*\s+\w*\s*(jobs?|stellen?)|jetzt\s+\d"
        r"|\bstellenangebote\b|\bgehälter?\b|[А-Яа-я]"
        # Aggregator-Titel
        r"|\d+\s+\w+\s+jobs?\s+in\b|\bjobs?\s+in\s+\w+,\s*\w+\s+\d{4}"
        r"|\bjobs?\s+at\b.{0,30}\||\bremote\s+\w+\s+jobs?\s+in\b",
        re.I,
    )

    async def run(
        self,
        queries: list[str],
        db: Session,
        max_per_query: int = 5,
    ) -> dict:
        """
        Führt Suchen durch, importiert neue Jobs.
        Gibt {imported: [...], skipped_duplicates: int} zurück.
        """
        all_candidates = await self._search_all(queries, max_per_query)
        imported = []
        skipped = 0

        for candidate in all_candidates:
            result = await self._import_one(candidate, db)
            if result["status"] == "saved":
                imported.append({
                    "job_id":  result["job_id"],
                    "title":   candidate.get("title", ""),
                    "company": candidate.get("company", ""),
                    "url":     candidate["url"],
                })
            else:
                skipped += 1

        return {"imported": imported, "skipped_duplicates": skipped}

    async def _search_all(self, queries: list[str], max_per_query: int) -> list[dict]:
        seen: set[str] = set()
        results = []

        def _ddgs_search(query: str) -> list[dict]:
            try:
                from ddgs import DDGS
                raw = list(DDGS().text(query + " Stelle", region="de-de", max_results=max_per_query * 3))
                found = []
                for item in raw:
                    url   = item.get("href", "")
                    title = item.get("title", "")
                    if not url or len(title) < 10:
                        continue
                    if self._skip_url.search(url) or self._skip_title.search(title):
                        continue
                    url_low = url.lower()
                    if any(d in url_low for d in self._job_domains) or "job" in url_low or "stell" in url_low:
                        src = next((d.capitalize() for d in ["stepstone","linkedin","indeed","xing"] if d in url_low), "Web")
                        found.append({"url": url, "title": title, "company": "", "source": src})
                    if len(found) >= max_per_query:
                        break
                return found
            except Exception:
                return []

        loop = asyncio.get_event_loop()
        for query in queries:
            with ThreadPoolExecutor() as pool:
                batch = await loop.run_in_executor(pool, _ddgs_search, query)
            for item in batch:
                if item["url"] not in seen:
                    seen.add(item["url"])
                    results.append(item)
            await asyncio.sleep(0.4)

        return results

    async def _import_one(self, candidate: dict, db: Session) -> dict:
        import httpx
        from ..routers.scout import _extract_meta

        url = candidate["url"]

        existing = db.query(Job).filter(Job.source_url == url).first()
        if existing:
            return {"status": "already_exists", "job_id": existing.id}

        html = ""
        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                              "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            }) as client:
                resp = await client.get(url)
                html = resp.text
        except Exception:
            pass

        meta = _extract_meta(html, url)
        title        = candidate.get("title") or meta["title"] or "Unbekannte Stelle"
        company_name = candidate.get("company") or meta["company"] or url.split("/")[2]
        description  = meta["description"]

        source = "Web"
        for s in ["stepstone", "linkedin", "indeed", "xing"]:
            if s in url.lower():
                source = s.capitalize()
                break

        company = db.query(Company).filter(Company.name == company_name).first()
        if not company:
            company = Company(name=company_name)
            db.add(company)
            db.flush()

        job = Job(
            company_id  = company.id,
            title       = title,
            source      = source,
            source_url  = url,
            description = description,
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        return {"status": "saved", "job_id": job.id}


# ── Match Agent ───────────────────────────────────────────────────────────────

class MatchAgent:
    """
    Bewertet jeden importierten Job gegen den CV via LLM.
    Gibt Liste von {job_id, title, score, strengths, gaps, summary} zurück.
    """

    async def run(self, job_ids: list[int], db: Session) -> list[dict]:
        cv = _get_cv()
        if not cv or not _get_api_key():
            return []

        results = []
        for job_id in job_ids:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                continue
            try:
                job_text = f"{job.title}\n{job.company.name if job.company else ''}\n{job.description or ''}"
                prompt   = _build_prompt(cv, job_text)
                raw      = await _call_llm(prompt)
                scored   = _parse_score_response(raw)

                job.match_score = scored["score"]
                job.match_notes = json.dumps({
                    "strengths": scored["strengths"],
                    "gaps":      scored["gaps"],
                    "summary":   scored["summary"],
                }, ensure_ascii=False)
                db.commit()

                results.append({
                    "job_id":    job_id,
                    "title":     job.title,
                    "company":   job.company.name if job.company else "",
                    "source_url": job.source_url,
                    **scored,
                })
            except Exception as e:
                results.append({"job_id": job_id, "title": job.title if job else "?", "score": 0, "error": str(e)})

            await asyncio.sleep(2.5)  # Groq rate limit: 30 req/min → ~2s pro Request

        return results


# ── Filter Agent (Guardrail) ──────────────────────────────────────────────────

class FilterAgent:
    """
    Guardrail: Lässt nur Jobs über dem Score-Schwellenwert durch.
    Verhindert, dass schlechte Matches in der Pipeline auftauchen.
    """

    def run(self, scored_jobs: list[dict], min_score: int = 60) -> dict:
        errored   = [j for j in scored_jobs if "error" in j]
        scorable  = [j for j in scored_jobs if "error" not in j]
        passed    = [j for j in scorable if j.get("score", 0) >= min_score]
        rejected  = [j for j in scorable if j.get("score", 0) < min_score]

        return {
            "passed":          passed,
            "rejected_count":  len(rejected),
            "errored_count":   len(errored),
            "min_score":       min_score,
        }


# ── Orchestrator Agent ────────────────────────────────────────────────────────

class OrchestratorAgent:
    """
    Koordiniert den A2A-Pipeline-Lauf:
      ScoutAgent → MatchAgent → FilterAgent

    Gibt ein vollständiges Run-Summary zurück.
    """

    def __init__(self):
        self.scout  = ScoutAgent()
        self.match  = MatchAgent()
        self.filter = FilterAgent()

    async def run(
        self,
        db: Session,
        queries: list[str],
        min_score: int = 60,
        max_per_query: int = 5,
    ) -> dict:
        log: list[str] = []

        # ── Schritt 1: Scout ──────────────────────────────────────────────────
        log.append(f"[ScoutAgent] Starte Suche mit {len(queries)} Queries...")
        scout_result = await self.scout.run(queries, db, max_per_query)
        imported     = scout_result["imported"]
        log.append(
            f"[ScoutAgent] {len(imported)} neue Jobs importiert, "
            f"{scout_result['skipped_duplicates']} Duplikate übersprungen"
        )

        if not imported:
            log.append("[OrchestratorAgent] Keine neuen Jobs — Pipeline beendet.")
            return self._summary(log, scout_result, [], {})

        # ── Schritt 2: Match ──────────────────────────────────────────────────
        job_ids = [j["job_id"] for j in imported]
        log.append(f"[MatchAgent] Berechne Scores für {len(job_ids)} Jobs...")
        scored = await self.match.run(job_ids, db)
        for s in scored:
            status = f"Score {s['score']}" if "error" not in s else f"Fehler: {s['error']}"
            log.append(f"[MatchAgent] '{s['title']}' → {status}")

        # ── Schritt 3: Filter (Guardrail) ─────────────────────────────────────
        log.append(f"[FilterAgent] Guardrail: min_score={min_score}")
        filter_result = self.filter.run(scored, min_score)
        log.append(
            f"[FilterAgent] {len(filter_result['passed'])} bestanden, "
            f"{filter_result['rejected_count']} abgelehnt"
        )

        return self._summary(log, scout_result, scored, filter_result)

    def _summary(
        self,
        log: list[str],
        scout_result: dict,
        scored: list[dict],
        filter_result: dict,
    ) -> dict:
        return {
            "run_summary": {
                "imported":        len(scout_result.get("imported", [])),
                "skipped_dupes":   scout_result.get("skipped_duplicates", 0),
                "scored":          len(scored),
                "passed_filter":   len(filter_result.get("passed", [])),
                "rejected":        filter_result.get("rejected_count", 0),
                "min_score":       filter_result.get("min_score", 0),
            },
            "results": filter_result.get("passed", []),
            "log":     log,
        }
