import { useEffect, useState } from "react";
import { importJob, fetchImportedJobs, type ImportedJob } from "../api/scout";
import { MatchBadge } from "./MatchBadge";

const SOURCE_COLORS: Record<string, string> = {
  Stepstone:     "bg-orange-100 text-orange-700",
  LinkedIn:      "bg-blue-100 text-blue-700",
  Indeed:        "bg-indigo-100 text-indigo-700",
  Xing:          "bg-green-100 text-green-700",
  Bundesagentur: "bg-purple-100 text-purple-700",
  Direkt:        "bg-gray-100 text-gray-600",
};

export default function JobFinder() {
  const [url, setUrl]             = useState("");
  const [title, setTitle]         = useState("");
  const [company, setCompany]     = useState("");
  const [notes, setNotes]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<string | null>(null);
  const [jobs, setJobs]           = useState<ImportedJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  useEffect(() => {
    fetchImportedJobs()
      .then(setJobs)
      .finally(() => setJobsLoading(false));
  }, []);

  async function handleImport() {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await importJob(url.trim(), title || undefined, company || undefined, notes || undefined);
      if (data.status === "already_exists") {
        setResult("⚠️ Stelle bereits vorhanden (Job-ID: " + data.job_id + ")");
      } else {
        setResult(`✅ Importiert: "${data.extracted.title}" bei ${data.extracted.company}`);
        setUrl(""); setTitle(""); setCompany(""); setNotes("");
        const updated = await fetchImportedJobs();
        setJobs(updated);
      }
    } catch {
      setResult("❌ Import fehlgeschlagen — Backend erreichbar?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Import-Box */}
      <div className="bg-white rounded-xl border border-blue-100 p-5" data-tour="import-box">
        <h2 className="text-sm font-semibold text-blue-900 mb-4">Stelle importieren</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">URL *</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleImport()}
              placeholder="https://www.stepstone.de/... oder LinkedIn, Indeed, Firmenwebsite"
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Titel (optional)</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Wird automatisch erkannt"
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Unternehmen (optional)</label>
              <input
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="Wird automatisch erkannt"
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Notiz (optional)</label>
            <input
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="z.B. 'Über LinkedIn empfohlen', 'Priorität hoch'"
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={loading || !url.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm px-5 py-2 rounded-lg transition-colors"
            >
              {loading ? "Importiere…" : "Importieren"}
            </button>
            {result && <span className="text-sm text-blue-700">{result}</span>}
          </div>
        </div>
      </div>

      {/* Importierte Stellen */}
      <div className="bg-white rounded-xl border border-blue-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-blue-100 flex items-center justify-between">
          <span className="font-semibold text-blue-900 text-sm">Importierte Stellen</span>
          <span className="text-xs text-blue-400">{jobs.length} noch nicht beworben</span>
        </div>

        {jobsLoading ? (
          <div className="p-6 text-blue-400 text-sm">Lade…</div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-blue-300 text-sm">
            Noch keine Stellen importiert.<br />URL oben einfügen und importieren.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-blue-50 text-blue-800 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Unternehmen</th>
                <th className="text-left px-4 py-3">Stelle</th>
                <th className="text-left px-4 py-3">Quelle</th>
                <th className="text-left px-4 py-3">Match</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="select-text">
              {jobs.map(j => (
                <tr key={j.id} className="border-b border-blue-50 hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-blue-900">{j.company}</td>
                  <td className="px-4 py-3 text-blue-800">{j.title}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_COLORS[j.source] ?? "bg-gray-100 text-gray-600"}`}>
                      {j.source}
                    </span>
                  </td>
                  <td className="px-4 py-3"><MatchBadge score={j.match_score} /></td>
                  <td className="px-4 py-3 text-right">
                    {j.source_url && (
                      <a
                        href={j.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-700 mr-3"
                      >
                        Öffnen ↗
                      </a>
                    )}
                    <button className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors">
                      + Pipeline
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
