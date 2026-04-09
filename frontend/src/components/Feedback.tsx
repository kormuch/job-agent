import { useEffect, useState } from "react";

interface Annotation {
  selector: string;
  tagName: string;
  text: string;
  comment: string;
  timestamp: string;
}

export default function Feedback() {
  const [items, setItems] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8002/annotations/")
      .then(r => r.json())
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);

  async function handleDone(index: number) {
    await fetch(`http://localhost:8002/annotations/${index}`, { method: "DELETE" });
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  if (loading) return <div className="p-8 text-blue-600">Lade Feedback...</div>;

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 && (
        <div className="text-blue-300 text-sm mt-8 text-center">Kein offenes Feedback.</div>
      )}
      {items.map((a, i) => (
        <div key={i} className="bg-white rounded-xl border border-blue-100 p-5 flex gap-4 items-start">
          <div className="flex-1 min-w-0">
            <div className="text-blue-800 text-sm font-medium mb-1">{a.comment}</div>
            {a.text && (
              <div className="text-blue-400 text-xs mb-1">Element: "{a.text}"</div>
            )}
            <div className="text-blue-300 text-xs font-mono truncate">{a.selector}</div>
            <div className="text-blue-300 text-xs mt-1">
              {new Date(a.timestamp).toLocaleString("de-DE")}
            </div>
          </div>
          <button
            onClick={() => handleDone(i)}
            className="flex-shrink-0 text-xs bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Umgesetzt
          </button>
        </div>
      ))}
    </div>
  );
}
