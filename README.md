# JobAgent — AI-powered Bewerbungsmanager

Self-built tool for automated job search management. Finds jobs, researches companies, scores CV fit via LLM, and manages the full application pipeline. Built for personal use — designed to be extendable as a generic product.

---

## Tech Stack

| Schicht | Technologie |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS v4 + Vite |
| Backend | Python 3.12 + FastAPI + SQLAlchemy |
| Datenbank | SQLite (`db/jobagent.db`) |
| AI | **Groq** (primär) + Gemini (Fallback) — aktiv |
| Scraping | Playwright + httpx (lokal, €0) |
| Job-Import | URL-basiert (Stepstone, LinkedIn, Indeed, Direktseiten) |
| Unternehmensdaten | Firmenwebsite (Playwright) + Google News RSS + Kununu |

**Budget: €0** — kein bezahlter API-Dienst außer Claude Code CLI.

---

## Server starten

**Empfohlen:**
```powershell
powershell -ExecutionPolicy Bypass -File start.ps1
```

**Manuell (zwei Terminals):**
```bash
# Terminal 1 — Backend
cd backend
python -m uvicorn app.main:app --reload --port 8002

# Terminal 2 — Frontend
cd frontend
npm run dev
```

| Dienst | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8002 |
| API Docs | http://localhost:8002/docs |

> **Hinweis:** Port 8000 wird von Windows manchmal blockiert (TIME_WAIT). Daher Port 8002.

---

## Projektstruktur

```
JobAgent_Tool/
├── README.md
├── start.ps1                   ← Server starten (empfohlen)
├── index.html                  ← HTML-Dummy (Referenz, nicht aktiv)
├── db/
│   ├── jobagent.db             ← SQLite Datenbank
│   ├── schema.sql              ← Schema-Referenz
│   └── migrate_to_sqlite.py   ← einmalig ausgeführt (PostgreSQL → SQLite)
├── backend/
│   └── app/
│       ├── main.py             ← FastAPI App, CORS, Router-Registrierung
│       ├── database.py         ← SQLAlchemy Engine (SQLite)
│       ├── models/
│       │   └── models.py       ← ORM: Company, Job, Contact, Application, Activity
│       └── routers/
│           ├── applications.py ← GET /applications/, PATCH /applications/{id}/status
│           ├── annotations.py  ← GET/POST /annotations/, DELETE /annotations/{index}
│           ├── scout.py        ← POST /scout/import, GET /scout/jobs
│           └── research.py     ← GET /research/{id}, GET /research/{id}/news
└── frontend/
    └── src/
        ├── App.tsx             ← Layout, Navigation, Routing
        ├── api/
        │   └── applications.ts ← fetch-Wrapper, Typen
        └── components/
            ├── Dashboard.tsx   ← KPI-Cards + Mini-Pipeline (sortierbar)
            ├── Pipeline.tsx    ← Vollständige Pipeline-Tabelle (sortierbar, kopierbar)
            ├── Feedback.tsx    ← Annotation-Feedback-Seite mit "Umgesetzt"-Button
            ├── MatchBadge.tsx  ← Ampel-Komponente (grün/gelb/rot/weiß)
            └── AnnotationLayer.tsx ← Stift-Button, Element-Picker, Kommentar-Popup
```

---

## Datenmodell

```
companies       name, website, industry, location, size, kununu_score, remote_policy
    │
    ├── jobs    title, salary_min/max, match_score, source, source_url, description
    │       │
    │       └── applications    status, priority, applied_at, salary_target, follow_up_date
    │                   │
    │                   └── activities    type, description, happened_at
    │
    └── contacts    name, role, email, phone, linkedin_url
```

**Status-Werte:** `offen` → `kontaktiert` → `beworben` → `im_gespräch` → `interview` → `angebot` → `abgeschlossen` / `ghosted`

**Priorität:** `top` / `mittel` / `pipeline`

---

