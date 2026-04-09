import { useEffect, useState } from "react";
import { fetchApplications, type Application } from "../api/applications";
import { researchCompany, type ResearchResult } from "../api/research";

export default function CompanyInfo() {
  const [apps, setApps]           = useState<Application[]>([]);
  const [selected, setSelected]   = useState<number | null>(null);
  const [result, setResult]       = useState<ResearchResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetchApplications().then(setApps);
  }, []);

  // Eindeutige Unternehmen aus Pipeline
  const companies = Array.from(
    new Map(
      apps
        .filter(a => a.job?.company)
        .map(a => [a.job!.company.id, a.job!.company])
    ).values()
  );

  async function handleResearch(companyId: number) {
    setSelected(companyId);
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const data = await researchCompany(companyId);
      setResult(data);
    } catch {
      setError("Research fehlgeschlagen — Backend erreichbar?");
    } finally {
      setLoading(false);
    }
  }

  const selectedCompany = companies.find(c => c.id === selected);

  return (
    <div className="flex gap-5 h-full">

      {/* Sidebar: Unternehmensliste */}
      <div className="w-56 flex-shrink-0 bg-white rounded-xl border border-blue-100 overflow-hidden self-start">
        <div className="px-4 py-3 border-b border-blue-100">
          <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Pipeline</span>
        </div>
        {companies.length === 0 ? (
          <div className="p-4 text-xs text-blue-300">Keine Unternehmen in der Pipeline.</div>
        ) : (
          <div className="flex flex-col">
            {companies.map(c => (
              <button
                key={c.id}
                onClick={() => handleResearch(c.id)}
                className={`text-left px-4 py-3 text-sm border-b border-blue-50 transition-colors
                  ${selected === c.id
                    ? "bg-blue-600 text-white"
                    : "text-blue-800 hover:bg-blue-50"}`}
              >
                <div className="font-medium truncate">{c.name}</div>
                {c.location && <div className={`text-xs ${selected === c.id ? "text-blue-200" : "text-blue-400"}`}>{c.location}</div>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hauptbereich */}
      <div className="flex-1 flex flex-col gap-4">
        {!selected && (
          <div className="flex items-center justify-center h-48 text-blue-300 text-sm">
            Unternehmen links auswählen
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-xl border border-blue-100 p-6 text-blue-500 text-sm">
            Recherchiere {selectedCompany?.name}…
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">{error}</div>
        )}

        {result && !loading && (
          <>
            {/* Header */}
            <div className="bg-white rounded-xl border border-blue-100 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-blue-900">{result.company}</h2>
                {result.kununu && (
                  <div className="flex items-center gap-2 mt-1">
                    {result.kununu.score != null && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Kununu {result.kununu.score.toFixed(1)}
                      </span>
                    )}
                    {result.kununu.reviews != null && (
                      <span className="text-xs text-blue-400">{result.kununu.reviews} Bewertungen</span>
                    )}
                    <a href={result.kununu.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-700">kununu ↗</a>
                  </div>
                )}
              </div>
              <button
                onClick={() => handleResearch(selected!)}
                className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                Neu laden
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">

              {/* Kontakte */}
              <div className="bg-white rounded-xl border border-blue-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-blue-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Kontakte</span>
                  <span className="text-xs text-blue-400">{result.contacts.length} gefunden</span>
                </div>
                {result.contacts.length === 0 ? (
                  <div className="p-4 text-xs text-blue-300">
                    Keine Kontakte gefunden.<br />
                    Tipp: Website-URL in der DB hinterlegen.
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-blue-50">
                    {result.contacts.map((c, i) => (
                      <div key={i} className="px-4 py-3">
                        {c.name && <div className="text-sm font-medium text-blue-900">{c.name}</div>}
                        {c.role && <div className="text-xs text-blue-500">{c.role}</div>}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-xs text-blue-600 hover:underline block mt-0.5">
                            {c.email}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {result.phones.length > 0 && (
                  <div className="px-4 py-3 border-t border-blue-50">
                    <div className="text-xs text-blue-400 uppercase tracking-wide mb-1">Telefon</div>
                    {result.phones.map((p, i) => (
                      <div key={i} className="text-sm text-blue-700">{p.trim()}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* News */}
              <div className="bg-white rounded-xl border border-blue-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-blue-100">
                  <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Aktuelle News</span>
                </div>
                {result.news.length === 0 ? (
                  <div className="p-4 text-xs text-blue-300">Keine News gefunden.</div>
                ) : (
                  <div className="flex flex-col divide-y divide-blue-50">
                    {result.news.map((n, i) => (
                      <a
                        key={i}
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-3 hover:bg-blue-50 transition-colors block"
                      >
                        <div className="text-sm text-blue-900 leading-snug mb-1">{n.title}</div>
                        <div className="flex items-center gap-2">
                          {n.source && <span className="text-xs text-blue-400">{n.source}</span>}
                          {n.published && (
                            <span className="text-xs text-blue-300">
                              {new Date(n.published).toLocaleDateString("de-DE")}
                            </span>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
