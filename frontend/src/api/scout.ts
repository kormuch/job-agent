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
