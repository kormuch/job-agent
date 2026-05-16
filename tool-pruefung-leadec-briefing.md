# Tool-Prüfung: JobAgent für Leadec-Briefing

**Erstellt:** 25.04.2026
**Zweck:** Eignung des JobAgent Tools für ein Firmen-Briefing zu Leadec Automation & Engineering GmbH
**Interview:** 27.04.2026, 10:00 Uhr

---

## ⚠️ Sicherheitshinweis

Die Datei `.env` enthält echte API-Keys (GEMINI_API_KEY, GROQ_API_KEY) im Klartext.
Die `db/config.json` enthält ebenfalls API-Keys.
Beide Dateien sind in `.gitignore` gelistet — trotzdem prüfen, ob sie je committed wurden:

```bash
git log --all --full-history -- .env
git log --all --full-history -- db/config.json
```

Falls ja: Keys sofort rotieren (Google AI Studio, Groq Console).

---

## 1. Tool-Architektur

```
FastAPI Backend (Port 8002)
├── scout.py       → DuckDuckGo-Suche, Job-URL-Import, Auto-Search
├── research.py    → Website-Scraping, Kununu, Kontakt-Extraktion
├── match.py       → LLM-Scoring via Groq (llama-3.3-70b) / Gemini (1.5-flash)
├── applications.py → CRUD Bewerbungen + Firmen
└── annotations.py → Feedback-System (JSON)

React Frontend (Port 5173/5174)
SQLite Datenbank (db/jobagent.db)
```

**Was "Google API" bedeutet im Kontext dieses Tools:**
Es gibt **keine** Google Custom Search API oder News API. "Google" bezieht sich auf:
- **Google Gemini API** (LLM-Fallback für Scoring)
- **Google News RSS** (Endpunkt `/research/{id}/news` ist definiert, aber **nicht implementiert**)

Die eigentliche Suchfunktion läuft über **DuckDuckGo** (Bibliothek: `ddgs`).

---

## 2. Vorhandene Features und Nutzbarkeit für Leadec-Briefing

### ✅ Direkt nutzbar

| Feature | Modul | Nutzung für Leadec |
|---------|-------|-------------------|
| **Company Website Scraping** | `research.py` | Scrapt Homepage, /about, /karriere, /team, /impressum — liefert Logo, Beschreibung, Kultur-Texte, CEO-Name |
| **DuckDuckGo-Suche** | `scout.py` | Suche nach "Leadec Automation Engineering Neuigkeiten 2025", "Leadec AI Strategie", etc. |
| **Kontakt-Extraktion** | `research.py` | Extrahiert E-Mails + HR-Kontakte von der Website automatisch |
| **Kununu-Score** | `research.py` | Scrapt kununu.com für Arbeitgeber-Bewertung + Review-Anzahl |
| **LLM-Analyse** | `match.py` | Kann gescrapte Texte via Groq/Gemini analysieren und strukturiert ausgeben |

### ⚠️ Mit Anpassungen nutzbar

| Feature | Problem | Aufwand |
|---------|---------|---------|
| **Structured Briefing Output** | Kein Markdown-Export für Firmen-Briefings — nur DB-Speicherung | Mittel: neue Route oder Script |
| **News-Sammlung** | `/research/{id}/news` Endpoint definiert, Logik aber **nicht implementiert** | Mittel: Google News RSS oder DuckDuckGo News einbauen |
| **Pressemitteilungen** | Kein gezieltes Crawlen von /presse oder /news Unterseiten | Klein: URL-Liste erweitern in research.py |

### ❌ Nicht vorhanden

| Feature | Begründung |
|---------|-----------|
| Google Custom Search / News API | Nicht integriert — nur Gemini als LLM |
| Automatischer Briefing-Generator | Kein Template für "Firmen-Briefing" — nur CV-Match-Scoring |
| Zeitreihen-Filter (letzte 6 Monate) | DuckDuckGo-Suche hat kein Datum-Filter in aktueller Implementierung |

---

## 3. Empfehlung

**Bewertung: Mit Anpassungen nutzbar — aber für Montag zu langsam**

Das Tool kann grundsätzlich ein Leadec-Briefing liefern, aber:

1. Leadec muss erst als Company in die DB eingetragen werden
2. `/research/{company_id}` muss manuell getriggert werden
3. News-Endpoint fehlt
4. Kein strukturierter Briefing-Output als Markdown

Für das Interview am **Montag 27.04.** ist der direkte Weg schneller.

---

## 4. Konkrete Anpassungen (falls Tool genutzt werden soll)

### Option A: Tool direkt nutzen (30 Min Aufwand)

```
1. JobAgent starten: powershell -ExecutionPolicy Bypass -File start.ps1
2. Im Frontend: "Neue Bewerbung" anlegen mit Firma "Leadec Automation & Engineering GmbH"
   Website: https://leadec.com
3. Tab "Unternehmensinfo" → Research triggern
   → Scrapt Homepage, About, Karriere, Team, Impressum
   → Liefert: Beschreibung, Kultur-Snippets, CEO-Name, Kununu-Score
4. DuckDuckGo-Suche im Scout-Tab:
   - "Leadec Automation Engineering 2025"
   - "Leadec AI Competence Center"
   - "Leadec Digitalisierung Strategie"
```

### Option B: Direkter Python-Script (kein Frontend nötig)

Ein minimaler Script könnte `research.py`-Logik direkt aufrufen und als Markdown exportieren.
Aufwand: ~1h. Für Montag nicht sinnvoll.

### Option C: Direkter Web-Research jetzt (empfohlen für Montag)

Quellen für Leadec-Briefing:
- `https://leadec.com` → Über uns, Strategie, News/Presse
- `https://leadec.com/de/news` oder `/de/presse`
- `https://www.kununu.com/de/leadec` → Arbeitgeberbewertung
- DuckDuckGo: "Leadec Automation Engineering AI 2024 2025"
- LinkedIn: Company Page Leadec
- Bundesanzeiger / Handelsregister (Stuttgart HRB) für Geschäftszahlen

---

## 5. Fazit

Das JobAgent Tool ist ein solides internes Tool für Job-Import und CV-Matching, aber **kein fertiger Briefing-Generator**. Der `research.py`-Router liefert brauchbare Firmen-Daten (Website-Scraping, Kununu), aber ohne strukturierten Output und ohne funktionierenden News-Crawler.

**Für das Leadec-Interview am Montag:** Direkter Web-Research ist der bessere Weg.
**Mittelfristig:** Der News-Endpoint und ein Briefing-Template wären sinnvolle Erweiterungen.
