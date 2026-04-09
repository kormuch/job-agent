import { useEffect, useState } from "react";
import { fetchApplications, updateStatus, type Application } from "../api/applications";
import { MatchBadge } from "./MatchBadge";

const STATUS_COLORS: Record<string, string> = {
  offen:          "bg-gray-100 text-gray-600",
  kontaktiert:    "bg-blue-100 text-blue-700",
  beworben:       "bg-blue-200 text-blue-800",
  im_gespräch:    "bg-green-100 text-green-700",
  interview:      "bg-purple-100 text-purple-700",
  angebot:        "bg-yellow-100 text-yellow-700",
  abgeschlossen:  "bg-red-100 text-red-600",
  ghosted:        "bg-gray-200 text-gray-500",
};

const STATUSES = ["offen","kontaktiert","beworben","im_gespräch","interview","angebot","abgeschlossen","ghosted"];

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
    return 0;
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

export default function Pipeline() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("company");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  if (loading) return <div className="p-8 text-blue-600">Lade Pipeline...</div>;
  if (error)   return <div className="p-8 text-red-500">{error}</div>;

  const sorted = sortApps(apps, sortKey, sortDir);
  const th = { sortKey, sortDir, onSort: handleSort };

  return (
    <div className="bg-white rounded-xl border border-blue-100 overflow-hidden" data-tour="pipeline-table">
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
            {sorted.map(a => (
              <tr key={a.id} className="border-b border-blue-50 hover:bg-blue-50 transition-colors">
                <td className="px-4 py-3 font-medium text-blue-900">
                  {a.job?.company.name ?? "—"}
                  {a.job?.company.location && (
                    <div className="text-xs text-blue-400 font-normal">{a.job.company.location}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-blue-800">{a.job?.title ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="text-sm">{
                    a.priority === "top" ? "🔴 Top" :
                    a.priority === "mittel" ? "🟡 Mittel" : "🟢 Pipeline"
                  }</span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={a.status}
                    onChange={e => handleStatusChange(a.id, e.target.value)}
                    className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[a.status] ?? "bg-gray-100"}`}
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3"><MatchBadge score={a.job?.match_score} /></td>
                <td className="px-4 py-3 text-blue-700">
                  {a.job?.salary_min && a.job?.salary_max
                    ? `${(a.job.salary_min/1000).toFixed(0)}–${(a.job.salary_max/1000).toFixed(0)}k`
                    : "—"}
                </td>
                <td className="px-4 py-3 text-blue-400 text-xs">{a.applied_at ?? "—"}</td>
                <td className="px-4 py-3 text-blue-400 text-xs">{a.follow_up_date ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
