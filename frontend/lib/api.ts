import type {
  Definition,
  FlagStatus,
  LookupResult,
  SearchResult,
  Source,
  Stats,
  Term,
  TermCreate,
  TermDetail,
} from "./types";

// When built as part of the FastAPI container, API is same-origin.
// For local dev, override via NEXT_PUBLIC_API_BASE.
const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore
    }
    throw new Error(`${res.status} ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string; app: string }>("/api/health"),
  stats: () => request<Stats>("/api/terms/stats"),
  sources: () => request<Source[]>("/api/sources"),
  listTerms: (params?: {
    q?: string;
    flag?: FlagStatus;
    category?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.flag) qs.set("flag", params.flag);
    if (params?.category) qs.set("category", params.category);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<Term[]>(`/api/terms${suffix}`);
  },
  getTerm: (id: number) => request<TermDetail>(`/api/terms/${id}`),
  getDefinitions: (id: number) =>
    request<Definition[]>(`/api/terms/${id}/definitions`),
  createTerm: (payload: TermCreate) =>
    request<TermDetail>(`/api/terms`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateFlag: (id: number, flag: FlagStatus) =>
    request<Term>(`/api/terms/${id}/flag`, {
      method: "PUT",
      body: JSON.stringify({ flag }),
    }),
  deleteTerm: (id: number) =>
    request<void>(`/api/terms/${id}`, { method: "DELETE" }),
  lookup: (word: string) =>
    request<LookupResult>(`/api/lookup/${encodeURIComponent(word)}`, {
      method: "POST",
    }),
  search: (q: string) =>
    request<SearchResult>(`/api/terms/search?q=${encodeURIComponent(q)}`),
};
