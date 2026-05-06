import { useState } from "react";
import Pipeline from "./components/Pipeline";
import Dashboard from "./components/Dashboard";
import Feedback from "./components/Feedback";
import JobFinder from "./components/JobFinder";
import AnnotationLayer from "./components/AnnotationLayer";
import Tutorial from "./components/Tutorial";
import NewApplicationModal from "./components/NewApplicationModal";
import Settings from "./components/Settings";
import CandidateProfile from "./components/CandidateProfile";

const NAV = [
  { id: "dashboard", icon: "📊", label: "Dashboard",         tour: "nav-dashboard" },
  { id: "pipeline",  icon: "📋", label: "Pipeline",          tour: "nav-pipeline" },
  { id: "finder",    icon: "🔍", label: "Stellenfinder",     tour: "nav-finder" },
  { id: "profile",   icon: "👤", label: "Kandidaten-Profil", tour: "" },
  { id: "settings",  icon: "⚙️", label: "Einstellungen",     tour: "" },
  { id: "feedback",  icon: "💬", label: "Feedback",          tour: "nav-feedback" },
];

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  pipeline:  "Pipeline",
  finder:    "Stellenfinder",
  profile:   "Kandidaten-Profil",
  settings:  "Einstellungen",
  feedback:  "Feedback",
};

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-blue-300 gap-3">
      <div className="text-5xl">🚧</div>
      <div className="text-lg font-medium">{title} — coming soon</div>
    </div>
  );
}

export default function App() {
  const [page, setPage]             = useState("dashboard");
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNewApp, setShowNewApp]  = useState(false);
  const [refreshKey, setRefreshKey]  = useState(0);
  const [annotating, setAnnotating] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">

      {/* Sidebar */}
      <aside className="w-52 bg-blue-900 flex flex-col flex-shrink-0">
        <div className="px-5 py-6 border-b border-blue-800">
          <h1 className="text-white text-lg font-bold tracking-tight">JobAgent</h1>
          <span className="text-blue-400 text-xs">AI Bewerbungsmanager</span>
        </div>
        <nav className="flex-1 py-3 px-2">
          {NAV.map(item => (
            <div
              key={item.id}
              onClick={() => setPage(item.id)}
              data-tour={item.tour || undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mx-1 my-0.5 cursor-pointer text-sm transition-colors
                ${page === item.id
                  ? "bg-blue-500 text-white"
                  : "text-blue-300 hover:bg-blue-800 hover:text-white"}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
        <div className="pb-2 h-10" />{/* Platzhalter für fixed button */}
        <div className="px-4 py-4 border-t border-blue-800 text-blue-400 text-xs">
          Korbinian Much<br />AI PO · Haigerloch
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-blue-100 px-6 py-3.5 flex items-center justify-between">
          <h2 className="text-blue-900 font-semibold text-base">{PAGE_TITLES[page]}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTutorial(true)}
              className="text-sm text-blue-500 hover:text-blue-700 border border-blue-200 hover:border-blue-400 px-3 py-2 rounded-lg transition-colors"
            >
              ? Tour
            </button>
            <button
              onClick={() => setShowNewApp(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
            >
              + Neue Bewerbung
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {page === "dashboard" && <Dashboard key={refreshKey} onNavigate={setPage} />}
          {page === "pipeline"  && <Pipeline key={refreshKey} />}
          {page === "feedback"  && <Feedback />}
          {page === "finder"    && <JobFinder onNavigate={setPage} />}
          {page === "profile"   && <CandidateProfile />}
          {page === "settings"  && <Settings />}
        </main>
      </div>

      {/* Feedback-Button — immer über allen Modals */}
      <div className="fixed bottom-16 left-0 w-52 px-3 z-[60]">
        <button
          data-tour="annotation-btn"
          onClick={() => setAnnotating(a => !a)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${annotating
              ? "bg-blue-500 text-white"
              : "text-blue-300 hover:bg-blue-800 hover:text-white"}`}
        >
          <span>✏️</span>
          <span>{annotating ? "Annotieren aktiv" : "Feedback geben"}</span>
        </button>
      </div>

      <AnnotationLayer active={annotating} onToggle={() => setAnnotating(a => !a)} />

      {showNewApp && (
        <NewApplicationModal
          onClose={() => setShowNewApp(false)}
          onCreated={() => { setRefreshKey(k => k + 1); setPage("pipeline"); }}
        />
      )}

      {showTutorial && (
        <Tutorial
          onNavigate={setPage}
          onClose={() => setShowTutorial(false)}
        />
      )}
    </div>
  );
}
