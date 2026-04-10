"""
Company Researcher
- Homepage: Logo, Beschreibung, Kultur/Philosophie, CEO aus Impressum
- Kontakte: HR-Ansprechpartner (Email, Telefon, Name)
- Kununu: Score + Bewertungsanzahl
Ergebnisse werden mit Timestamp in SQLite gespeichert.
Cache: Kontakte/HP 7 Tage, Kununu 7 Tage.
"""
import re
import asyncio
from datetime import datetime, timedelta
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.models import Company, Contact

router = APIRouter(prefix="/research", tags=["research"])

CACHE_DAYS = 7
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
}

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?:\+49|0)[0-9\s\-/()]{7,20}")
HR_KEYS  = ["hr", "personal", "recruiting", "talent", "karriere", "bewerbung",
            "people", "ceo", "geschäftsführ", "head of", "director", "chief"]


# ── Hilfsfunktionen ────────────────────────────────────────────────────────────

def _is_stale(ts: str | None) -> bool:
    if not ts:
        return True
    try:
        return datetime.fromisoformat(ts) < datetime.now() - timedelta(days=CACHE_DAYS)
    except Exception:
        return True

def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")

def _meta(html: str, prop: str) -> str:
    for pattern in [
        rf'<meta[^>]+(?:property|name)="{re.escape(prop)}"[^>]+content="([^"]+)"',
        rf'<meta[^>]+content="([^"]+)"[^>]+(?:property|name)="{re.escape(prop)}"',
    ]:
        m = re.search(pattern, html, re.I)
        if m:
            return m.group(1).strip()
    return ""

def _strip_tags(html: str) -> str:
    text = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.S)
    text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s{2,}", " ", text).strip()

async def _fetch(url: str, client: httpx.AsyncClient) -> str:
    try:
        await asyncio.sleep(1.2)
        r = await client.get(url, timeout=10, follow_redirects=True)
        return r.text if r.status_code == 200 else ""
    except Exception:
        return ""

def _base(website: str) -> str:
    if not website:
        return ""
    if not website.startswith("http"):
        website = "https://" + website
    return website.rstrip("/")


# ── Extraktion ─────────────────────────────────────────────────────────────────

def _extract_homepage(html: str) -> dict:
    """Logo-URL und Kurzbeschreibung aus der Startseite."""
    logo = (
        _meta(html, "og:image") or
        _meta(html, "twitter:image") or
        ""
    )
    desc = (
        _meta(html, "og:description") or
        _meta(html, "description") or
        _meta(html, "twitter:description") or
        ""
    )
    return {"logo_url": logo[:500], "description": desc[:1000]}


def _extract_culture(pages_html: list[str]) -> str:
    """Kultur-/Philosophietext aus About/Karriere/Über-uns-Seiten."""
    combined = " ".join(_strip_tags(h) for h in pages_html if h)

    # Relevante Abschnitte via Keywords herausschneiden
    culture_keys = [
        "unsere werte", "our values", "philosophie", "philosophy",
        "mission", "vision", "kultur", "culture", "wir sind", "we are",
        "warum wir", "why us", "was uns ausmacht", "über uns",
        "unser team", "arbeiten bei", "work with us",
    ]
    snippets = []
    for kw in culture_keys:
        idx = combined.lower().find(kw)
        if idx != -1:
            snippet = combined[max(0, idx - 50): idx + 500].strip()
            if snippet not in snippets:
                snippets.append(snippet)

    result = " … ".join(snippets[:5])
    return result[:3000] if result else combined[:1500]


