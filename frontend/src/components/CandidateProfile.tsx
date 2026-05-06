import { useEffect, useState } from "react";

const API = "http://localhost:8002";

interface MatchResult {
  score: number;
  strengths: string[];
  gaps: string[];
  summary: string;
}

export default function CandidateProfile() {
  const [cvText, setCvText]             = useState("");
  const [cvChars, setCvChars]           = useState(0);
  const [cvSaved, setCvSaved]           = useState(false);

  const [searchPrompt, setSearchPrompt] = useState("");
  const [promptSaved, setPromptSaved]   = useState(false);

  const [jobText, setJobText]           = useState("");
  const [scoring, setScoring]           = useState(false);
  const [result, setResult]             = useState<MatchResult | null>(null);
  const [scoreError, setScoreError]     = useState<string | null>(null);

  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/match/cv`).then(r => r.json()),
      fetch(`${API}/match/config`).then(r => r.json()),
    ]).then(([cv, cfg]) => {
      setCvText(cv.text || "");
      setCvChars((cv.text || "").length);
      setSearchPrompt(cfg.system_prompt || "");
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

  async function handleSavePrompt() {
    await fetch(`${API}/match/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_prompt: searchPrompt }),
    });
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2500);
  }

  async function handleScore() {
    if (!jobText.trim()) return;
    setScoring(true);
    setResult(null);
    setScoreError(null);
    try {
      const res = await fetch(`${API}/match/text/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_text: jobText }),
      });
      if (!res.ok) {
        const err = await res.json();
        setScoreError(err.detail || "Fehler");
        return;
      }
      setResult(await res.json());
    } catch {
      setScoreError("Backend nicht erreichbar.");
    } finally {
      setScoring(false);
    }
  }

  if (loading) return <div className="text-blue-300 text-sm p-4">Lade…</div>;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* CV */}
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
          Wird für den Match-Score-Abgleich mit gefundenen Stellen verwendet.
        </p>
        <textarea
          value={cvText}
          onChange={e => setCvText(e.target.value)}
          placeholder={"Korbinian Much\nAI Product Owner | Haigerloch\n\n## Erfahrung\n...\n\n## Skills\n..."}
          rows={16}
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

      {/* Such-Prompt */}
      <div className="bg-white rounded-xl border border-blue-100 p-5">
        <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">
          Such-Prompt (JobAgent Direktive)
        </div>
        <p className="text-xs text-blue-400 mb-3">
          Der JobAgent Scout liest diesen Prompt und generiert daraus automatisch Suchbegriffe.
          Beschreibe Zielrollen, Gehaltsvorstellung, Regionen und was du <em>nicht</em> willst.
        </p>
        <textarea
          value={searchPrompt}
          onChange={e => setSearchPrompt(e.target.value)}
          rows={8}
          placeholder={
            "Ich bin AI Product Owner mit Fokus auf Agentic Engineering und LLM-Produktentwicklung.\n" +
            "Gehaltsvorstellung: 85.000–100.000 €.\n" +
            "Zielrollen: AI Product Owner, Head of AI, AI Strategy Lead.\n" +
            "Regionen: Stuttgart, München, Remote (D/A/CH).\n" +
            "Bevorzuge Mittelstand/Scale-up die AI ernsthaft aufbauen wollen.\n" +
            "Kein Interesse an reinen Legacy-IT-Rollen ohne AI-Bezug."
          }
          className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y font-mono"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSavePrompt}
            disabled={!searchPrompt.trim()}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-lg transition-colors"
          >
            {promptSaved ? "Gespeichert ✓" : "Speichern"}
          </button>
        </div>
      </div>

      {/* Stelle testen */}
      <div className="bg-white rounded-xl border border-blue-100 p-5">
        <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">
          Stelle manuell testen
        </div>
        <p className="text-xs text-blue-400 mb-3">
          Stellenbeschreibung einfügen → CV-Abgleich + Score. Kein Import nötig.
        </p>
        <textarea
          value={jobText}
          onChange={e => setJobText(e.target.value)}
          rows={6}
          placeholder="Stellenbeschreibung hier einfügen — Titel, Aufgaben, Anforderungen…"
          className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleScore}
            disabled={scoring || !jobText.trim()}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-lg transition-colors"
          >
            {scoring ? "Berechne…" : "Match berechnen"}
          </button>
        </div>

        {scoreError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {scoreError}
          </div>
        )}

        {result && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span className={`text-5xl font-bold ${
                result.score >= 70 ? "text-green-600" :
                result.score >= 50 ? "text-yellow-500" : "text-red-500"
              }`}>{result.score}</span>
              <span className="text-blue-400">/ 100</span>
              <span className="text-sm text-blue-600 ml-2">{
                result.score >= 70 ? "Guter Match" :
                result.score >= 50 ? "Teilweiser Match" : "Schwacher Match"
              }</span>
            </div>
            <p className="text-sm text-blue-800 leading-relaxed">{result.summary}</p>
            {result.strengths.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Stärken</div>
                <ul className="text-sm text-blue-800 space-y-1">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2"><span className="text-green-500 flex-shrink-0">✓</span>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.gaps.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Lücken</div>
                <ul className="text-sm text-blue-800 space-y-1">
                  {result.gaps.map((g, i) => (
                    <li key={i} className="flex gap-2"><span className="text-red-400 flex-shrink-0">○</span>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
