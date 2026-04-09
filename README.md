# JobAgent — AI-powered Bewerbungsmanager

Tool das automatisch Stellen findet, Unternehmensauskünfte einholt, Bewerbungen bewertet und den gesamten Bewerbungsprozess managt. Gebaut für Korbinian Much, perspektivisch als generisches Produkt ausbaubar.

---

## Tech Stack

| Schicht | Technologie |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS v4 + Vite |
| Backend | Python 3.12 + FastAPI + SQLAlchemy |
| Datenbank | SQLite (`db/jobagent.db`) |
| KI | Gemini Free Tier oder Groq Free Tier — geplant |
| Scraping | Playwright + httpx (lokal, €0) |
| Job-Import | URL-basiert (Stepstone, LinkedIn, Indeed, Direktseiten) |
| Unternehmensdaten | Firmenwebsite (Playwright) + Google News RSS + Kununu |

**Budget: €0** — kein bezahlter API-Dienst außer Claude Code CLI.

---

## Server starten

**Empfohlen:**
```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\kormu\projekte\JobAgent_Tool\start.ps1
```

**Manuell (zwei Terminals):**
```bash
# Terminal 1 — Backend
cd C:\Users\kormu\projekte\JobAgent_Tool\backend
C:\Users\kormu\anaconda3\python.exe -m uvicorn app.main:app --reload --port 8002

# Terminal 2 — Frontend
cd C:\Users\kormu\projekte\JobAgent_Tool\frontend
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

## Features (Stand: 09.04.2026)

### Fertig
- [x] Dashboard mit KPI-Cards (live aus DB: aktive Bewerbungen, Im Gespräch, Ø Match-Score, Follow-ups)
- [x] Pipeline-Tabelle — alle 8 Spalten sortierbar, Zellen kopierbar
- [x] Ampel-System für Match-Score (grün ≥70%, gelb 50–69%, rot <50%, weiß = kein Score)
- [x] Status-Dropdown direkt in der Tabelle (live PATCH)
- [x] Navigation mit 7 Seiten
- [x] Annotation-System: Stift-Button → Element anklicken → Kommentar speichern
- [x] Feedback-Seite mit "Umgesetzt"-Button (löscht Eintrag)
- [x] Job-Import per URL (`/scout/import`)
- [x] Company Researcher: Website-Scraper + Google News RSS + Kununu
- [x] SQLite statt PostgreSQL (kein laufender DB-Server nötig)

### In Arbeit / Nächste Schritte
- [ ] Frontend: Stellenfinder-Seite (URL eingeben → importieren → zur Pipeline hinzufügen)
- [ ] Frontend: Unternehmensinfo-Seite (Research-Ergebnisse anzeigen)
- [ ] "Neue Bewerbung" Modal/Formular
- [ ] Match Scorer: CV-Markdown + Stelle → Score + Begründung (Gemini/Groq Free Tier)
- [ ] Kontakte in Unternehmensansicht anzeigen und bearbeiten

### Geplant (Phase 3)
- [ ] Message Drafter: Anschreiben, LinkedIn-Nachricht, Follow-up-Text generieren
- [ ] Täglicher Job-Scout (Scheduler, automatisch)
- [ ] Tracker Sync: Bewerbungsstatus als Markdown exportieren
- [ ] Follow-up Reminder (Frist überschritten → Hinweis im Dashboard)

### Geplant (Phase 4 — Polish)
- [ ] Form Filler (Playwright-Automation für Bewerbungsportale)
- [ ] PDF-Export der Pipeline
- [ ] Optionales Login (multi-user)

---

## Bekannte Limitierungen

| Problem | Ursache | Workaround |
|---|---|---|
| Automatische Job-Suche nicht möglich | Stepstone/Indeed/BA-API blocken server-seitige Requests | Manueller URL-Import |
| KI-Funktionen noch nicht aktiv | Claude API kostet Geld, Gemini/Groq-Key fehlt noch | Gemini Free Tier einrichten (1500 req/Tag gratis) |
| Port 8000 manchmal belegt | Windows TIME_WAIT nach mehrfachem Neustart | Port 8002 verwenden |

---

## Notizen

- CV + Portfolio bereits als Markdown/PDF vorhanden → sofort als RAG-Basis für Match Scorer nutzbar
- Bewerbungsstrategie (Gehaltsvorstellung, Regionen, Titelvarianten) in separatem Dokument
- Tool könnte nach eigener Jobsuche als eigenständiges Produkt weiterentwickelt werden
