import { useEffect, useState } from "react";
import { fetchApplications, updateStatus, type Application } from "../api/applications";
import { MatchBadge } from "./MatchBadge";
import CompanyModal from "./CompanyModal";

const STATUS_COLORS: Record<string, string> = {
  offen:          "bg-gray-100 text-gray-600",
  kontaktiert:    "bg-blue-100 text-blue-700",
  beworben:       "bg-blue-200 text-blue-800",
  im_gespräch:    "bg-green-100 text-green-700",
  interview:      "bg-purple-100 text-purple-700",
  angebot:        "bg-yellow-100 text-yellow-700",
  abgeschlossen:  "bg-green-100 text-green-700",
  absage:         "bg-red-100 text-red-600",
  ghosted:        "bg-gray-200 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  offen:          "Offen",
  kontaktiert:    "Kontaktiert",
  beworben:       "Beworben",
  im_gespräch:    "Im Gespräch",
  interview:      "Interview",
  angebot:        "Angebot",
  abgeschlossen:  "Abgeschlossen",
  absage:         "Absage",
  ghosted:        "Ghosted",
};

const STATUSES = ["offen","kontaktiert","beworben","im_gespräch","interview","angebot","abgeschlossen","absage","ghosted"];

const INACTIVE_STATUSES = new Set(["absage", "ghosted", "abgeschlossen"]);

const PRIORITY_ORDER: Record<string, number> = { top: 0, mittel: 1, pipeline: 2 };

type SortKey = "company" | "title" | "priority" | "status" | "match" | "salary" | "applied" | "followup";
type SortDir = "asc" | "desc";

function sortApps(apps: Application[], key: SortKey, dir: SortDir) {
  return [...apps].sort((a, b) => {
    let av: string | number = "";
    let bv: string | number = "";
    if (key === "company")  { av = a.job?.company.name ?? "";                          bv = b.job?.company.name ?? ""; }
    if (key === "title")    { av = a.job?.title ?? "";                                 bv = b.job?.title ?? ""; }
    if (key === "priority") { av = PRIORITY_ORDER[a.priority] ?? 9;                   bv = PRIORITY_ORDER[b.priority] ?? 9; }
    if (key === "status")   { av = a.status;                                           bv = b.status; }
    if (key === "match")    { av = a.job?.match_score ?? -1;                           bv = b.job?.match_score ?? -1; }
    if (key === "salary")   { av = a.job?.salary_min ?? -1;                            bv = b.job?.salary_min ?? -1; }
    if (key === "applied")  { av = a.applied_at ?? "";                                 bv = b.applied_at ?? ""; }
    if (key === "followup") { av = a.follow_up_date ?? "";                             bv = b.follow_up_date ?? ""; }
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    // Sekundärsortierung: bei Gleichstand nach Unternehmen alphabetisch
    const ac = a.job?.company.name ?? "";
    const bc = b.job?.company.name ?? "";
    return ac.localeCompare(bc, "de");
  });
}

function SortTh({ label, col, sortKey, sortDir, onSort }: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th
      className="text-left px-4 py-3 cursor-pointer select-none hover:text-blue-600 transition-colors whitespace-nowrap"
      onClick={() => onSort(col)}
    >
      <span className="flex items-center gap-1">
        {label}
        <span className="text-blue-400 text-xs">
          {active ? (sortDir === "asc" ? "↑" : "↓") : <span className="opacity-25">↕</span>}
        </span>
      </span>
    </th>
  );
}

const API = "http://localhost:8002";

interface MatchResult {
  score: number;
  strengths: string[];
  gaps: string[];
  summary: string;
}

