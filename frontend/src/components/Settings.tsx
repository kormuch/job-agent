import { useEffect, useState } from "react";

const API = "http://localhost:8002";

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

export default function Settings() {
  const [groqKey, setGroqKey]       = useState("");
  const [geminiKey, setGeminiKey]   = useState("");
  const [groqSaved, setGroqSaved]   = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [config, setConfig]         = useState<Record<string, string | boolean> | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    fetch(`${API}/match/config`)
      .then(r => r.json())
      .then(cfg => { setConfig(cfg); })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveGroq() {
    if (!groqKey.trim()) return;
    await fetch(`${API}/match/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groq_api_key: groqKey }),
    });
    setConfig(c => c ? { ...c, groq_key_set: true, active_provider: "Groq" } : c);
    setGroqKey("");
    setGroqSaved(true);
    setTimeout(() => setGroqSaved(false), 2500);
  }

  async function handleSaveGemini() {
    if (!geminiKey.trim()) return;
    await fetch(`${API}/match/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gemini_api_key: geminiKey }),
    });
    setConfig(c => c ? { ...c, gemini_key_set: true } : c);
    setGeminiKey("");
    setGeminiSaved(true);
    setTimeout(() => setGeminiSaved(false), 2500);
  }

  if (loading) return <div className="text-blue-300 text-sm p-4">Lade…</div>;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* KI-Status */}
      <div className="bg-white rounded-xl border border-blue-100 p-5">
        <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-3">KI-Status</div>
        {config ? (
          <>
            <StatusRow
              label="Aktiver Provider"
              value={(config.active_provider as string) || "— kein Key hinterlegt"}
              sub={(config.model as string) || undefined}
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
          </>
        ) : (
          <div className="text-sm text-blue-300">Lade…</div>
        )}
        <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-600 leading-relaxed">
          <strong>Priorität:</strong> Groq wird bevorzugt (kostenlos, schnell). Gemini springt ein wenn kein Groq-Key hinterlegt ist.
        </div>
      </div>

      {/* Groq API Key */}
      <div className="bg-white rounded-xl border border-blue-100 p-5">
        <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">Groq API Key</div>
        <p className="text-xs text-blue-400 mb-3">
          Kostenlos unter <span className="font-medium text-blue-600">console.groq.com</span> — 14.400 Anfragen/Tag gratis. Empfohlen.
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={groqKey}
            onChange={e => setGroqKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSaveGroq()}
            placeholder={config?.groq_key_set ? "Neuen Key eingeben zum Überschreiben" : "gsk_…"}
            className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSaveGroq}
            disabled={!groqKey.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-lg transition-colors"
          >
            {groqSaved ? "Gespeichert ✓" : "Speichern"}
          </button>
        </div>
      </div>

      {/* Gemini API Key */}
      <div className="bg-white rounded-xl border border-blue-100 p-5">
        <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">Gemini API Key (Fallback)</div>
        <p className="text-xs text-blue-400 mb-3">
          Kostenlos unter <span className="font-medium text-blue-600">aistudio.google.com/apikey</span> — 1.500 Anfragen/Tag gratis.
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={geminiKey}
            onChange={e => setGeminiKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSaveGemini()}
            placeholder={config?.gemini_key_set ? "Neuen Key eingeben zum Überschreiben" : "AIza…"}
            className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSaveGemini}
            disabled={!geminiKey.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-200 text-white rounded-lg transition-colors"
          >
            {geminiSaved ? "Gespeichert ✓" : "Speichern"}
          </button>
        </div>
      </div>

    </div>
  );
}
