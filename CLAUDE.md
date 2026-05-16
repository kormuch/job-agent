# JobAgent_Tool — Claude Context

## Who is working on this

Korbinian Much — AI Product Owner, not a classical programmer. Skip syntax explanations. Explain architecture decisions and product tradeoffs. Code in English, comments/UI in German is fine.

This tool was built for his own job search, but is scoped to become a generic product afterward.

---

## What this is

Full-stack AI-powered Bewerbungsmanager. Finds jobs, researches companies, scores CV-fit, drafts messages. Built on €0 API budget (Groq free tier primary, Gemini fallback).

**Stack:** React 19 + TypeScript + Tailwind CSS v4 + Vite (frontend) | FastAPI + SQLAlchemy + SQLite (backend) | Groq llama-3.3-70b-versatile | Playwright + httpx (scraping)

**Start:** `powershell -ExecutionPolicy Bypass -File C:\Users\kormu\projekte\JobAgent_Tool\start.ps1`
- Frontend: http://localhost:5173
- Backend: http://localhost:8002 (port 8000 often blocked by Windows TIME_WAIT)
- API Docs: http://localhost:8002/docs

---

## Architecture

```
backend/app/
├── main.py           ← FastAPI app, CORS, router registration
├── database.py       ← SQLAlchemy engine (SQLite)
├── models/models.py  ← ORM: Company, Job, Contact, Application, Activity
└── routers/
    ├── applications.py  ← status pipeline management
    ├── annotations.py   ← in-app feedback system
    ├── scout.py         ← job import from URL
    ├── research.py      ← company scraping + Kununu + Google News
    └── match.py         ← CV scoring via LLM (Groq/Gemini)

frontend/src/
├── App.tsx              ← layout, nav, routing
├── api/applications.ts  ← fetch wrappers + types
└── components/
    ├── Dashboard.tsx        ← KPI cards + mini pipeline
    ├── Pipeline.tsx         ← full sortable pipeline table
    ├── Feedback.tsx         ← annotation review
    ├── MatchBadge.tsx       ← score traffic light
    └── AnnotationLayer.tsx  ← element-picker feedback tool
```

**Data model:** companies → jobs → applications → activities (linear hierarchy). contacts hang off companies.

**Status pipeline:** `offen → kontaktiert → beworben → im_gespräch → interview → angebot → abgeschlossen / ghosted`

---

## LLM System

Every LLM call structure:
```
[System-Prompt]  ← user-configurable in UI
+ [CV]           ← stored in db/cv.md
+ <job_description>...</job_description>  ← XML-tagged (injection protection)
```

**Providers:** Groq (primary, llama-3.3-70b-versatile, 14.400 req/day, 30/min) → Gemini fallback
**Keys:** `.env` file (GROQ_API_KEY, GEMINI_API_KEY) — never in git

---

## Security TODOs (open)

- [ ] API keys currently in `db/config.json` (plaintext) — migrate to `.env` (dotenv already in main.py, only UI save needs updating)
- [ ] Check git history: `git log --all -- db/config.json` to confirm keys never committed
- [ ] Suspicious-pattern logging in LLM inputs (`ignore`, `system prompt`, `vergiss`)
- [ ] Output validation: match score must be Integer 0–100
- [ ] Contacts delete function (GDPR — HR contact data scraped without consent)

---

## Next Features (priority order)

1. **Message Drafter** — `POST /draft/{job_id}` — CV + job + system-prompt → Anschreiben + LinkedIn message via Groq
2. **Night Scheduler** — Windows Task Scheduler → DuckDuckGo search → new jobs → auto-score → agentic loop
3. **Follow-up Reminder** — overdue follow-ups flagged in Dashboard
4. **Automated smoke tests** — at minimum: test that all FastAPI routes return 200 with fixture data (pytest)

---

## Known Limitations

| Problem | Ursache | Workaround |
|---|---|---|
| Job search partially blocked | Stepstone/Indeed bot detection | DuckDuckGo + slow requests |
| Gemini 429 | Billing not enabled | Groq as primary |
| Port 8000 blocked | Windows TIME_WAIT | Use port 8002 |
| Groq rate limit | 30 req/min | Throttle LLM calls in pipeline |

---

## Project-Specific Skill

This project does not yet have a Claude skill file. Creating one at `~/.claude/skills/jobagent/SKILL.md` would let Claude load full context automatically when working on this project.

**What the skill should contain:**
- Trigger keywords: "jobagent", "bewerbungsmanager", "match scorer", "scout import"
- The LLM call architecture (system-prompt + CV + XML-tagged job)
- The status pipeline naming conventions (offen/beworben/etc.)
- Security constraints (never log CV content, never commit config.json)
- Current next-feature priority

See `~/.claude/skills/iu-nlp/SKILL.md` (VocaDine) as the reference format.

---

## Keeping this file updated

At the end of each session, update:
- [ ] Features moved from TODO to done (checkbox ✓)
- [ ] New known limitations discovered
- [ ] Security issues found or resolved
- [ ] Architecture changes

The README.md has the canonical full docs. This file is for AI session context only.