function MatchDetail({ result, onClose }: { result: MatchResult; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-bold ${result.score >= 70 ? "text-green-600" : result.score >= 50 ? "text-yellow-500" : "text-red-500"}`}>
              {result.score}
            </span>
            <span className="text-blue-400 text-sm">/ 100</span>
          </div>
          <button onClick={onClose} className="text-blue-300 hover:text-blue-600 text-xl">×</button>
        </div>
        <p className="text-sm text-blue-800 mb-4 leading-relaxed">{result.summary}</p>
        {result.strengths.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Stärken</div>
            <ul className="text-sm text-blue-800 space-y-1">
              {result.strengths.map((s, i) => <li key={i} className="flex gap-2"><span className="text-green-500">✓</span>{s}</li>)}
            </ul>
          </div>
        )}
        {result.gaps.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Lücken</div>
            <ul className="text-sm text-blue-800 space-y-1">
              {result.gaps.map((g, i) => <li key={i} className="flex gap-2"><span className="text-red-400">○</span>{g}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

interface JobDetail {
  jobId: number;
  title: string;
  company: string;
  description: string;
  source_url: string | null;
}

function JobDescModal({ job, onClose }: { job: JobDetail; onClose: () => void }) {
  const [desc, setDesc]       = useState(job.description);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState("");

  async function handleFetch() {
    setFetching(true);
    setFetchMsg("");
    try {
      const res = await fetch(`http://localhost:8002/scout/fetch-description/${job.jobId}`, { method: "POST" });
      const data = await res.json();
      if (data.status === "ok" && data.description) {
        setDesc(data.description);
        setFetchMsg("✅ Beschreibung geladen");
      } else {
        setFetchMsg("⚠️ Keine Beschreibung extrahierbar (Seite blockiert oder kein Text)");
      }
    } catch {
      setFetchMsg("❌ Fehler beim Laden");
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-blue-100 flex items-start justify-between gap-4">
          <div>
            <div className="font-semibold text-blue-900 text-base">{job.title}</div>
            <div className="text-sm text-blue-400">{job.company}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {job.source_url && (
              <a href={job.source_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:text-blue-700 underline">
                Original ↗
              </a>
            )}
            <button onClick={onClose} className="text-blue-300 hover:text-blue-600 text-xl">×</button>
          </div>
        </div>
        <div className="px-6 py-4 overflow-y-auto text-sm text-blue-800 leading-relaxed whitespace-pre-wrap flex-1">
          {desc
            ? desc
            : (
              <div className="flex flex-col items-start gap-3">
                <span className="text-blue-300 italic">Keine Stellenbeschreibung gespeichert.</span>
                {job.source_url && (
                  <button
                    onClick={handleFetch}
                    disabled={fetching}
                    className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    {fetching ? "Lade…" : "Beschreibung von URL laden"}
                  </button>
                )}
                {fetchMsg && <span className="text-xs text-blue-600">{fetchMsg}</span>}
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}

export default function Pipeline() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("applied");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [scoring, setScoring] = useState<number | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchResult | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [companyModal, setCompanyModal] = useState<{ id: number; name: string; website: string | null } | null>(null);

  useEffect(() => {
    fetchApplications()
      .then(setApps)
      .catch(() => setError("API nicht erreichbar — Backend läuft?"))
      .finally(() => setLoading(false));
  }, []);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  async function handleStatusChange(id: number, status: string) {
    await updateStatus(id, status);
    setApps(apps.map(a => a.id === id ? { ...a, status } : a));
  }

  async function handleScore(jobId: number) {
    setScoring(jobId);
    try {
      const res = await fetch(`${API}/match/${jobId}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.detail || "Score fehlgeschlagen");
        return;
      }
      const result: MatchResult = await res.json();
      // Update score in app list
      setApps(prev => prev.map(a =>
        a.job?.id === jobId ? { ...a, job: { ...a.job!, match_score: result.score } } : a
      ));
      setMatchDetail(result);
    } finally {
      setScoring(null);
    }
  }

  if (loading) return <div className="p-8 text-blue-600">Lade Pipeline...</div>;
  if (error)   return <div className="p-8 text-red-500">{error}</div>;

  const sorted = sortApps(apps, sortKey, sortDir);
  const th = { sortKey, sortDir, onSort: handleSort };

  return (
    <><div className="bg-white rounded-xl border border-blue-100 overflow-hidden" data-tour="pipeline-table">
      <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between">
        <h2 className="text-base font-semibold text-blue-900">Bewerbungs-Pipeline</h2>
        <span className="text-sm text-blue-400">{apps.length} Einträge</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-50 text-blue-800 text-xs uppercase tracking-wide">
              <SortTh label="Unternehmen" col="company"  {...th} />
              <SortTh label="Stelle"      col="title"    {...th} />
              <SortTh label="Priorität"   col="priority" {...th} />
              <SortTh label="Status"      col="status"   {...th} />
              <SortTh label="Match"       col="match"    {...th} />
              <SortTh label="Gehalt"      col="salary"   {...th} />
              <SortTh label="Beworben"    col="applied"  {...th} />
              <SortTh label="Follow-up"   col="followup" {...th} />
            </tr>
          </thead>
          <tbody className="select-text">
            {sorted.map(a => {
              const inactive = INACTIVE_STATUSES.has(a.status);
              return (
              <tr key={a.id} className={`border-b border-blue-50 transition-colors ${inactive ? "opacity-50" : "hover:bg-blue-50"}`}>
                <td className="px-4 py-3 font-medium text-blue-900">
                  <span
                    className="cursor-pointer hover:text-blue-600 hover:underline"
                    onClick={() => a.job && setCompanyModal({
                      id: a.job.company.id,
                      name: a.job.company.name,
                      website: a.job.company.website ?? null,
                    })}
                    title="Unternehmensinfo"
                  >
                    {a.job?.company.name ?? "—"}
                  </span>
                  {a.job?.company.location && (
                    <div className="text-xs text-blue-400 font-normal">{a.job.company.location}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-blue-800">
                  <span
                    className="cursor-pointer hover:text-blue-600 hover:underline"
                    onClick={() => a.job && setJobDetail({
                      jobId: a.job.id,
                      title: a.job.title,
                      company: a.job.company.name,
                      description: a.job.description,
                      source_url: a.job.source_url ?? null,
                    })}
                    title="Stellenbeschreibung anzeigen"
                  >
                    {a.job?.title ?? "—"}
                  </span>
                  {a.notes && (
                    <div className="text-xs text-blue-400 font-normal truncate max-w-xs" title={a.notes}>{a.notes}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm">{
                    a.priority === "top" ? "🟢 Top" :
                    a.priority === "mittel" ? "🟡 Mittel" : "⚫ Pipeline"
                  }</span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={a.status}
                    onChange={e => handleStatusChange(a.id, e.target.value)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[a.status] ?? "bg-gray-100"}`}
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MatchBadge score={a.job?.match_score} />
                    {a.job?.id && !inactive && (
                      <button
                        onClick={() => handleScore(a.job!.id)}
                        disabled={scoring === a.job.id}
                        title="Match berechnen"
                        className="text-xs text-blue-300 hover:text-blue-600 transition-colors disabled:opacity-40"
                      >
                        {scoring === a.job.id ? "⟳" : "⚡"}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-blue-700 whitespace-nowrap">
                  {a.salary_target
                    ? `${(a.salary_target/1000).toFixed(0)}k`
                    : a.job?.salary_min && a.job?.salary_max
                      ? `${(a.job.salary_min/1000).toFixed(0)}–${(a.job.salary_max/1000).toFixed(0)}k`
                      : "—"}
                  {a.salary_target && a.job?.salary_min && a.job?.salary_max && (
                    <div className="text-xs text-blue-400">{(a.job.salary_min/1000).toFixed(0)}–{(a.job.salary_max/1000).toFixed(0)}k Range</div>
                  )}
                </td>
                <td className="px-4 py-3 text-blue-400 text-xs">{a.applied_at ?? "—"}</td>
                <td className="px-4 py-3 text-blue-400 text-xs">{a.follow_up_date ?? "—"}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {matchDetail && (
      <MatchDetail result={matchDetail} onClose={() => setMatchDetail(null)} />
    )}
    {jobDetail && (
      <JobDescModal job={jobDetail} onClose={() => setJobDetail(null)} />
    )}
    {companyModal && (
      <CompanyModal
        companyId={companyModal.id}
        companyName={companyModal.name}
        websiteUrl={companyModal.website}
        onClose={() => setCompanyModal(null)}
      />
    )}
    </>
  );
}
