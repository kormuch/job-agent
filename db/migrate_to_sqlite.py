"""
Migriert Daten von PostgreSQL -> SQLite.
Einmalig ausführen, dann kann PostgreSQL deinstalliert werden.
"""
import sqlite3
import psycopg2

PG_DSN = "postgresql://postgres:postgres@localhost:5432/jobagent"
SQLITE_PATH = "../db/jobagent.db"

TABLES = ["companies", "jobs", "contacts", "applications", "activities"]

pg = psycopg2.connect(PG_DSN)
pg_cur = pg.cursor()

sq = sqlite3.connect(SQLITE_PATH)
sq.execute("PRAGMA foreign_keys = ON")

# ── Schema ─────────────────────────────────────────────────────────────────────

sq.executescript("""
CREATE TABLE IF NOT EXISTS companies (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  website       TEXT,
  industry      TEXT,
  location      TEXT,
  size          TEXT,
  revenue       TEXT,
  kununu_score  REAL,
  remote_policy TEXT,
  tariff        INTEGER DEFAULT 0,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id    INTEGER REFERENCES companies(id),
  title         TEXT NOT NULL,
  location      TEXT,
  salary_min    INTEGER,
  salary_max    INTEGER,
  remote        INTEGER DEFAULT 0,
  source        TEXT,
  source_url    TEXT,
  description   TEXT,
  requirements  TEXT,
  match_score   INTEGER,
  match_notes   TEXT,
  published_at  TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id    INTEGER REFERENCES companies(id),
  name          TEXT NOT NULL,
  role          TEXT,
  email         TEXT,
  phone         TEXT,
  linkedin_url  TEXT,
  notes         TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id          INTEGER REFERENCES jobs(id),
  contact_id      INTEGER REFERENCES contacts(id),
  status          TEXT NOT NULL DEFAULT 'offen',
  priority        TEXT DEFAULT 'mittel',
  applied_at      TEXT,
  salary_target   INTEGER,
  cover_letter    INTEGER DEFAULT 0,
  portfolio_sent  INTEGER DEFAULT 0,
  follow_up_date  TEXT,
  notes           TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activities (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id  INTEGER REFERENCES applications(id),
  type            TEXT,
  description     TEXT,
  happened_at     TEXT DEFAULT (datetime('now'))
);
""")

# ── Daten kopieren ─────────────────────────────────────────────────────────────

for table in TABLES:
    pg_cur.execute(f"SELECT * FROM {table}")
    rows = pg_cur.fetchall()
    if not rows:
        continue
    cols = len(rows[0])
    placeholders = ",".join(["?"] * cols)
    sq.executemany(
        f"INSERT OR IGNORE INTO {table} VALUES ({placeholders})",
        [tuple(str(v) if v is not None else None for v in row) for row in rows]
    )
    print(f"  {table}: {len(rows)} Zeilen migriert")

sq.commit()
sq.close()
pg.close()
print("\nFertig. SQLite-Datei: db/jobagent.db")
