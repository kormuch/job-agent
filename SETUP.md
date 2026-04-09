# JobAgent — Setup & Projektstand

## Stand: 09.04.2026

---

## Was bisher passiert ist

### Konzept
- Idee: AI-Tool das Stellen findet, Unternehmen recherchiert, Bewerbungen bewertet und managt
- Zielgruppe: Korbinian Much (Eigenbedarf), perspektivisch generisches Produkt

### Deliverables
- [x] Klickbarer HTML-Dummy (`index.html`) — blau/weiß, 6 Bereiche:
  - Dashboard (KPIs, Pipeline-Übersicht)
  - Stellenfinder (Suchmaske + Job-Cards mit Match-Score)
  - Pipeline (vollständige Bewerbungstabelle)
  - Unternehmensinfo (Firmenprofil, Kulturcheck, AI-Analyse)
  - AI Agenten (6 Agenten mit Status + Log)
  - Einstellungen
- [x] PROJEKT.md angelegt (Architektur, Features, Roadmap)
- [x] PostgreSQL 17 installiert (`C:\Program Files\PostgreSQL\17\`)
- [x] PostgreSQL zum PATH hinzugefügt

---

## Tech Stack

| Schicht | Technologie | Status |
|---|---|---|
| Frontend | React + TypeScript + Tailwind + shadcn/ui | geplant |
| Backend | Python + FastAPI | geplant |
| Datenbank | PostgreSQL 17 | ✅ installiert |
| KI | Claude API (claude-sonnet-4-6) | geplant |
| Agenten | LangGraph oder Claude Agent SDK | geplant |
| RAG-Basis | CV + Portfolio als Markdown | bereit |
| Scraping | Apify + Playwright | geplant |

---

## Nächste TODOs

### Sofort (Setup)
- [ ] Neues Terminal öffnen → `psql -U postgres` testen
- [ ] Passwort für postgres-User notieren
- [ ] DBeaver installieren (GUI für PostgreSQL)
- [ ] Git-Repo anlegen für JobAgent_Tool

### Phase 1 — Fundament
- [ ] React-Projekt aufsetzen (Vite + Tailwind + shadcn)
- [ ] HTML-Dummy in React überführen
- [ ] FastAPI Backend aufsetzen
- [ ] PostgreSQL Schema definieren:
  - `jobs` (Stellenanzeigen)
  - `companies` (Unternehmensdaten)
  - `applications` (Bewerbungen + Status)
  - `contacts` (Ansprechpartner)
- [ ] Claude API Key einrichten + Basis-Integration testen

### Phase 2 — Kernfunktionen
- [ ] Match Scorer: CV als RAG-Basis, Stelle → Score + Begründung
- [ ] Company Researcher: Kununu-Daten holen
- [ ] Job Scout: Stepstone + LinkedIn via Apify
- [ ] Pipeline mit echten Daten verbinden
- [ ] Tracker Sync: Markdown-Dateien automatisch aktualisieren

### Phase 3 — Agenten
- [ ] LangGraph vs. Claude Agent SDK evaluieren
- [ ] Message Drafter Agent (LinkedIn, Follow-up, Anschreiben)
- [ ] Job Scout als autonomen Agenten
- [ ] Agenten-Log in UI

### Phase 4 — Polish
- [ ] Form Filler (Playwright-Automation für Bewerbungsportale)
- [ ] Reminder-System (Follow-up-Fristen)
- [ ] PDF-Export Pipeline-Report

---

## Verbindung testen
```bash
# Neues Terminal:
psql -U postgres
# Passwort eingeben → postgres=# erscheint → funktioniert
```
