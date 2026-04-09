-- JobAgent Database Schema
-- PostgreSQL 17
-- Created: 2026-04-09

CREATE DATABASE jobagent;
\c jobagent;

-- ── COMPANIES ──────────────────────────────────────────────
CREATE TABLE companies (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  website         VARCHAR(255),
  industry        VARCHAR(100),
  location        VARCHAR(100),
  size            VARCHAR(50),       -- z.B. "200-500", "~4500"
  revenue         VARCHAR(50),       -- z.B. "1.6 Mrd €"
  kununu_score    DECIMAL(2,1),
  remote_policy   VARCHAR(50),       -- "Vollzeit Remote", "Hybrid", "Vor Ort"
  tariff          BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── JOBS ───────────────────────────────────────────────────
CREATE TABLE jobs (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER REFERENCES companies(id),
  title           VARCHAR(255) NOT NULL,
  location        VARCHAR(100),
  salary_min      INTEGER,           -- in €
  salary_max      INTEGER,
  remote          BOOLEAN DEFAULT FALSE,
  source          VARCHAR(100),      -- "LinkedIn", "Stepstone", "Direkt"
  source_url      TEXT,
  description     TEXT,
  requirements    TEXT,
  match_score     INTEGER,           -- 0-100
  match_notes     TEXT,              -- AI-Begründung
  published_at    DATE,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── CONTACTS ───────────────────────────────────────────────
CREATE TABLE contacts (
  id              SERIAL PRIMARY KEY,
  company_id      INTEGER REFERENCES companies(id),
  name            VARCHAR(255) NOT NULL,
  role            VARCHAR(255),      -- z.B. "HR Business Partner"
  email           VARCHAR(255),
  phone           VARCHAR(50),
  linkedin_url    TEXT,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── APPLICATIONS ───────────────────────────────────────────
CREATE TABLE applications (
  id              SERIAL PRIMARY KEY,
  job_id          INTEGER REFERENCES jobs(id),
  contact_id      INTEGER REFERENCES contacts(id),
  status          VARCHAR(50) NOT NULL DEFAULT 'offen',
    -- offen | kontaktiert | beworben | im_gespräch | interview | angebot | abgeschlossen | ghosted
  priority        VARCHAR(10) DEFAULT 'mittel',
    -- top | mittel | pipeline
  applied_at      DATE,
  salary_target   INTEGER,           -- Gehaltsvorstellung bei Bewerbung
  cover_letter    BOOLEAN DEFAULT FALSE,
  portfolio_sent  BOOLEAN DEFAULT FALSE,
  follow_up_date  DATE,
  notes           TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- ── ACTIVITIES ─────────────────────────────────────────────
CREATE TABLE activities (
  id              SERIAL PRIMARY KEY,
  application_id  INTEGER REFERENCES applications(id),
  type            VARCHAR(50),       -- "nachricht", "follow_up", "interview", "absage", "angebot"
  description     TEXT,
  happened_at     TIMESTAMP DEFAULT NOW()
);

-- ── INDEXES ────────────────────────────────────────────────
CREATE INDEX idx_applications_status   ON applications(status);
CREATE INDEX idx_applications_priority ON applications(priority);
CREATE INDEX idx_jobs_match_score      ON jobs(match_score DESC);
CREATE INDEX idx_activities_app        ON activities(application_id);

-- ── SEED: Aktuelle Pipeline ────────────────────────────────
INSERT INTO companies (name, location, industry, size, remote_policy) VALUES
  ('GKK PARTNERS',         'München',           'Steuerberatung / WP',  NULL,     'Hybrid'),
  ('Hays',                 'bundesweit',         'Recruiting',           NULL,     'Remote'),
  ('Paltron',              'bundesweit',         'Recruiting',           NULL,     'Remote'),
  ('Leadec',               'Stuttgart',          'Automation',           NULL,     'Hybrid'),
  ('BARMER',               'Schwäbisch Gmünd',   'Krankenversicherung',  '15000',  'Hybrid'),
  ('Wolters Kluwer TAA',   'Ludwigsburg',        'Software / Tax',       NULL,     'Hybrid');

INSERT INTO jobs (company_id, title, salary_min, salary_max, match_score, source) VALUES
  (1, 'Head of AI',                          85000, 95000,  NULL, 'Stepstone'),
  (4, 'AI Product Portfolio Owner',          NULL,  NULL,   NULL, 'Direkt'),
  (5, 'Senior Feature Owner eCare & KI',     80000, 90000,  70,   'Karriereportal'),
  (6, 'Senior PO ADDISON Datenservice',      65000, 91000,  75,   'Stepstone');

INSERT INTO applications (job_id, status, priority, applied_at, salary_target, portfolio_sent) VALUES
  (1, 'beworben',     'top',      '2026-03-31', 90000, TRUE),
  (2, 'beworben',     'top',      '2026-03-31', NULL,  TRUE),
  (3, 'beworben',     'top',      '2026-04-09', 90000, TRUE),
  (4, 'beworben',     'mittel',   '2026-03-31', NULL,  FALSE);
