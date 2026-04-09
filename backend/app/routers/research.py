"""
Company Researcher
- Firmenwebsite scrapen: Kontakte (Email, Telefon, Namen)
- Google News RSS: aktuelle Meldungen
- Kununu: Score + Bewertungen (vorsichtig, mit Throttling)
"""
import re
import asyncio
import feedparser
import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.models import Company, Contact

router = APIRouter(prefix="/research", tags=["research"])

# ── Regex ──────────────────────────────────────────────────────────────────────

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?:\+49|0)\s*[\d\s\-/]{7,15}")

HR_KEYWORDS = [
    "hr", "human resources", "personal", "recruiting", "talent",
    "karriere", "bewerbung", "people", "ceo", "geschäftsführ",
    "head of", "director", "vp ", "chief"
]


def _extract_contacts_from_html(html: str, company_id: int) -> list[dict]:
    """Extrahiert Emails, Telefonnummern und mögliche HR-Namen aus rohem HTML."""
    # Tags entfernen für Textanalyse
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)

    contacts = []

    # Emails
    emails = list(set(EMAIL_RE.findall(text)))
    for email in emails:
        # Spam-Filter: nur wahrscheinliche HR-Adressen
        lower = email.lower()
        if any(k in lower for k in ["hr", "personal", "job", "career", "bewerbung", "recruiting", "info", "kontakt"]):
            contacts.append({
                "email": email,
                "role": _guess_role_from_email(lower),
                "name": None,
            })

    # Telefon
    phones = list(set(PHONE_RE.findall(text)))

    # Namen + Rolle aus Kontext (einfaches Heuristik-Matching)
    # Suche nach "Vorname Nachname\nRolle"-Patterns
    name_role_re = re.compile(
        r"([A-ZÄÖÜ][a-zäöü]+(?:\s[A-ZÄÖÜ][a-zäöü]+){1,2})\s*[\n,·|]\s*([^\n<]{5,60})"
    )
    for m in name_role_re.finditer(text[:50000]):
        name, role = m.group(1).strip(), m.group(2).strip()
        if any(k in role.lower() for k in HR_KEYWORDS):
            contacts.append({"name": name, "role": role, "email": None})

    return contacts[:20], phones[:5]


def _guess_role_from_email(email: str) -> str:
    if "hr" in email or "personal" in email:  return "HR"
    if "job" in email or "career" in email or "bewerbung" in email or "recruiting" in email: return "Recruiting"
    if "info" in email or "kontakt" in email: return "Allgemein"
    return "Unbekannt"


async def _scrape_website(url: str) -> str:
    """Lädt eine Website mit httpx (kein JS). Für JS-heavy Sites Playwright nutzen."""
    if not url.startswith("http"):
        url = "https://" + url
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }) as client:
            resp = await client.get(url)
            return resp.text
    except Exception:
        return ""


async def _scrape_contact_pages(base_url: str) -> str:
    """Versucht /team, /kontakt, /about, /impressum zu scrapen."""
    if not base_url.startswith("http"):
        base_url = "https://" + base_url
    base_url = base_url.rstrip("/")

    slugs = ["/team", "/kontakt", "/contact", "/about", "/uber-uns",
             "/impressum", "/karriere", "/jobs", "/people"]
    html_combined = ""

    async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }) as client:
        for slug in slugs:
            try:
                await asyncio.sleep(1.5)  # sanftes Throttling
                resp = await client.get(base_url + slug)
                if resp.status_code == 200:
                    html_combined += resp.text[:30000]
            except Exception:
                continue

    return html_combined


async def _get_google_news(company_name: str) -> list[dict]:
    """Google News RSS für ein Unternehmen."""
    query = company_name.replace(" ", "+")
    url = f"https://news.google.com/rss/search?q={query}&hl=de&gl=DE&ceid=DE:de"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
        feed = feedparser.parse(resp.text)
        return [
            {
                "title":     entry.get("title", ""),
                "link":      entry.get("link", ""),
                "published": entry.get("published", ""),
                "source":    entry.get("source", {}).get("title", ""),
            }
            for entry in feed.entries[:5]
        ]
    except Exception:
        return []


async def _get_kununu(company_name: str) -> dict | None:
    """Kununu-Score via einfachem HTTP-Request (kein JS nötig für Basis-Daten)."""
    query = company_name.lower().replace(" ", "-").replace("&", "").replace(",", "")
    url = f"https://www.kununu.com/de/{query}"
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }) as client:
            await asyncio.sleep(2)  # Throttling
            resp = await client.get(url)
        if resp.status_code != 200:
            return None
        # Score aus HTML extrahieren
        score_match = re.search(r'"ratingValue"\s*:\s*"?([\d.]+)"?', resp.text)
        count_match = re.search(r'"reviewCount"\s*:\s*"?(\d+)"?', resp.text)
        return {
            "score": float(score_match.group(1)) if score_match else None,
            "reviews": int(count_match.group(1)) if count_match else None,
            "url": str(resp.url),
        }
    except Exception:
        return None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/{company_id}")
async def research_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return {"error": "Unternehmen nicht gefunden"}

    result: dict = {"company": company.name, "contacts": [], "news": [], "kununu": None}

    # 1. Kontakte von Firmenwebsite
    if company.website:
        html = await _scrape_contact_pages(company.website)
        if html:
            contacts_raw, phones = _extract_contacts_from_html(html, company.id)
            result["contacts"] = contacts_raw
            result["phones"] = phones

            # In DB speichern (keine Duplikate)
            for c in contacts_raw:
                if c.get("email"):
                    exists = db.query(Contact).filter(
                        Contact.company_id == company_id,
                        Contact.email == c["email"]
                    ).first()
                    if not exists:
                        db.add(Contact(
                            company_id=company_id,
                            name=c.get("name") or "",
                            role=c.get("role") or "",
                            email=c["email"],
                        ))
            db.commit()

    # 2. News
    result["news"] = await _get_google_news(company.name)

    # 3. Kununu
    result["kununu"] = await _get_kununu(company.name)

    return result


@router.get("/{company_id}/news")
async def company_news(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return {"error": "Unternehmen nicht gefunden"}
    return {"news": await _get_google_news(company.name)}