def _extract_ceo(impressum_html: str) -> str:
    """Geschäftsführer aus dem Impressum."""
    text = _strip_tags(impressum_html)
    patterns = [
        r"Geschäftsführ(?:er|erin|ung)[:\s]+([A-ZÄÖÜ][a-zäöü]+(?: [A-ZÄÖÜ][a-zäöü]+){1,3})",
        r"CEO[:\s]+([A-ZÄÖÜ][a-zäöü]+(?: [A-ZÄÖÜ][a-zäöü]+){1,3})",
        r"Vorstand[:\s]+([A-ZÄÖÜ][a-zäöü]+(?: [A-ZÄÖÜ][a-zäöü]+){1,3})",
        r"Vertreten durch[:\s]+([A-ZÄÖÜ][a-zäöü]+(?: [A-ZÄÖÜ][a-zäöü]+){1,3})",
        r"Managing Director[:\s]+([A-ZÄÖÜ][a-zäöü]+(?: [A-ZÄÖÜ][a-zäöü]+){1,3})",
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            return m.group(1).strip()
    return ""


def _extract_contacts(pages_html: list[str]) -> tuple[list[dict], list[str]]:
    """Emails, Telefonnummern und HR-Kontakt-Namen aus mehreren Seiten."""
    combined = " ".join(pages_html)
    text = _strip_tags(combined)

    contacts = []
    seen_emails: set[str] = set()

    # Emails
    for email in EMAIL_RE.findall(combined):
        email = email.lower()
        if email in seen_emails:
            continue
        seen_emails.add(email)
        if any(k in email for k in ["hr", "personal", "job", "career",
                                     "bewerbung", "recruiting", "info", "kontakt"]):
            role = ("HR/Recruiting" if any(k in email for k in
                    ["hr", "personal", "job", "career", "bewerbung", "recruiting"])
                    else "Allgemein")
            contacts.append({"name": None, "role": role, "email": email})

    # Name + Rolle aus Fließtext
    name_re = re.compile(
        r"([A-ZÄÖÜ][a-zäöü\-]+(?:\s[A-ZÄÖÜ][a-zäöü\-]+){1,2})"
        r"\s*[\n,·|\-–]\s*([^\n<]{5,80})"
    )
    for m in name_re.finditer(text[:60000]):
        name, role = m.group(1).strip(), m.group(2).strip()
        if any(k in role.lower() for k in HR_KEYS) and len(name.split()) >= 2:
            if not any(c.get("name") == name for c in contacts):
                contacts.append({"name": name, "role": role[:120], "email": None})

    phones = list(dict.fromkeys(
        p.strip() for p in PHONE_RE.findall(text) if len(p.strip()) >= 8
    ))[:5]

    return contacts[:15], phones


# ── Hauptfunktion ──────────────────────────────────────────────────────────────

async def _do_research(company: Company, force: bool = False) -> dict:
    base = _base(company.website or "")
    result: dict = {
        "logo_url": company.logo_url or "",
        "description": company.description or "",
        "culture_text": company.culture_text or "",
        "ceo_name": company.ceo_name or "",
        "contacts": [],
        "phones": [],
        "kununu": None,
        "cached": not force and not _is_stale(company.research_fetched_at),
        "fetched_at": company.research_fetched_at,
    }

    if not base:
        return result

    stale = force or _is_stale(company.research_fetched_at)

    async with httpx.AsyncClient(headers=HEADERS) as client:
        if stale:
            # Startseite
            home_html = await _fetch(base, client)

            # Kulturseiten
            culture_slugs = ["/ueber-uns", "/uber-uns", "/about", "/about-us",
                             "/karriere", "/jobs", "/team", "/philosophy", "/values"]
            culture_pages = []
            for slug in culture_slugs:
                html = await _fetch(base + slug, client)
                if html:
                    culture_pages.append(html)
                if len(culture_pages) >= 3:
                    break

            # Kontaktseiten
            contact_slugs = ["/team", "/kontakt", "/contact", "/impressum",
                             "/about", "/people", "/karriere"]
            contact_pages = []
            for slug in contact_slugs:
                html = await _fetch(base + slug, client)
                if html:
                    contact_pages.append(html)

            # Impressum separat für CEO
            impressum_html = await _fetch(base + "/impressum", client)

            # Extrahieren
            home_data  = _extract_homepage(home_html)
            culture    = _extract_culture(culture_pages)
            ceo        = _extract_ceo(impressum_html)
            contacts, phones = _extract_contacts(contact_pages)

            result.update({
                "logo_url":     home_data["logo_url"],
                "description":  home_data["description"],
                "culture_text": culture,
                "ceo_name":     ceo,
                "contacts":     contacts,
                "phones":       phones,
                "cached":       False,
                "fetched_at":   _now(),
            })

        # Kununu
        if force or _is_stale(company.kununu_fetched_at):
            kununu = await _scrape_kununu(company.name, client)
            result["kununu"] = kununu
        elif company.kununu_score is not None:
            result["kununu"] = {"score": float(company.kununu_score), "reviews": None, "url": ""}

    return result


async def _scrape_kununu(name: str, client: httpx.AsyncClient) -> dict | None:
    slug = re.sub(r"[^a-z0-9\-]", "-", name.lower().replace(" ", "-"))
    slug = re.sub(r"-+", "-", slug).strip("-")
    url  = f"https://www.kununu.com/de/{slug}"
    try:
        await asyncio.sleep(2)
        r = await client.get(url, timeout=10, follow_redirects=True)
        if r.status_code != 200:
            return None
        score = re.search(r'"ratingValue"\s*:\s*"?([\d.]+)"?', r.text)
        count = re.search(r'"reviewCount"\s*:\s*"?(\d+)"?', r.text)
        return {
            "score":   float(score.group(1)) if score else None,
            "reviews": int(count.group(1))   if count else None,
            "url":     str(r.url),
        }
    except Exception:
        return None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/{company_id}")
async def research_company(
    company_id: int,
    force: bool = False,
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return {"error": "Unternehmen nicht gefunden"}

    # Aus Cache liefern wenn frisch
    if not force and not _is_stale(company.research_fetched_at):
        contacts = [
            {"name": c.name, "role": c.role, "email": c.email, "phone": c.phone}
            for c in company.contacts
        ]
        return {
            "company":      company.name,
            "logo_url":     company.logo_url or "",
            "description":  company.description or "",
            "culture_text": company.culture_text or "",
            "ceo_name":     company.ceo_name or "",
            "contacts":     contacts,
            "phones":       [],
            "kununu":       {"score": float(company.kununu_score), "reviews": None, "url": ""}
                            if company.kununu_score else None,
            "cached":       True,
            "fetched_at":   company.research_fetched_at,
        }

    # Live recherchieren
    data = await _do_research(company, force=force)

    # In DB speichern
    company.logo_url            = data["logo_url"]   or company.logo_url
    company.description         = data["description"] or company.description
    company.culture_text        = data["culture_text"] or company.culture_text
    company.ceo_name            = data["ceo_name"]    or company.ceo_name
    company.research_fetched_at = data["fetched_at"]

    if data.get("kununu") and data["kununu"].get("score"):
        company.kununu_score      = data["kununu"]["score"]
        company.kununu_fetched_at = _now()

    # Kontakte speichern
    for c in data.get("contacts", []):
        if c.get("email"):
            exists = db.query(Contact).filter(
                Contact.company_id == company_id,
                Contact.email == c["email"]
            ).first()
            if not exists:
                db.add(Contact(
                    company_id = company_id,
                    name       = c.get("name") or "",
                    role       = c.get("role") or "",
                    email      = c["email"],
                ))
        elif c.get("name"):
            exists = db.query(Contact).filter(
                Contact.company_id == company_id,
                Contact.name == c["name"]
            ).first()
            if not exists:
                db.add(Contact(
                    company_id = company_id,
                    name       = c["name"],
                    role       = c.get("role") or "",
                ))

    db.commit()

    # Kontakte aus DB zurückgeben
    data["contacts"] = [
        {"name": c.name, "role": c.role, "email": c.email, "phone": c.phone}
        for c in company.contacts
    ]
    data["company"] = company.name
    return data
