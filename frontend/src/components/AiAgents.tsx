import { useEffect, useState } from "react";

const API = "http://localhost:8002";

interface Config {
  groq_key_set: boolean;
  gemini_key_set: boolean;
  active_provider: string;
  gemini_key_preview: string;
  system_prompt: string;
  model: string;
}

interface MatchResult {
  score: number;
  strengths: string[];
  gaps: string[];
  summary: string;
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-blue-50 last:border-0">
      <span className="text-sm text-blue-600">{label}</span>
      <div className="text-right">
        <span className="text-sm font-medium text-blue-900">{value}</span>
        {sub && <div className="text-xs text-blue-400">{sub}</div>}
      </div>
    </div>
  );
}

export default function AiAgents() {
  const [config, setConfig]           = useState<Config | null>(null);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptSaved, setPromptSaved] = useState(false);
  const [jobText, setJobText]         = useState("");
  const [scoring, setScoring]         = useState(false);
  const [result, setResult]           = useState<MatchResult | null>(null);
  const [scoreError, setScoreError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/match/config`)
      .then(r => r.json())
      .then((cfg: Config) => {
        setConfig(cfg);
        setSystemPrompt(cfg.system_prompt || "");
      });
  }, []);

  async function handleSavePrompt() {
    await fetch(`${API}/match/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_prompt: systemPrompt }),
    });
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2500);
    setConfig(c => c ? { ...c, system_prompt: systemPrompt } : c);
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

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      {/* KI-Status */}
      <div className="bg-white rounded-xl border border-blue-100 p-5">
        <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-3">
          KI-Status
        </div>
        {config ? (
          <>
            <StatusRow
              label="Aktiver Provider"
              value={config.active_provider || "— kein Key hinterlegt"}
              sub={config.model || undefined}
            />
            <StatusRow
              label="Groq"
              value={config.groq_key_set ? "✓ Key hinterlegt" : "— nicht konfiguriert"}
              sub="llama-3.3-70b · 14.400 req/Tag · kostenlos"
            />
            <StatusRow
              label="Gemini"
              value={config.gemini_key_set ? `✓ ${config.gemini_key_preview}` : "— nicht konfiguriert"}
              sub="gemini-1.5-flash · Fallback · Billing erforderlich"
            />
            <StatusRow
              label="CV"
              value="Einstellungen → CV"
              sub="db/cv.md"
            />
          </>
        ) : (
          <div className="text-sm text-blue-300">Lade…</div>
        )}
        <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-600 leading-relaxed">
          <strong>Wie funktioniert es:</strong> Jeder KI-Aufruf sendet deinen CV + die
          Stellenbeschreibung + deinen System-Prompt an das Modell. Externe Inhalte werden
          in XML-Tags gekapselt (Schutz vor Prompt Injection). Das Modell gibt strukturiertes
          JSON zurück — Score, Stärken, Lücken.
        </div>
      </div>

      {/* System-Prompt */}
      <div className="bg-white rounded-xl border border-blue-100 p-5">
        <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">
          System-Prompt / Persona
        </div>
        <p className="text-xs text-blue-400 mb-3">
          Dauerhafte Anweisung — wird bei <em>jedem</em> KI-Aufruf mitgesendet.
          Beschreibe Präferenzen, Gehaltsvorstellung, was du nicht willst.
        </p>
        <textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={6}
          placeholder={
            "Ich bin AI Product Owner mit Fokus auf Agentic Engineering und LLM-Produktentwicklung.\n" +
            "Gehaltsvorstellung: 80.000–95.000 €.\n" +
            "Bevorzuge remote-freundliche Firmen, Startups und innovativen Mittelstand.\n" +
            "Kein Interesse an reinen IT-Betriebsrollen ohne Produktverantwortung.\n" +
            "Bewerte kritisch — lieber ehrlich niedrig als falsch optimistisch."
          }
          className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y font-mono"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={handleSavePrompt}
            disabled={!systemPrompt.trim()}
            className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-lg transition-colors"
          >
            {promptSaved ? "Gespeichert ✓" : "Speichern"}
          </button>
        </div>
      </div>

      {/* Ad-hoc Match Tester */}
      <div className="bg-white rounded-xl border border-blue-100 p-5">
        <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">
          Stelle testen
        </div>
        <p className="text-xs text-blue-400 mb-3">
          Stellenbeschreibung einfügen → Score berechnen. Kein Import nötig.
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
