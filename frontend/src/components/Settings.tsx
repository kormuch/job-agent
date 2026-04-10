import { useEffect, useState } from "react";

const API = "http://localhost:8002";

export default function Settings() {
  const [cvText, setCvText]       = useState("");
  const [apiKey, setApiKey]       = useState("");
  const [keyPreview, setKeyPreview] = useState("");
  const [keySet, setKeySet]       = useState(false);
  const [cvSaved, setCvSaved]     = useState(false);
  const [keySaved, setKeySaved]   = useState(false);
  const [cvChars, setCvChars]     = useState(0);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/match/cv`).then(r => r.json()),
      fetch(`${API}/match/config`).then(r => r.json()),
    ]).then(([cv, cfg]) => {
      setCvText(cv.text || "");
      setCvChars((cv.text || "").length);
      setKeySet(cfg.gemini_key_set);
      setKeyPreview(cfg.gemini_key_preview || "");
    }).finally(() => setLoading(false));
  }, []);

  async function handleSaveCv() {
    const res = await fetch(`${API}/match/cv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cvText }),
    });
    const data = await res.json();
    setCvChars(data.chars);
    setCvSaved(true);
    setTimeout(() => setCvSaved(false), 2500);
  }

  async function handleSaveKey() {
    if (!apiKey.trim()) return;
    await fetch(`${API}/match/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gemini_api_key: apiKey }),
    });
    setKeySet(true);
    setKeyPreview(apiKey.slice(0, 8) + "…");
    setApiKey("");
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2500);
  }

  if (loading) return <div className="text-blue-300 text-sm p-4">Lade…</div>;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Gemini API Key */}
      <div className="bg-white rounded-xl border border-blue-100 p-5">
        <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">
          Gemini API Key
        </div>
        <p className="text-xs text-blue-400 mb-3">
          Kostenlos unter{" "}
          <span className="font-medium text-blue-600">aistudio.google.com/apikey</span>
          {" "}— 1.500 Anfragen/Tag gratis.
        </p>

        {keySet && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              Key gespeichert: {keyPreview}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSaveKey()}
            placeholder={keySet ? "Neuen Key eingeben zum Überschreiben" : "AIza…"}
            className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSaveKey}
            disabled={!apiKey.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-lg transition-colors"
          >
            {keySaved ? "Gespeichert ✓" : "Speichern"}
          </button>
        </div>
      </div>

      {/* CV Editor */}
      <div className="bg-white rounded-xl border border-blue-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
            Lebenslauf (CV)
          </div>
          {cvChars > 0 && (
            <span className="text-xs text-blue-400">{cvChars.toLocaleString()} Zeichen gespeichert</span>
          )}
        </div>
        <p className="text-xs text-blue-400 mb-3">
          CV als Text einfügen — wird für Match-Score-Berechnung verwendet.
          Einfach aus PDF kopieren oder als Markdown formatieren.
        </p>
        <textarea
          value={cvText}
          onChange={e => setCvText(e.target.value)}
          placeholder={"Korbinian Much\nAI Product Owner | Haigerloch\n\n## Erfahrung\n...\n\n## Skills\n..."}
          rows={18}
          className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm font-mono text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSaveCv}
            disabled={!cvText.trim()}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-lg transition-colors"
          >
            {cvSaved ? "Gespeichert ✓" : "CV speichern"}
          </button>
        </div>
      </div>

    </div>
  );
}
