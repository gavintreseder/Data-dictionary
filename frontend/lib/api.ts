import type {
  AuditEvent,
  Definition,
  FlagStatus,
  ImportResult,
  LookupResult,
  PDFExtraction,
  RefineRequest,
  RefineResponse,
  SearchResult,
  Source,
  Stats,
  SystemInfo,
  Tag,
  TagCount,
  Term,
  TermCreate,
  TermDetail,
} from "./types";

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) || "";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
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
      /* ignore */
    }
    throw new Error(`${res.status} ${detail}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function upload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(apiUrl(path), { method: "POST", body: form });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status} ${detail}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string; app: string }>("/api/health"),
  system: () => request<SystemInfo>("/api/system"),
  stats: () => request<Stats>("/api/terms/stats"),
  sources: () => request<Source[]>("/api/sources"),
  listTerms: (params?: {
    q?: string;
    flag?: FlagStatus;
    category?: string;
    tag?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.flag) qs.set("flag", params.flag);
    if (params?.category) qs.set("category", params.category);
    if (params?.tag) qs.set("tag", params.tag);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<Term[]>(`/api/terms${suffix}`);
  },
  getTerm: (id: number) => request<TermDetail>(`/api/terms/${id}`),
  getTermBySlug: (slug: string) =>
    request<TermDetail>(`/api/terms/slug/${slug}`),
  getDefinitions: (id: number) =>
    request<Definition[]>(`/api/terms/${id}/definitions`),
  createTerm: (payload: TermCreate) =>
    request<TermDetail>(`/api/terms`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateTerm: (id: number, payload: Partial<TermCreate & { flag: FlagStatus }>) =>
    request<TermDetail>(`/api/terms/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  updateFlag: (id: number, flag: FlagStatus) =>
    request<Term>(`/api/terms/${id}/flag`, {
      method: "PUT",
      body: JSON.stringify({ flag }),
    }),
  setTags: (id: number, tags: string[]) =>
    request<TermDetail>(`/api/terms/${id}/tags`, {
      method: "PUT",
      body: JSON.stringify({ tags }),
    }),
  deleteTerm: (id: number) =>
    request<void>(`/api/terms/${id}`, { method: "DELETE" }),
  deleteDefinition: (termId: number, defId: number) =>
    request<void>(`/api/terms/${termId}/definitions/${defId}`, {
      method: "DELETE",
    }),
  lookup: (word: string) =>
    request<LookupResult>(`/api/lookup/${encodeURIComponent(word)}`, {
      method: "POST",
    }),
  refine: (id: number, payload: RefineRequest) =>
    request<RefineResponse>(`/api/terms/${id}/refine`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  search: (q: string) =>
    request<SearchResult>(`/api/terms/search?q=${encodeURIComponent(q)}`),
  tags: () => request<Tag[]>(`/api/tags`),
  tagCounts: () => request<TagCount[]>(`/api/tags/counts`),
  audit: (limit = 50) =>
    request<AuditEvent[]>(`/api/audit?limit=${limit}`),
  termAudit: (id: number) =>
    request<AuditEvent[]>(`/api/terms/${id}/audit`),
  importCsv: (
    file: File,
    mapping?: {
      term_column?: string;
      category_column?: string;
      summary_column?: string;
      definition_column?: string;
      source_slug?: string;
    }
  ) => {
    const form = new FormData();
    form.append("file", file);
    if (mapping?.term_column) form.append("term_column", mapping.term_column);
    if (mapping?.category_column)
      form.append("category_column", mapping.category_column);
    if (mapping?.summary_column)
      form.append("summary_column", mapping.summary_column);
    if (mapping?.definition_column)
      form.append("definition_column", mapping.definition_column);
    if (mapping?.source_slug) form.append("source_slug", mapping.source_slug);
    return upload<ImportResult>(`/api/import/csv`, form);
  },
  importJson: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return upload<ImportResult>(`/api/import/json`, form);
  },
  previewPdf: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return upload<PDFExtraction>(`/api/import/pdf/preview`, form);
  },
  importPdf: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return upload<ImportResult>(`/api/import/pdf`, form);
  },
  exportUrl: (format: "csv" | "json" | "md") =>
    apiUrl(`/api/export?format=${format}`),
  demoReset: () =>
    request<{ status: string; seeded: number }>(`/api/demo/reset`, {
      method: "POST",
    }),
};
