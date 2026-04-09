import { useEffect, useState } from "react";
import { fetchApplications, type Application } from "../api/applications";
import { MatchBadge } from "./MatchBadge";

const STATUS_COLORS: Record<string, string> = {
  offen:         "bg-gray-100 text-gray-600",
  kontaktiert:   "bg-blue-100 text-blue-700",
  beworben:      "bg-blue-200 text-blue-800",
  im_gespräch:   "bg-green-100 text-green-700",
  interview:     "bg-purple-100 text-purple-700",
  angebot:       "bg-yellow-100 text-yellow-700",
  abgeschlossen: "bg-red-100 text-red-600",
  ghosted:       "bg-gray-200 text-gray-500",
};

type SortKey = "company" | "title" | "status" | "match" | "followup";
type SortDir = "asc" | "desc";

function sortApps(apps: Application[], key: SortKey, dir: SortDir) {
  return [...apps].sort((a, b) => {
    let av: string | number = "";
    let bv: string | number = "";
    if (key === "company")  { av = a.job?.company.name ?? ""; bv = b.job?.company.name ?? ""; }
    if (key === "title")    { av = a.job?.title ?? "";        bv = b.job?.title ?? ""; }
    if (key === "status")   { av = a.status;                  bv = b.status; }
    if (key === "match")    { av = a.job?.match_score ?? -1;  bv = b.job?.match_score ?? -1; }
    if (key === "followup") { av = a.follow_up_date ?? "";    bv = b.follow_up_date ?? ""; }
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

function SortTh({ label, col, sortKey, sortDir, onSort }: {
  label: string; col: SortKey; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void;
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

function KpiCard({ label, value, sub, warn }: { label: string; value: string | number; sub: string; warn?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-blue-100 p-5">
      <div className="text-xs text-blue-400 uppercase tracking-wide mb-2">{label}</div>
      <div className={`text-4xl font-bold ${warn ? "text-orange-500" : "text-blue-600"}`}>{value}</div>
      <div className="text-xs text-blue-400 mt-1">{sub}</div>
    </div>
  );
}

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("company");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  useEffect(() => {
    fetchApplications()
      .then(setApps)
      .finally(() => setLoading(false));
  }, []);

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const active   = apps.filter(a => !["abgeschlossen", "ghosted"].includes(a.status));
  const inTalk   = apps.filter(a => ["im_gespräch", "interview", "angebot"].includes(a.status));
  const followUp = apps.filter(a => a.follow_up_date && new Date(a.follow_up_date) <= new Date());
  const withScore = apps.filter(a => a.job?.match_score != null);
  const avgScore = withScore.length
    ? Math.round(withScore.reduce((s, a) => s + a.job!.match_score!, 0) / withScore.length)
    : null;

  const preview = sortApps(apps.slice(0, 5), sortKey, sortDir);
  const th = { sortKey, sortDir, onSort: handleSort };

  if (loading) return <div className="p-8 text-blue-600">Lade Dashboard...</div>;

  return (
    <div className="flex flex-col gap-5">

      <div className="grid grid-cols-4 gap-4" data-tour="kpi-row">
        <KpiCard label="Aktive Bewerbungen" value={active.length} sub={`von ${apps.length} gesamt`} />
        <KpiCard label="Im Gespräch" value={inTalk.length} sub={inTalk.map(a => a.job?.company.name ?? "").filter(Boolean).join(", ") || "—"} />
        <KpiCard label="Ø Match-Score" value={avgScore != null ? `${avgScore}%` : "—"} sub="Ziel: > 70%" />
        <KpiCard label="Follow-ups fällig" value={followUp.length} sub={followUp.map(a => a.job?.company.name ?? "").filter(Boolean).join(", ") || "Keine"} warn={followUp.length > 0} />
      </div>

      <div className="bg-white rounded-xl border border-blue-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-blue-100 flex items-center justify-between">
          <span className="font-semibold text-blue-900 text-sm">Aktuelle Pipeline</span>
          <button onClick={() => onNavigate("pipeline")} className="text-xs text-blue-500 hover:text-blue-700 transition-colors">
            Alle anzeigen →
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-blue-50 text-blue-800 text-xs uppercase tracking-wide">
              <SortTh label="Unternehmen" col="company"  {...th} />
              <SortTh label="Stelle"      col="title"    {...th} />
              <SortTh label="Status"      col="status"   {...th} />
              <SortTh label="Match"       col="match"    {...th} />
              <SortTh label="Follow-up"   col="followup" {...th} />
            </tr>
          </thead>
          <tbody className="select-text">
            {preview.map(a => (
              <tr key={a.id} className="border-b border-blue-50 hover:bg-blue-50 transition-colors cursor-pointer" onClick={() => onNavigate("pipeline")}>
                <td className="px-4 py-3 font-medium text-blue-900">{a.job?.company.name ?? "—"}</td>
                <td className="px-4 py-3 text-blue-700">{a.job?.title ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[a.status] ?? "bg-gray-100"}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3"><MatchBadge score={a.job?.match_score} /></td>
                <td className="px-4 py-3 text-xs text-blue-400">{a.follow_up_date ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
