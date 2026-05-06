import { useEffect, useState } from "react";

const API = "http://localhost:8002";

interface Contact { name?: string; role?: string; email?: string; phone?: string; }
interface Kununu  { score: number | null; reviews: number | null; url: string; }

interface ResearchResult {
  company:      string;
  logo_url:     string;
  description:  string;
  culture_text: string;
  ceo_name:     string;
  contacts:     Contact[];
  phones:       string[];
  kununu:       Kununu | null;
  cached:       boolean;
  fetched_at:   string | null;
}

const STEPS = [
  "Lade Startseite…",
  "Suche Kultur & Philosophie…",
  "Suche Kontakte & Team…",
  "Prüfe Impressum (CEO)…",
  "Lade Kununu-Bewertungen…",
  "Speichere Ergebnisse…",
];

function CacheTag({ cached, fetched_at }: { cached: boolean; fetched_at: string | null }) {
  if (!fetched_at) return null;
  const date = new Date(fetched_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const time = new Date(fetched_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${cached ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}`}>
      {cached ? `Cache ${date} ${time}` : `Aktuell — ${date} ${time}`}
    </span>
  );
}

async function patchWebsite(companyId: number, website: string) {
  await fetch(`${API}/applications/companies/${companyId}/website`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ website }),
  });
}

interface Props {
  companyId: number;
  companyName: string;
  websiteUrl: string | null;
  onClose: () => void;
}

export default function CompanyModal({ companyId, companyName, websiteUrl, onClose }: Props) {
  const [result, setResult]           = useState<ResearchResult | null>(null);
  const [loading, setLoading]         = useState(false);
  const [stepIdx, setStepIdx]         = useState(0);
  const [error, setError]             = useState<string | null>(null);
  const [editWebsite, setEditWebsite] = useState(false);
  const [websiteInput, setWebsiteInput] = useState(websiteUrl || "");

  useEffect(() => {
    if (websiteUrl) handleResearch(false);
  }, []);

  async function handleResearch(force: boolean) {
    setResult(null);
    setError(null);
    setLoading(true);
    setStepIdx(0);
    setEditWebsite(false);

    const interval = setInterval(() => {
      setStepIdx(i => Math.min(i + 1, STEPS.length - 1));
    }, 1800);

    try {
      const res = await fetch(`${API}/research/${companyId}${force ? "?force=true" : ""}`);
      if (!res.ok) throw new Error();
      const data: ResearchResult = await res.json();
      setResult(data);
    } catch {
      setError("Recherche fehlgeschlagen — Backend erreichbar?");
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  async function handleSaveWebsite() {
    if (!websiteInput.trim()) return;
    await patchWebsite(companyId, websiteInput.trim());
    setEditWebsite(false);
    handleResearch(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="font-semibold text-blue-900 text-base">{companyName}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResearch(true)}
              disabled={loading}
              className="text-xs text-blue-400 hover:text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            >
              Neu laden
            </button>
            <button onClick={onClose} className="text-blue-300 hover:text-blue-600 text-xl">×</button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">

          {/* Website-Bar */}
          <div className="flex items-center gap-3 bg-blue-50 rounded-lg px-4 py-2">
            <span className="text-xs font-medium text-blue-500 flex-shrink-0">Website</span>
            {editWebsite ? (
              <>
                <input
                  autoFocus
                  type="text"
                  value={websiteInput}
                  onChange={e => setWebsiteInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveWebsite(); if (e.key === "Escape") setEditWebsite(false); }}
                  placeholder="https://firma.de"
                  className="flex-1 text-sm border border-blue-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button onClick={handleSaveWebsite} className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700">Speichern</button>
                <button onClick={() => setEditWebsite(false)} className="text-xs text-blue-400 hover:text-blue-600">Abbrechen</button>
              </>
            ) : (
              <>
                {websiteInput ? (
                  <a href={websiteInput} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline truncate flex-1">
                    {websiteInput}
                  </a>
                ) : (
                  <span className="text-sm text-blue-300 flex-1">— noch nicht hinterlegt</span>
                )}
                <button
                  onClick={() => setEditWebsite(true)}
                  className="text-xs text-blue-400 hover:text-blue-600 border border-blue-200 px-2 py-1 rounded-lg flex-shrink-0 bg-white"
                >
                  {websiteInput ? "Bearbeiten" : "+ URL"}
                </button>
              </>
            )}
          </div>

          {/* Hinweis wenn keine Website */}
          {!websiteInput && !loading && !result && !error && (
            <div className="text-sm text-blue-400 py-4">
              Keine Website hinterlegt — URL oben eingeben um Unternehmensinfos zu laden.
            </div>
          )}

          {/* Ladefortschritt */}
          {loading && (
            <div className="flex flex-col gap-2 py-2">
              {STEPS.map((step, i) => (
                <div key={i} className={`flex items-center gap-3 text-sm transition-all
                  ${i < stepIdx ? "text-green-600" : i === stepIdx ? "text-blue-700 font-medium" : "text-gray-300"}`}>
                  <span>{i < stepIdx ? "✓" : i === stepIdx ? "⟳" : "○"}</span>
                  {step}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">{error}</div>
          )}

          {result && !loading && (
            <>
              {/* Header Card */}
              <div className="flex items-start gap-4">
                {result.logo_url && (
                  <img
                    src={result.logo_url}
                    alt={result.company}
                    className="w-14 h-14 object-contain rounded-lg border border-blue-100 flex-shrink-0 bg-white p-1"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {result.kununu?.score != null && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Kununu {result.kununu.score.toFixed(1)}
                        {result.kununu.reviews ? ` (${result.kununu.reviews})` : ""}
                      </span>
                    )}
                    <CacheTag cached={result.cached} fetched_at={result.fetched_at} />
                  </div>
                  {result.ceo_name && (
                    <div className="text-xs text-blue-500 mb-1">CEO / GF: <span className="font-medium text-blue-800">{result.ceo_name}</span></div>
                  )}
                  {result.description && (
                    <p className="text-sm text-blue-700 leading-relaxed">{result.description}</p>
                  )}
                </div>
              </div>

              {/* Kultur */}
              {result.culture_text && (
                <div>
                  <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">Kultur & Philosophie</div>
                  <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-line">{result.culture_text}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Kontakte */}
                <div className="border border-blue-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 border-b border-blue-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Kontakte</span>
                    <span className="text-xs text-blue-400">{result.contacts.length}</span>
                  </div>
                  {result.contacts.length === 0 ? (
                    <div className="p-4 text-xs text-blue-300">Keine Kontakte gefunden.</div>
                  ) : (
                    <div className="divide-y divide-blue-50">
                      {result.contacts.map((c, i) => (
                        <div key={i} className="px-4 py-3">
                          {c.name && <div className="text-sm font-medium text-blue-900">{c.name}</div>}
                          {c.role && <div className="text-xs text-blue-500">{c.role}</div>}
                          {c.email && (
                            <a href={`mailto:${c.email}`} className="text-xs text-blue-600 hover:underline block mt-0.5">{c.email}</a>
                          )}
                          {c.phone && <div className="text-xs text-blue-400 mt-0.5">{c.phone}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {result.phones.length > 0 && (
                    <div className="px-4 py-3 border-t border-blue-50">
                      <div className="text-xs text-blue-400 mb-1">Telefon</div>
                      {result.phones.map((p, i) => (
                        <div key={i} className="text-sm text-blue-700">{p}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Kununu */}
                <div className="border border-blue-100 rounded-xl p-4">
                  <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-3">Kununu</div>
                  {result.kununu ? (
                    <div className="flex flex-col gap-2">
                      {result.kununu.score != null && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-green-600">{result.kununu.score.toFixed(1)}</span>
                          <span className="text-blue-400 text-sm">/ 5</span>
                        </div>
                      )}
                      {result.kununu.reviews != null && (
                        <div className="text-xs text-blue-400">{result.kununu.reviews} Bewertungen</div>
                      )}
                      {result.kununu.url && (
                        <a href={result.kununu.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-700">
                          Alle Bewertungen ↗
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-blue-300">Kein Kununu-Eintrag gefunden.</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
