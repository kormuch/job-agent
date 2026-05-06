const API = "http://localhost:8002";

export interface ImportedJob {
  id: number;
  title: string;
  company: string;
  source: string;
  source_url: string;
  match_score: number | null;
}

export async function importJob(url: string, title?: string, company_name?: string, notes?: string) {
  const res = await fetch(`${API}/scout/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, title, company_name, notes }),
  });
  if (!res.ok) throw new Error("Import fehlgeschlagen");
  return res.json();
}

export async function fetchImportedJobs(): Promise<ImportedJob[]> {
  const res = await fetch(`${API}/scout/jobs`);
  if (!res.ok) throw new Error("Fehler");
  return res.json();
}

export interface SearchResult {
  url: string;
  title: string;
  company: string;
  source: string;
}

export async function searchJobs(query: string, max_results = 10): Promise<SearchResult[]> {
  const res = await fetch(`${API}/scout/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, max_results }),
  });
  if (!res.ok) throw new Error("Suche fehlgeschlagen");
  const data = await res.json();
  return data.results ?? [];
}

export async function autoSearch(): Promise<{ results: SearchResult[]; queries_used: string[] }> {
  const res = await fetch(`${API}/scout/auto-search`, { method: "POST" });
  if (!res.ok) throw new Error("Auto-Suche fehlgeschlagen");
  return res.json();
}

// ── Gespeicherte Jobsuchen ───────────────────────────────────────────────────

export interface SearchProfile {
  id: number;
  name: string;
  query: string;
  location: string | null;
  cv_text: string;
  system_prompt: string;
  active: boolean;
}

export async function fetchSearchProfiles(): Promise<SearchProfile[]> {
  const res = await fetch(`${API}/searches/`);
  if (!res.ok) throw new Error("Fehler");
  return res.json();
}

export async function createSearchProfile(
  name: string, query: string, location?: string,
  cv_text?: string, system_prompt?: string
): Promise<SearchProfile> {
  const res = await fetch(`${API}/searches/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, query, location: location || null, cv_text: cv_text || null, system_prompt: system_prompt || null }),
  });
  if (!res.ok) throw new Error("Fehler");
  return res.json();
}

export async function updateSearchProfile(
  id: number,
  data: Partial<{ name: string; query: string; location: string; cv_text: string; system_prompt: string }>
): Promise<SearchProfile> {
  const res = await fetch(`${API}/searches/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Fehler");
  return res.json();
}

export async function toggleSearchProfile(id: number): Promise<SearchProfile> {
  const res = await fetch(`${API}/searches/${id}/toggle`, { method: "POST" });
  if (!res.ok) throw new Error("Fehler");
  return res.json();
}

export async function runSearchProfile(id: number): Promise<{ results: SearchResult[]; queries_used: string[] }> {
  const res = await fetch(`${API}/searches/${id}/run`, { method: "POST" });
  if (!res.ok) throw new Error("Suche fehlgeschlagen");
  return res.json();
}