## API-Übersicht

### Applications
| Method | Endpoint | Beschreibung |
|---|---|---|
| GET | `/applications/` | Alle Bewerbungen mit Job + Company |
| PATCH | `/applications/{id}/status` | Status ändern |

### Annotations (Feedback-System)
| Method | Endpoint | Beschreibung |
|---|---|---|
| GET | `/annotations/` | Alle Feedback-Einträge |
| POST | `/annotations/` | Neues Feedback speichern |
| DELETE | `/annotations/{index}` | Feedback als umgesetzt löschen |

### Scout (Job-Import)
| Method | Endpoint | Beschreibung |
|---|---|---|
| POST | `/scout/import` | Stelle per URL importieren |
| GET | `/scout/jobs` | Importierte Stellen ohne Bewerbung |

**Beispiel Import-Request:**
```json
POST /scout/import
{
  "url": "https://www.stepstone.de/...",
  "title": "AI Product Owner",       // optional, falls Extraktion fehlschlägt
  "company_name": "Bosch Digital",   // optional
  "notes": "Über LinkedIn gefunden"  // optional
}
```

Extrahiert automatisch: Titel, Firma, Beschreibung via Meta-Tags + plattformspezifische Patterns (Stepstone, LinkedIn, Indeed).

### Research (Unternehmensanalyse)
| Method | Endpoint | Beschreibung |
|---|---|---|
| GET | `/research/{company_id}` | Kontakte scrapen + News + Kununu |
| GET | `/research/{company_id}/news` | Nur Google News RSS |

Scrapt automatisch `/team`, `/kontakt`, `/about`, `/impressum` der Firmenwebsite. Extrahiert Emails (Regex), Telefonnummern, HR-Kontakte per Heuristik.

---

## KI-System (Stand: 10.04.2026)

### Welche Modelle werden verwendet?

| Provider | Modell | Kosten | Limit | Status |
|---|---|---|---|---|
| **Groq** | `llama-3.3-70b-versatile` | €0 | 14.400 req/Tag, 30/min | **Aktiv (primär)** |
| Gemini | `gemini-1.5-flash` | €0 (Billing nötig) | 1.500 req/Tag | Fallback |

Groq hat Vorrang. Wenn kein Groq-Key vorhanden, wird Gemini verwendet.
Keys in `.env` (nie ins Git committen — steht in `.gitignore`):
```
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
```

### Wie funktionieren die KI-Aufrufe?

Jeder LLM-Call ist so aufgebaut:

```
[System-Prompt / Persona]     ← deine dauerhafte Anweisung (editierbar in UI)
     +
[CV]                          ← gespeichert in db/cv.md
     +
<job_description>             ← externe Inhalte immer in XML-Tags (Injection-Schutz)
  Stellenbeschreibung
</job_description>
```

Der **System-Prompt** ist deine persönliche Anweisung an die KI — einmalig hinterlegen,
wirkt bei jedem Call automatisch mit. Beispiel:
> "Ich bin AI Product Owner mit Fokus auf Agentic Engineering. Gehaltsvorstellung 80–95k.
> Bevorzuge remote-freundliche Startups/Mittelstand. Konzerne nur wenn explizit innovativ.
> Bewerte Stellenbeschreibungen kritisch — lieber einen niedrigeren Score als falsche Hoffnung."

### KI-Funktionen

| Funktion | Endpoint | Beschreibung |
|---|---|---|
| Match Score | `POST /match/{job_id}` | CV + Stelle → Score 0–100 + Stärken/Lücken |
| Ad-hoc Score | `POST /match/text/score` | Score ohne DB-Job (Text direkt) |
| Message Drafter | `POST /draft/{job_id}` | Anschreiben / LinkedIn-Nachricht generieren *(geplant)* |
| CV speichern | `POST /match/cv` | CV-Text in db/cv.md ablegen |
| Config | `GET/POST /match/config` | Key-Status + System-Prompt |

