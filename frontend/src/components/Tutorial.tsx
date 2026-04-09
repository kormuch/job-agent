import { useEffect, useState, useCallback } from "react";

interface Step {
  target: string;        // CSS selector oder "center" für zentriertes Modal
  title: string;
  text: string;
  position?: "top" | "bottom" | "left" | "right";
  navigate?: string;     // Seite wechseln bevor dieser Step angezeigt wird
}

const STEPS: Step[] = [
  {
    target: "center",
    title: "Willkommen bei JobAgent",
    text: "Dieses Tool hilft dir, deinen Bewerbungsprozess zu organisieren — von der Stellensuche über die Unternehmensrecherche bis zur Bewerbungs-Pipeline. Diese Tour zeigt dir alle wichtigen Funktionen.",
  },
  {
    target: "[data-tour='nav-dashboard']",
    title: "Dashboard",
    text: "Das Dashboard zeigt dir auf einen Blick: Wie viele Bewerbungen laufen, wer gerade im Gespräch ist, dein durchschnittlicher Match-Score und welche Follow-ups fällig sind.",
    position: "right",
    navigate: "dashboard",
  },
  {
    target: "[data-tour='kpi-row']",
    title: "KPI-Cards",
    text: "Vier Kennzahlen live aus der Datenbank. Die Follow-up-Karte leuchtet orange wenn Fristen überschritten sind.",
    position: "bottom",
    navigate: "dashboard",
  },
  {
    target: "[data-tour='nav-pipeline']",
    title: "Pipeline",
    text: "Die Bewerbungs-Pipeline zeigt alle laufenden Bewerbungen. Jede Spalte ist sortierbar — klick auf den Spaltentitel.",
    position: "right",
    navigate: "pipeline",
  },
  {
    target: "[data-tour='pipeline-table']",
    title: "Status & Sortierung",
    text: "Status direkt in der Tabelle ändern — Dropdown pro Zeile. Alle Spalten sortierbar per Klick. Zellen sind frei markierbar und kopierbar.",
    position: "top",
    navigate: "pipeline",
  },
  {
    target: "[data-tour='nav-finder']",
    title: "Stellenfinder",
    text: "Stelle per URL importieren — von Stepstone, LinkedIn, Indeed oder direkt von der Firmenwebsite. Titel und Firma werden automatisch erkannt.",
    position: "right",
    navigate: "finder",
  },
  {
    target: "[data-tour='import-box']",
    title: "URL-Import",
    text: "URL einfügen und Enter drücken. Die App extrahiert automatisch Titel, Firma und Beschreibung aus der Seite. Manuell überschreibbar.",
    position: "bottom",
    navigate: "finder",
  },
  {
    target: "[data-tour='nav-company']",
    title: "Unternehmensinfo",
    text: "Wähle ein Unternehmen aus deiner Pipeline. Die App scrapt automatisch die Firmenwebsite nach HR-Kontakten, holt aktuelle News via Google und den Kununu-Score.",
    position: "right",
    navigate: "company",
  },
  {
    target: "[data-tour='nav-feedback']",
    title: "Feedback-System",
    text: "Siehst du etwas das du ändern möchtest? Nutze den Stift-Button unten rechts, klicke auf ein Element und hinterlasse einen Kommentar. Hier siehst du alle offenen Punkte.",
    position: "right",
    navigate: "feedback",
  },
  {
    target: "[data-tour='annotation-btn']",
    title: "Stift-Button",
    text: "Aktiviert den Annotier-Modus. Jedes Element auf der Seite wird beim Hover blau umrandet — klicken öffnet ein Kommentar-Popup. Der Kommentar landet in der Feedback-Liste.",
    position: "top",
  },
  {
    target: "center",
    title: "Fertig!",
    text: "Du kennst jetzt alle wichtigen Funktionen. Noch nicht aktiv: Match Scorer (braucht KI-API-Key) und Message Drafter. Viel Erfolg bei der Jobsuche!",
  },
];

interface Rect { top: number; left: number; width: number; height: number; }

function getRect(selector: string): Rect | null {
  if (selector === "center") return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function tooltipPosition(rect: Rect | null, pos: Step["position"] = "bottom"): React.CSSProperties {
  if (!rect) {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }
  const pad = 16;
  const vw = window.innerWidth;
  if (pos === "right")  return { top: rect.top, left: rect.left + rect.width + pad };
  if (pos === "left")   return { top: rect.top, left: rect.left - 320 - pad };
  if (pos === "top")    return { bottom: window.innerHeight - rect.top + pad, left: Math.min(rect.left, vw - 320 - pad) };
  // bottom (default)
  return { top: rect.top + rect.height + pad, left: Math.min(rect.left, vw - 320 - pad) };
}

interface TutorialProps {
  onNavigate: (page: string) => void;
  onClose: () => void;
}

export default function Tutorial({ onNavigate, onClose }: TutorialProps) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const current = STEPS[step];

  const updateRect = useCallback(() => {
    setRect(getRect(current.target));
  }, [current.target]);

  useEffect(() => {
    if (current.navigate) onNavigate(current.navigate);
    // Kurz warten bis die Seite gerendert ist
    const t = setTimeout(updateRect, 120);
    return () => clearTimeout(t);
  }, [step, current.navigate, onNavigate, updateRect]);

  useEffect(() => {
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [updateRect]);

  function next() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else onClose();
  }
  function prev() { if (step > 0) setStep(s => s - 1); }

  const PAD = 8;
  const isCenter = current.target === "center";

  return (
    <div className="fixed inset-0 z-[100]" onClick={e => e.target === e.currentTarget && onClose()}>

      {/* Overlay mit Ausschnitt */}
      {rect && !isCenter ? (
        <>
          <div className="fixed inset-0 bg-black/50 pointer-events-none"
            style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${rect.left - PAD}px ${rect.top - PAD}px, ${rect.left - PAD}px ${rect.top + rect.height + PAD}px, ${rect.left + rect.width + PAD}px ${rect.top + rect.height + PAD}px, ${rect.left + rect.width + PAD}px ${rect.top - PAD}px, ${rect.left - PAD}px ${rect.top - PAD}px)` }}
          />
          <div className="fixed pointer-events-none ring-2 ring-blue-400 ring-offset-0 rounded-lg"
            style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
          />
        </>
      ) : (
        <div className="fixed inset-0 bg-black/60 pointer-events-none" />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-[101] w-72 bg-white rounded-2xl shadow-2xl p-5 pointer-events-auto"
        style={tooltipPosition(rect, current.position)}
      >
        {/* Progress dots */}
        <div className="flex gap-1 mb-3">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i === step ? "bg-blue-600" : i < step ? "bg-blue-300" : "bg-gray-200"}`} />
          ))}
        </div>

        <div className="text-xs text-blue-400 mb-1">{step + 1} / {STEPS.length}</div>
        <h3 className="text-blue-900 font-semibold text-sm mb-2">{current.title}</h3>
        <p className="text-blue-700 text-xs leading-relaxed mb-4">{current.text}</p>

        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs text-blue-400 hover:text-blue-600 transition-colors"
          >
            Tour beenden
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="text-xs border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                ← Zurück
              </button>
            )}
            <button
              onClick={next}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition-colors"
            >
              {step === STEPS.length - 1 ? "Fertig" : "Weiter →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
