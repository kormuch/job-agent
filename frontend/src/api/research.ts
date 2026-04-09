const API = "http://localhost:8002";

export interface NewsItem {
  title: string;
  link: string;
  published: string;
  source: string;
}

export interface ResearchResult {
  company: string;
  contacts: { name?: string; role?: string; email?: string }[];
  phones: string[];
  news: NewsItem[];
  kununu: { score: number | null; reviews: number | null; url: string } | null;
}

export async function researchCompany(companyId: number): Promise<ResearchResult> {
  const res = await fetch(`${API}/research/${companyId}`);
  if (!res.ok) throw new Error("Fehler");
  return res.json();
}

export async function fetchCompanyNews(companyId: number): Promise<{ news: NewsItem[] }> {
  const res = await fetch(`${API}/research/${companyId}/news`);
  if (!res.ok) throw new Error("Fehler");
  return res.json();
}