### Prompt Injection — Schutz

> **Risiko:** Mittel. Stellenanzeigen können versteckte Anweisungen enthalten.
> Bereits implementiert: XML-Tag-Kapselung, Längenbegrenzung (4000/3000 Zeichen).

- [x] Externe Inhalte in XML-Tags gekapselt (`<cv>`, `<job_description>`)
- [x] Längenbegrenzung: CV max. 4000, Stelle max. 3000 Zeichen
- [ ] Suspicious-Pattern-Logging (`ignore`, `system prompt`, `vergiss`)
- [ ] Output-Validierung: Score muss Integer 0–100 sein
- [ ] LLM-Audit-Log in DB

---

## Features (Stand: 10.04.2026)

### Fertig
- [x] Dashboard mit KPI-Cards (live aus DB: aktive Bewerbungen, Im Gespräch, Ø Match-Score, Follow-ups)
- [x] Pipeline-Tabelle — alle Spalten sortierbar, Zellen kopierbar
- [x] Priorität-Ampel: 🟢 Top / 🟡 Mittel / ⚫ Pipeline
- [x] Match-Score-Ampel: grün ≥70%, gelb 50–69%, rot <50%, weiß = kein Score
- [x] Status-Dropdown direkt in der Tabelle (live PATCH), inkl. "absage"
- [x] "Neue Bewerbung" Modal — Firma+Job+Application in einem Schritt
- [x] Website-URL pro Unternehmen editierbar (inline, startet Recherche neu)
- [x] Annotation-System: Stift-Button → Element anklicken → Kommentar speichern
- [x] Feedback-Seite mit "Umgesetzt"-Button
- [x] Job-Import per URL (`/scout/import`)
- [x] Company Researcher: Website-Scraper + Kununu (7-Tage-Cache)
- [x] Match Scorer: CV (db/cv.md) + Stelle → Score + Stärken/Lücken via Groq/Gemini
- [x] ⚡-Button in Pipeline: Score direkt berechnen + Popup
- [x] Einstellungen-Seite: CV-Editor + API-Key-Verwaltung
- [x] SQLite (kein laufender DB-Server nötig)

### In Arbeit / Nächste Schritte (Priorität)
- [ ] **Message Drafter**: CV + Stelle + System-Prompt → Anschreiben + LinkedIn-Nachricht (Groq) — `POST /draft/{job_id}`
- [ ] **Nacht-Scheduler**: Windows Task Scheduler → DuckDuckGo-Suche → neue Jobs in DB → Auto-Score → autonomer Agentic Loop
- [ ] Kontakte in Unternehmensansicht bearbeiten
- [x] **Sicherheit: API Keys in `.env` auslagern** — `POST /match/config` schreibt Keys jetzt in `.env` statt `config.json`; `config.json` enthält nur noch `system_prompt`
- [x] **Sicherheit: Git-History prüfen** — `git log --all -- db/config.json` bestätigt: nie committed
- [ ] **Contacts-Löschfunktion** — Drittdaten (HR-Kontakte, CEOs) müssen löschbar sein
- [ ] **Automatisierte Tests** — pytest Smoke-Tests für alle FastAPI-Routes mit Fixture-Daten (mindestens: alle Routes antworten 200, Match-Score ist Integer 0–100)

### Geplant (Phase 3)
- [ ] Follow-up Reminder (Frist überschritten → Hinweis im Dashboard)
- [ ] Tracker Sync: Bewerbungsstatus als Markdown exportieren
- [ ] Täglicher Job-Scout (Windows Task Scheduler)

### Geplant (Phase 4 — Polish)
- [ ] Form Filler (Playwright-Automation für Bewerbungsportale)
- [ ] PDF-Export der Pipeline
- [ ] Optionales Login (multi-user)

---

## Datenschutz & Sicherheit (Stand: 28.04.2026)

