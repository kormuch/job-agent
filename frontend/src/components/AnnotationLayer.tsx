import { useEffect, useRef, useState } from "react";

interface Annotation {
  selector: string;
  tagName: string;
  text: string;
  comment: string;
  timestamp: string;
}

interface Popup {
  x: number;
  y: number;
  selector: string;
  tagName: string;
  text: string;
}

function getSelector(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body) {
    let seg = cur.tagName.toLowerCase();
    if (cur.id) {
      seg += `#${cur.id}`;
      parts.unshift(seg);
      break;
    }
    if (cur.className && typeof cur.className === "string") {
      const cls = cur.className.trim().split(/\s+/).slice(0, 2).join(".");
      if (cls) seg += `.${cls}`;
    }
    const siblings = cur.parentElement
      ? Array.from(cur.parentElement.children).filter(c => c.tagName === cur!.tagName)
      : [];
    if (siblings.length > 1) {
      seg += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
    }
    parts.unshift(seg);
    cur = cur.parentElement;
  }
  return parts.slice(-3).join(" > ");
}

export default function AnnotationLayer() {
  const [active, setActive] = useState(false);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);
  const highlightRef = useRef<HTMLElement | null>(null);

  // Highlight on hover when active
  useEffect(() => {
    if (!active) return;

    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // skip our own UI
      if (target.closest("#annotation-ui")) return;
      if (highlightRef.current && highlightRef.current !== target) {
        highlightRef.current.style.outline = "";
        highlightRef.current.style.cursor = "";
      }
      target.style.outline = "2px solid #3b73f0";
      target.style.cursor = "crosshair";
      highlightRef.current = target;
    };

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("#annotation-ui")) return;
      e.preventDefault();
      e.stopPropagation();
      const selector = getSelector(target);
      const text = (target.textContent ?? "").trim().slice(0, 60);
      setPopup({ x: e.clientX, y: e.clientY, selector, tagName: target.tagName.toLowerCase(), text });
      setComment("");
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("click", onClick, true);
      if (highlightRef.current) {
        highlightRef.current.style.outline = "";
        highlightRef.current.style.cursor = "";
      }
    };
  }, [active]);

  async function saveAnnotation() {
    if (!popup || !comment.trim()) return;
    const annotation: Annotation = {
      selector: popup.selector,
      tagName: popup.tagName,
      text: popup.text,
      comment: comment.trim(),
      timestamp: new Date().toISOString(),
    };
    await fetch("http://localhost:8002/annotations/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(annotation),
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setPopup(null);
    }, 1200);
  }

  return (
    <div id="annotation-ui">
      {/* Toggle Button */}
      <button
        data-tour="annotation-btn"
        onClick={() => { setActive(a => !a); setPopup(null); }}
        className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-semibold transition-all
          ${active
            ? "bg-blue-600 text-white ring-2 ring-blue-300"
            : "bg-white text-blue-700 border border-blue-200 hover:bg-blue-50"}`}
      >
        {active ? "✏️ Annotieren aktiv" : "✏️ Edit"}
      </button>

      {/* Popup */}
      {popup && (
        <div
          className="fixed z-50 bg-white border border-blue-200 rounded-xl shadow-xl p-4 w-72"
          style={{ left: Math.min(popup.x + 12, window.innerWidth - 300), top: Math.min(popup.y + 12, window.innerHeight - 200) }}
        >
          <div className="text-xs text-blue-400 mb-1 font-mono truncate">{popup.selector}</div>
          {popup.text && <div className="text-xs text-blue-600 mb-2 italic truncate">"{popup.text}"</div>}
          {saved ? (
            <div className="text-green-600 font-semibold text-sm py-2">✅ Gespeichert</div>
          ) : (
            <>
              <textarea
                autoFocus
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Änderungswunsch beschreiben…"
                className="w-full border border-blue-200 rounded-lg p-2 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={saveAnnotation}
                  disabled={!comment.trim()}
                  className="flex-1 bg-blue-600 text-white text-sm py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                >
                  Speichern
                </button>
                <button
                  onClick={() => setPopup(null)}
                  className="px-3 text-blue-400 hover:text-blue-600 text-sm"
                >
                  ✕
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Active overlay hint */}
      {active && !popup && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white text-xs px-4 py-2 rounded-full shadow">
          Element anklicken zum Kommentieren
        </div>
      )}
    </div>
  );
}
