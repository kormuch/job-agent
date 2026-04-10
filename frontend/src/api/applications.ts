const API_URL = "http://localhost:8002";

export interface ApplicationJob {
  id: number;
  title: string;
  match_score: number | null;
  salary_min: number | null;
  salary_max: number | null;
  company: {
    id: number;
    name: string;
    location: string | null;
    website: string | null;
  };
}

export interface Application {
  id: number;
  status: string;
  priority: string;
  applied_at: string | null;
  salary_target: number | null;
  portfolio_sent: boolean;
  follow_up_date: string | null;
  notes: string | null;
  job: ApplicationJob | null;
}

export async function fetchApplications(): Promise<Application[]> {
  const res = await fetch(`${API_URL}/applications/`);
  if (!res.ok) throw new Error("API Fehler");
  return res.json();
}

export async function updateStatus(id: number, status: string): Promise<void> {
  await fetch(`${API_URL}/applications/${id}/status?status=${status}`, {
    method: "PATCH",
  });
}