### Datenspeicherung
| Datei | Inhalt | Schutz |
|---|---|---|
| `db/jobagent.db` | Bewerbungen, Jobs, Kontakte, Aktivitäten | Unverschlüsselt (SQLite) |
| `db/cv.md` | Vollständiger Lebenslauf | Unverschlüsselt (Klartext) |
| `db/config.json` | API Keys (Groq/Gemini), System-Prompt mit Name + Gehalt | Unverschlüsselt (Klartext) |

### Externe Datenflüsse
| Ziel | Was wird gesendet | Anmerkung |
|---|---|---|
| **Groq API (USA)** | CV + Stellenbeschreibung | Daten verlassen EU, kein AVV |
| **Gemini/Google (USA)** | CV + Stellenbeschreibung (Fallback) | Daten verlassen EU |
| **DuckDuckGo** | Suchanfragen (Jobtitel, Region) | Unkritisch, keine PD |
| **Firmenwebsites** | HTTP-Request mit Chrome User-Agent | Scraping, robots.txt nicht geprüft |
| **Kununu** | Automatisierter HTTP-Zugriff | Ggf. gegen AGB |

### DSGVO-Bewertung
- **Eigene Daten:** DSGVO Art. 2(2)(c) greift — private Haushaltsnutzung, kein öffentlicher Zugang → **unkritisch**
- **Drittdaten (contacts-Tabelle):** HR-Kontakte, CEO-Namen, E-Mails werden ohne Einwilligung gescrapt → **grenzwertig**, solange rein privat genutzt
- **ISO 27001:** Nicht anwendbar — Zertifizierungsstandard für Organisationen, nicht für Einzeltools

### Offene Punkte (→ TODO)
- [ ] API Keys in `.env` statt `config.json` (Klartext-Risiko)
- [ ] Git-History prüfen: `git log --all -- db/config.json`
- [ ] Contacts-Löschfunktion für Drittdaten
- [ ] Bei Produktisierung: AVV mit Groq/Gemini, `.env`-Verschlüsselung, Login-Schutz

---

## Bekannte Limitierungen

| Problem | Ursache | Workaround |
|---|---|---|
| Automatische Job-Suche teilweise geblockt | Stepstone/Indeed blocken Bots | DuckDuckGo-Suche + langsame Requests |
| Gemini 429-Fehler | Billing nicht aktiviert im Google-Account | Groq als primären Provider nutzen |
| Port 8000 manchmal belegt | Windows TIME_WAIT nach mehrfachem Neustart | Port 8002 verwenden |

---

## Claude Code Integration

### CLAUDE.md
`CLAUDE.md` im Projektstamm enthält den Session-Kontext für Claude Code: Architekturregeln, LLM-Aufrufstruktur, offene Security-TODOs und Kommunikationsregeln. **Am Ende jeder Session updaten** (abgehakte TODOs, neue Limitierungen, Architekturänderungen).

### Projektspezifischer Skill
Ein Claude Code Skill unter `~/.claude/skills/jobagent/SKILL.md` würde Kontext automatisch laden wenn Trigger-Keywords erkannt werden (`jobagent`, `bewerbungsmanager`, `match scorer`, `scout import`). Referenz-Format: `~/.claude/skills/iu-nlp/SKILL.md` (VocaDine-Projekt).

**Was der Skill enthalten sollte:**
- LLM-Call-Architektur (System-Prompt + CV + XML-tagged job)
- Status-Pipeline Naming Conventions
- Security-Constraints (CV nie loggen, config.json nie committen)
- Aktuelle Feature-Prioritäten

---

## Notizen

- CV + Portfolio bereits als Markdown/PDF vorhanden → sofort als RAG-Basis für Match Scorer nutzbar
- Bewerbungsstrategie (Gehaltsvorstellung, Regionen, Titelvarianten) in separatem Dokument
- Tool könnte nach eigener Jobsuche als eigenständiges Produkt weiterentwickelt werden
