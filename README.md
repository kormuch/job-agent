# Job Agent

AI-powered job application manager with a multi-agent pipeline that automates search, scoring, and filtering.

## What It Does

Job Agent runs an autonomous pipeline of specialized AI agents to find, evaluate, and rank job listings. An **OrchestratorAgent** coordinates the workflow: a **ScoutAgent** searches the web and extracts metadata, a **MatchAgent** scores each listing against your CV using LLM evaluation (0--100), and a **FilterAgent** applies threshold guardrails. The system supports fully automatic mode where the LLM generates its own search queries from a configurable system prompt.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  OrchestratorAgent                   │
│            (coordinates full pipeline)               │
└──────┬──────────────┬──────────────┬────────────────┘
       │              │              │
       ▼              ▼              ▼
┌─────────────┐ ┌───────────┐ ┌────────────┐
│ ScoutAgent  │ │ MatchAgent│ │FilterAgent │
│             │ │           │ │            │
│ DuckDuckGo  │ │ CV + JD   │ │ Score      │
│ search,     │ │ → LLM     │ │ threshold  │
│ meta        │ │ scoring   │ │ guardrail  │
│ extraction  │ │ (0-100)   │ │            │
└─────────────┘ └───────────┘ └────────────┘
```

## Key Features

- **Agent-to-Agent pipeline** -- orchestrated multi-agent architecture with clear responsibility boundaries
- **Auto-mode** -- LLM generates search queries from system prompt, no manual input needed
- **Web scraping** -- Playwright-based import from Stepstone, LinkedIn, Indeed
- **Company research** -- automated website scraping, Google News RSS, Kununu reviews
- **Search profiles** -- multi-persona job search with separate CV and system prompt per profile
- **Match scoring** -- LLM evaluates CV against job description, returns structured 0--100 score
- **Full pipeline UI** -- dashboard with KPIs, sortable pipeline table, match score badges
- **Prompt injection protection** -- XML tag encapsulation, input length limits
- **LLM failover** -- Groq (Llama 3.3 70B) primary, Gemini fallback, automatic switching
- **Zero cost** -- runs entirely on free API tiers

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React, TypeScript, Tailwind CSS     |
| Backend  | FastAPI, SQLAlchemy, Pydantic       |
| Database | SQLite                              |
| LLM      | Groq (Llama 3.3 70B), Gemini       |
| Scraping | Playwright, BeautifulSoup           |
| Search   | DuckDuckGo API                      |

## Quick Start

```bash
# Clone
git clone https://github.com/kormuch/job-agent.git
cd job-agent

# Backend
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
cp .env.example .env          # Add API keys
uvicorn app.main:app --reload

# Frontend
cd ../frontend
npm install
npm run dev
```

Set `GROQ_API_KEY` and optionally `GEMINI_API_KEY` in `.env`.

## API Overview

| Group            | Description                                  |
|------------------|----------------------------------------------|
| `/jobs`          | CRUD for job listings, import, status updates |
| `/agents`        | Trigger agent pipeline, auto-mode runs       |
| `/companies`     | Company research and enrichment              |
| `/profiles`      | Search profiles with CV and prompt config    |
| `/dashboard`     | KPI aggregation, pipeline statistics         |

## License

MIT

