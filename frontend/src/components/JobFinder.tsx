import { useEffect, useRef, useState } from "react";
import {
  importJob, fetchImportedJobs, autoSearch,
  fetchSearchProfiles, createSearchProfile, updateSearchProfile, toggleSearchProfile, runSearchProfile,
  type ImportedJob, type SearchResult, type SearchProfile,
} from "../api/scout";
import { MatchBadge } from "./MatchBadge";

const SCHEDULER_INTERVAL_MS = 30 * 60 * 1000; // 30 Minuten

const SOURCE_COLORS: Record<string, string> = {
  Stepstone:     "bg-orange-100 text-orange-700",
  LinkedIn:      "bg-blue-100 text-blue-700",
  Indeed:        "bg-indigo-100 text-indigo-700",
  Xing:          "bg-green-100 text-green-700",
  Bundesagentur: "bg-purple-100 text-purple-700",
  Direkt:        "bg-gray-100 text-gray-600",
  "jobs.ch":     "bg-red-100 text-red-700",
  "jobup.ch":    "bg-red-100 text-red-600",
  "workable.com":"bg-teal-100 text-teal-700",
};

export default function JobFinder({ onNavigate }: { onNavigate?: (page: string) => void }) {
  const [url, setUrl]             = useState("");
  const [notes, setNotes]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<string | null>(null);
  const [jobs, setJobs]           = useState<ImportedJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  // Gespeicherte Jobsuchen / Personas
  const [profiles, setProfiles]               = useState<SearchProfile[]>([]);
  const [newName, setNewName]                 = useState("");
  const [newQuery, setNewQuery]               = useState("");
  const [newLocation, setNewLocation]         = useState("");
  const [newCvText, setNewCvText]             = useState("");
  const [newPrompt, setNewPrompt]             = useState("");
  const [showNewForm, setShowNewForm]         = useState(false);
  const [savingProfile, setSavingProfile]     = useState(false);
  const [profileResults, setProfileResults]   = useState<Record<number, SearchResult[]>>({});
  const [profileRunning, setProfileRunning]   = useState<Record<number, boolean>>({});
  const [expandedProfile, setExpandedProfile] = useState<number | null>(null);
  const [editingProfile, setEditingProfile]   = useState<Record<number, Partial<SearchProfile>>>({});
  const [savingEdit, setSavingEdit]           = useState<Record<number, boolean>>({});

  // JobAgent Scout
  const [searchResults, setSearchResults]   = useState<SearchResult[]>([]);
  const [searching, setSearching]           = useState(false);
  const [searchStatus, setSearchStatus]     = useState<string>("");
  const [queriesUsed, setQueriesUsed]       = useState<string[]>([]);
  const [importing, setImporting]           = useState<Record<string, boolean>>({});
  const [imported, setImported]             = useState<Set<string>>(new Set());
  const [addingToPipeline, setAddingToPipeline] = useState<Record<number, boolean>>({});
  const [inPipeline, setInPipeline]         = useState<Set<number>>(new Set());
  const [schedulerActive, setSchedulerActive] = useState(false);
  const [lastRun, setLastRun]               = useState<string>("");
  const [countdown, setCountdown]           = useState(0);
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchImportedJobs()
      .then(setJobs)
      .finally(() => setJobsLoading(false));
    fetchSearchProfiles().then(setProfiles);
  }, []);

  async function handleSaveProfile() {
    if (!newName.trim() || !newQuery.trim()) return;
    setSavingProfile(true);
    try {
      const p = await createSearchProfile(
        newName.trim(), newQuery.trim(),
        newLocation.trim() || undefined,
        newCvText.trim() || undefined,
        newPrompt.trim() || undefined,
      );
      setProfiles(prev => [...prev, p]);
      setNewName(""); setNewQuery(""); setNewLocation(""); setNewCvText(""); setNewPrompt(""); setShowNewForm(false);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleToggleProfile(id: number) {
    const updated = await toggleSearchProfile(id);
    setProfiles(prev => prev.map(p => p.id === id ? updated : p));
  }

  async function handleSaveEdit(id: number) {
    const changes = editingProfile[id];
    if (!changes) return;
    setSavingEdit(prev => ({ ...prev, [id]: true }));
    try {
      const updated = await updateSearchProfile(id, changes);
      setProfiles(prev => prev.map(p => p.id === id ? updated : p));
      setEditingProfile(prev => { const n = {...prev}; delete n[id]; return n; });
    } finally {
      setSavingEdit(prev => ({ ...prev, [id]: false }));
    }
  }

  function patchEdit(id: number, field: string, value: string) {
    setEditingProfile(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function handleRunProfile(id: number) {
    setProfileRunning(prev => ({ ...prev, [id]: true }));
    try {
      const data = await runSearchProfile(id);
      setProfileResults(prev => ({ ...prev, [id]: data.results }));
    } finally {
      setProfileRunning(prev => ({ ...prev, [id]: false }));
    }
  }

  // Scheduler cleanup
  useEffect(() => {
    return () => {
      if (schedulerRef.current) clearInterval(schedulerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  async function runSearch() {
    setSearching(true);
    setSearchStatus("🔍 JobAgent generiert Suchbegriffe aus deinem Profil…");
    try {
      const data = await autoSearch();
      setSearchResults(data.results);
      setQueriesUsed(data.queries_used ?? []);
      const now = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      setLastRun(now);
      setSearchStatus(`✅ ${data.results.length} Stellen gefunden — ${now}`);
    } catch {
      setSearchStatus("❌ Suche fehlgeschlagen — Backend erreichbar?");
    } finally {
      setSearching(false);
    }
  }

  function toggleScheduler() {
    if (schedulerActive) {
      if (schedulerRef.current) clearInterval(schedulerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      schedulerRef.current = null;
      countdownRef.current = null;
      setSchedulerActive(false);
      setCountdown(0);
      setSearchStatus("⏹ Scheduler gestoppt.");
    } else {
      setSchedulerActive(true);
      runSearch();
      setCountdown(SCHEDULER_INTERVAL_MS / 1000);
      schedulerRef.current = setInterval(() => {
        runSearch();
        setCountdown(SCHEDULER_INTERVAL_MS / 1000);
      }, SCHEDULER_INTERVAL_MS);
      countdownRef.current = setInterval(() => {
        setCountdown(c => (c > 0 ? c - 1 : 0));
      }, 1000);
    }
  }

  async function handleImportResult(r: SearchResult) {
    setImporting(prev => ({ ...prev, [r.url]: true }));
    try {
      await importJob(r.url, r.title || undefined, r.company || undefined);
      setImported(prev => new Set(prev).add(r.url));
      const updated = await fetchImportedJobs();
      setJobs(updated);
    } catch { /* ignore */ }
    setImporting(prev => ({ ...prev, [r.url]: false }));
  }

  function formatCountdown(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  async function handleAddToPipeline(jobId: number) {
    setAddingToPipeline(prev => ({ ...prev, [jobId]: true }));
    try {
      const res = await fetch("http://localhost:8002/applications/from-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      if (res.ok) {
        setInPipeline(prev => new Set(prev).add(jobId));
        // Job aus der importierten Liste entfernen (ist jetzt in Pipeline)
        const updated = await fetchImportedJobs();
        setJobs(updated);
      }
    } catch { /* ignore */ }
    setAddingToPipeline(prev => ({ ...prev, [jobId]: false }));
  }

  async function handleImport() {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await importJob(url.trim(), undefined, undefined, notes || undefined);
      if (data.status === "already_exists") {
        setResult(data.in_pipeline
          ? "⚠️ Diese Stelle ist bereits in deiner Pipeline"
          : "⚠️ Diese Stelle wurde bereits importiert");
        const updated = await fetchImportedJobs();
        setJobs(updated);
      } else {
        setResult(`✅ Importiert: "${data.extracted.title}" bei ${data.extracted.company}`);
        setUrl(""); setNotes("");
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

      {/* Gespeicherte Jobsuchen */}
      <div className="bg-white rounded-xl border border-blue-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-blue-900">Meine Jobsuchen</h2>
            <p className="text-xs text-blue-400 mt-0.5">Gespeicherte Suchen für verschiedene Rollen &amp; Regionen</p>
          </div>
          <button
            onClick={() => setShowNewForm(f => !f)}
            className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
          >
            + Neue Suche
          </button>
        </div>

        {/* Neue Persona anlegen */}
        {showNewForm && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4 flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Name *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="z.B. AI Consulting Schweiz"
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Suchbegriff *</label>
                <input value={newQuery} onChange={e => setNewQuery(e.target.value)}
                  placeholder="z.B. AI Consultant Workshop"
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Ort</label>
                <input value={newLocation} onChange={e => setNewLocation(e.target.value)}
                  placeholder="z.B. Zürich"
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
            </div>
            <div>
              <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Bewerberprofil / CV-Kurzfassung</label>
              <textarea value={newCvText} onChange={e => setNewCvText(e.target.value)} rows={4}
                placeholder="Wer bist du in dieser Rolle? Was bringst du mit? (wird für Match-Scoring genutzt)"
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
            </div>
            <div>
              <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Such-Prompt (für KI-Querygeneration)</label>
              <textarea value={newPrompt} onChange={e => setNewPrompt(e.target.value)} rows={3}
                placeholder="z.B. Ich suche AI Consulting / Workshop-Rollen in der Schweiz. Gehalt ab 110k CHF. Keine reinen IT-internen Rollen."
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveProfile} disabled={savingProfile || !newName.trim() || !newQuery.trim()}
                className="text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 px-4 py-2 rounded-lg font-medium transition-colors">
                {savingProfile ? "Speichern…" : "Speichern"}
              </button>
              <button onClick={() => setShowNewForm(false)}
                className="text-sm text-blue-500 hover:text-blue-700 px-4 py-2 rounded-lg transition-colors">
                Abbrechen
              </button>
            </div>
          </div>
        )}

        {/* Liste der Personas */}
        {profiles.length === 0 && !showNewForm ? (
          <p className="text-xs text-blue-300 text-center py-4">Noch keine Jobsuchen angelegt. Klick auf "+ Neue Suche".</p>
        ) : (
          <div className="flex flex-col gap-3">
            {profiles.map(p => {
              const isExpanded = expandedProfile === p.id;
              const edits = editingProfile[p.id] ?? {};
              return (
                <div key={p.id} className={`border rounded-lg overflow-hidden ${p.active ? "border-blue-100" : "border-gray-200 opacity-60"}`}>
                  {/* Header */}
                  <div className={`flex items-center justify-between px-4 py-3 ${p.active ? "bg-blue-50" : "bg-gray-50"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <button onClick={() => setExpandedProfile(isExpanded ? null : p.id)}
                        className="text-blue-400 hover:text-blue-600 text-xs font-bold w-4 shrink-0">
                        {isExpanded ? "▾" : "▸"}
                      </button>
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-blue-900">{p.name}</span>
                        <span className="text-xs text-blue-400 ml-2 truncate">
                          „{p.query}{p.location ? ` · ${p.location}` : ""}"
                        </span>
                      </div>
                      {!p.active && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full shrink-0">Inaktiv</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.active && (
                        <button onClick={() => handleRunProfile(p.id)} disabled={profileRunning[p.id]}
                          className="text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 px-3 py-1.5 rounded-lg font-medium transition-colors">
                          {profileRunning[p.id] ? "⏳ Suche…" : "⚡ Suche starten"}
                        </button>
                      )}
                      <button onClick={() => handleToggleProfile(p.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${p.active ? "bg-gray-100 text-gray-500 hover:bg-gray-200" : "bg-blue-100 text-blue-600 hover:bg-blue-200"}`}>
                        {p.active ? "Deaktivieren" : "Reaktivieren"}
                      </button>
                    </div>
                  </div>

                  {/* Ausgeklappter Bereich: Profil bearbeiten + Ergebnisse */}
                  {isExpanded && (
                    <div className="p-4 border-t border-blue-50 flex flex-col gap-4">
                      {/* Felder bearbeiten */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Name</label>
                          <input value={edits.name ?? p.name} onChange={e => patchEdit(p.id, "name", e.target.value)}
                            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Suchbegriff</label>
                          <input value={edits.query ?? p.query} onChange={e => patchEdit(p.id, "query", e.target.value)}
                            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Ort</label>
                          <input value={edits.location ?? p.location ?? ""} onChange={e => patchEdit(p.id, "location", e.target.value)}
                            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Bewerberprofil / CV</label>
                        <textarea value={edits.cv_text ?? p.cv_text} onChange={e => patchEdit(p.id, "cv_text", e.target.value)} rows={5}
                          placeholder="Wer bist du in dieser Rolle?"
                          className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                      </div>
                      <div>
                        <label className="text-xs text-blue-400 uppercase tracking-wide mb-1 block">Such-Prompt</label>
                        <textarea value={edits.system_prompt ?? p.system_prompt} onChange={e => patchEdit(p.id, "system_prompt", e.target.value)} rows={3}
                          placeholder="Was soll die KI bei der Suche beachten?"
                          className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                      </div>
                      {Object.keys(edits).length > 0 && (
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveEdit(p.id)} disabled={savingEdit[p.id]}
                            className="text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 px-4 py-2 rounded-lg font-medium">
                            {savingEdit[p.id] ? "Speichern…" : "Änderungen speichern"}
                          </button>
                          <button onClick={() => setEditingProfile(prev => { const n = {...prev}; delete n[p.id]; return n; })}
                            className="text-xs text-blue-400 hover:text-blue-600 px-4 py-2 rounded-lg">
                            Zurücksetzen
                          </button>
                        </div>
                      )}

                      {/* Suchergebnisse */}
                      {profileResults[p.id] && (
                        profileResults[p.id].length === 0 ? (
                          <p className="text-xs text-blue-400">Keine Ergebnisse gefunden.</p>
                        ) : (
                          <table className="w-full text-sm border border-blue-100 rounded-lg overflow-hidden">
                            <tbody>
                              {profileResults[p.id].map(r => (
                                <tr key={r.url} className="border-b border-blue-50 hover:bg-blue-50">
                                  <td className="px-4 py-2 text-blue-800 max-w-xs">
                                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                                      className="hover:text-blue-600 hover:underline line-clamp-2">{r.title || r.url}</a>
                                  </td>
                                  <td className="px-4 py-2 text-blue-600 text-xs font-medium whitespace-nowrap">{r.company || "—"}</td>
                                  <td className="px-4 py-2">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_COLORS[r.source] ?? "bg-gray-100 text-gray-600"}`}>
                                      {r.source}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <button onClick={() => handleImportResult(r)} disabled={importing[r.url]}
                                      className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-1 rounded-lg transition-colors">
                                      {importing[r.url] ? "…" : imported.has(r.url) ? "Importiert" : "+ Import"}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* JobAgent Scout */}
      <div className="bg-white rounded-xl border border-blue-100 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-blue-900">JobAgent Scout</h2>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Automatisch</span>
            </div>
            <p className="text-xs text-blue-400 mt-0.5">Generiert Suchbegriffe aus deinem Profil und durchsucht Stellenbörsen automatisch</p>
          </div>
          <div className="flex items-center gap-3">
            {schedulerActive && countdown > 0 && (
              <span className="text-xs text-blue-400">Nächste Suche in {formatCountdown(countdown)}</span>
            )}
            <button
              onClick={toggleScheduler}
              disabled={searching}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-40
                ${schedulerActive
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-blue-600 text-white hover:bg-blue-700"}`}
            >
              {searching ? (
                <span className="animate-spin">⏳</span>
              ) : schedulerActive ? (
                <><span>⏹</span> Stoppen</>
              ) : (
                <><span>⚡</span> JobAgent losschicken</>
              )}
            </button>
          </div>
        </div>

        {/* Suchbegriffe */}
        {queriesUsed.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {queriesUsed.map(q => (
              <span key={q} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{q}</span>
            ))}
          </div>
        )}
        {queriesUsed.length === 0 && (
          <p className="text-xs text-blue-300 mb-3">
            Suchbegriffe werden aus deinem Such-Prompt generiert → <span className="text-blue-500 cursor-pointer underline" onClick={() => onNavigate?.("profile")}>Kandidaten-Profil</span> pflegen.
          </p>
        )}

        {searchStatus && (
          <p className="text-xs text-blue-500 mb-3">{searchStatus}</p>
        )}

        {/* Suchergebnisse */}
        {searchResults.length > 0 && (
          <div className="border border-blue-100 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-50 text-blue-800 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-2">Stelle</th>
                  <th className="text-left px-4 py-2">Unternehmen</th>
                  <th className="text-left px-4 py-2">Quelle</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map(r => (
                  <tr key={r.url} className="border-b border-blue-50 hover:bg-blue-50">
                    <td className="px-4 py-2 text-blue-800 max-w-xs">
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="hover:text-blue-600 hover:underline line-clamp-2">
                        {r.title || r.url}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-blue-600 font-medium text-xs whitespace-nowrap">
                      {r.company || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_COLORS[r.source] ?? "bg-gray-100 text-gray-600"}`}>
                        {r.source}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {imported.has(r.url) ? (
                        <span className="text-xs text-green-600">Importiert</span>
                      ) : (
                        <button
                          onClick={() => handleImportResult(r)}
                          disabled={importing[r.url]}
                          className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-1 rounded-lg transition-colors"
                        >
                          {importing[r.url] ? "…" : "+ Import"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import-Box */}
      <div className="bg-white rounded-xl border border-blue-100 p-5" data-tour="import-box">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-blue-900">Stelle importieren</h2>
          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">Manuell</span>
        </div>
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
                    {inPipeline.has(j.id) ? (
                      <span className="text-xs text-green-600 font-medium">In Pipeline</span>
                    ) : (
                      <button
                        onClick={() => handleAddToPipeline(j.id)}
                        disabled={addingToPipeline[j.id]}
                        className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-3 py-1 rounded-lg transition-colors"
                      >
                        {addingToPipeline[j.id] ? "…" : "+ Pipeline"}
                      </button>
                    )}
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
