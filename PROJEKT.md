# JobAgent — AI-powered Bewerbungsmanager

## Projektidee
Tool das automatisch Stellen findet, Unternehmensauskünfte einholt, Bewerbungen bewertet und den gesamten Bewerbungsprozess managt. Gebaut für Korbinian Much, perspektivisch als generisches Produkt ausbaubar.

## Status
**Phase:** Konzept / Dummy
**Stand:** 09.04.2026
**Letzter Schritt:** Klickbarer HTML-Dummy erstellt (blau/weiß, 6 Bereiche)

---

## Tech Stack (geplant)

| Schicht | Technologie |
|---|---|
| Frontend | React + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Python + FastAPI |
| Datenbank | PostgreSQL |
| KI | Claude API (claude-sonnet-4-6) |
| Agenten | LangGraph oder Claude Agent SDK |
| RAG-Basis | CV + Portfolio als Markdown (bereits strukturiert) |
| Scraping | Apify + Playwright |
| Unternehmensdaten | Kununu, LinkedIn, Clearbit |

---

## Geplante Features / Agenten

### 1. Job Scout
- Durchsucht LinkedIn, Stepstone, Indeed, Unternehmensseiten
- Filtert nach Gehalt, Region, Jobtitel
- Täglich automatisch

### 2. Match Scorer
- Vergleicht Stelle mit CV + Portfolio via RAG
- Gibt Match-Score in % aus
- Erklärt Stärken und Lücken

### 3. Company Researcher
- Holt Kununu, Glassdoor, LinkedIn, Jahresberichte
- Kulturcheck, Gehaltsschätzung, Tarifvertrag-Flag

### 4. Message Drafter
- LinkedIn-Nachrichten, Follow-ups, Anschreiben
- Personalisiert nach Ansprechpartner + Unternehmenskultur
- Kein LLM-Sprech, locker und direkt

### 5. Tracker Sync
- Hält Pipeline + READMEs automatisch aktuell
- Erinnert an Follow-up-Fristen
- Schreibt Markdown-Dateien direkt ins Dateisystem

### 6. Form Filler *(später)*
- Füllt Bewerbungsportale automatisch aus
- Nutzt CV + Portfolio als Wissensbasis

---

## TODOs

### Phase 1 — Fundament
- [ ] React-Projekt aufsetzen (Vite + Tailwind + shadcn)
- [ ] HTML-Dummy in React überführen
- [ ] FastAPI Backend aufsetzen
- [ ] PostgreSQL Schema definieren (Jobs, Companies, Applications, Contacts)
- [ ] Claude API anbinden (Basis-Integration)

### Phase 2 — Kernfunktionen
- [ ] Match Scorer implementieren (CV als RAG-Basis)
- [ ] Company Researcher implementieren (Kununu-Scraping)
- [ ] Job Scout: Stepstone + LinkedIn via Apify
- [ ] Pipeline-Ansicht mit echten Daten verbinden
- [ ] Tracker Sync: Markdown-Dateien automatisch schreiben

### Phase 3 — Agenten
- [ ] LangGraph oder Claude Agent SDK evaluieren
- [ ] Message Drafter Agent bauen
- [ ] Job Scout als autonomen Agenten aufsetzen
- [ ] Agenten-Log in UI einbauen

### Phase 4 — Polish
- [ ] Form Filler (Playwright-Automation)
- [ ] Notification / Reminder System (Follow-up-Fristen)
- [ ] Export: PDF-Pipeline-Report
- [ ] Optionales Login (wenn multi-user)

---

## Dateien
```
JobAgent_Tool/
├── PROJEKT.md       ← du bist hier
└── index.html       ← klickbarer HTML-Dummy
```

---

## Notizen
- CV + Portfolio bereits als Markdown/PDF vorhanden → sofort als RAG-Basis nutzbar
- Bewerbungsstrategie (Gehaltsvorstellung, Regionen, Titelvarianten) in LLM_KONTEXT.md dokumentiert
- Tool könnte nach eigener Jobsuche als eigenständiges Produkt weiterentwickelt werden
