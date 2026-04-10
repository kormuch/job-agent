import { useState } from "react";

const API = "http://localhost:8002";

const STATUS_OPTIONS = [
  "offen", "kontaktiert", "beworben", "im_gespräch", "interview", "angebot", "abgeschlossen", "absage", "ghosted",
];
const PRIORITY_OPTIONS = ["top", "mittel", "pipeline"];

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function NewApplicationModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    company_name: "",
    company_website: "",
    company_location: "",
    job_title: "",
    job_url: "",
    status: "offen",
    priority: "mittel",
    match_score: "",
    salary_target: "",
    applied_at: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim() || !form.job_title.trim()) {
      setError("Firma und Jobtitel sind Pflichtfelder.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/applications/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name:     form.company_name.trim(),
          company_website:  form.company_website.trim() || null,
          company_location: form.company_location.trim() || null,
          job_title:        form.job_title.trim(),
          job_url:          form.job_url.trim() || null,
          status:           form.status,
          priority:         form.priority,
          match_score:      form.match_score ? parseInt(form.match_score) : null,
          salary_target:    form.salary_target ? parseInt(form.salary_target) : null,
          applied_at:       form.applied_at || null,
          notes:            form.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      onCreated();
      onClose();
    } catch {
      setError("Speichern fehlgeschlagen — Backend erreichbar?");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-blue-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-blue-900">Neue Bewerbung</h2>
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-blue-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 max-h-[75vh] overflow-y-auto">

          {/* Firma */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-blue-700 mb-1">
                Firma <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.company_name}
                onChange={e => set("company_name", e.target.value)}
                placeholder="Bosch Digital GmbH"
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">Website</label>
              <input
                type="text"
                value={form.company_website}
                onChange={e => set("company_website", e.target.value)}
                placeholder="https://bosch.com"
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">Standort</label>
              <input
                type="text"
                value={form.company_location}
                onChange={e => set("company_location", e.target.value)}
                placeholder="Stuttgart"
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Job */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-blue-700 mb-1">
                Jobtitel <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.job_title}
                onChange={e => set("job_title", e.target.value)}
                placeholder="AI Product Owner"
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-blue-700 mb-1">Stellenanzeige-URL</label>
              <input
                type="text"
                value={form.job_url}
                onChange={e => set("job_url", e.target.value)}
                placeholder="https://stepstone.de/stellenangebote/..."
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Status + Priorität */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => set("status", e.target.value)}
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">Priorität</label>
              <select
                value={form.priority}
                onChange={e => set("priority", e.target.value)}
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Match + Gehalt + Datum */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">Match-Score (0–100)</label>
              <input
                type="number"
                min="0" max="100"
                value={form.match_score}
                onChange={e => set("match_score", e.target.value)}
                placeholder="—"
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">Gehaltsvorstellung (€)</label>
              <input
                type="number"
                value={form.salary_target}
                onChange={e => set("salary_target", e.target.value)}
                placeholder="65000"
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">Beworben am</label>
              <input
                type="date"
                value={form.applied_at}
                onChange={e => set("applied_at", e.target.value)}
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Notizen */}
          <div>
            <label className="block text-xs font-medium text-blue-700 mb-1">Notizen</label>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Über LinkedIn entdeckt, kannte jemanden dort…"
              rows={2}
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors"
            >
              {saving ? "Speichern…" : "Bewerbung anlegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
