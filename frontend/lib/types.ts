export type FlagStatus =
  | "none"
  | "needs_review"
  | "approved"
  | "disputed"
  | "archived";

export type SourceType =
  | "online"
  | "user_defined"
  | "pdf_import"
  | "llm_generated";

export type IndustryContext =
  | "generic"
  | "finance"
  | "healthcare"
  | "engineering"
  | "legal"
  | "public_sector";

export type AuditKind =
  | "created"
  | "updated"
  | "flag_changed"
  | "definition_added"
  | "definition_removed"
  | "refined"
  | "tagged"
  | "imported";

export interface Source {
  id: number;
  name: string;
  slug: string;
  source_type: SourceType;
  homepage?: string | null;
  description?: string | null;
}

export interface Definition {
  id: number;
  term_id: number;
  text: string;
  part_of_speech?: string | null;
  example?: string | null;
  external_ref?: string | null;
  is_consolidated?: boolean;
  created_at: string;
  source: Source;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface TagCount extends Tag {
  count: number;
}

export interface Term {
  id: number;
  term: string;
  slug: string;
  category?: string | null;
  summary?: string | null;
  flag: FlagStatus;
  industry_context: IndustryContext;
  created_at: string;
  updated_at: string;
  definition_count: number;
  tags: Tag[];
}

export interface TermDetail extends Term {
  definitions: Definition[];
}

export interface Stats {
  total_terms: number;
  total_definitions: number;
  sources: number;
  tags: number;
  by_flag: Record<FlagStatus, number>;
  by_source_type: Record<SourceType, number>;
  recent_terms: Term[];
}

export interface LookupResult {
  term: string;
  term_id: number;
  sources_queried: string[];
  definitions_added: number;
  definitions: Definition[];
}

export interface SearchHit {
  id: number;
  term_id: number;
  kind: "term" | "definition";
  title: string;
  snippet: string;
  source_slug?: string | null;
  flag?: FlagStatus | null;
}

export interface SearchResult {
  query: string;
  terms: Term[];
  definitions: Definition[];
  hits: SearchHit[];
}

export interface TermCreate {
  term: string;
  category?: string | null;
  summary?: string | null;
  industry_context?: IndustryContext;
  definition?: {
    text: string;
    part_of_speech?: string | null;
    example?: string | null;
    source_slug?: string;
  };
}

export interface RefineRequest {
  prompt?: string | null;
  industry_context?: IndustryContext;
  apply?: boolean;
}

export interface RefineResponse {
  term_id: number;
  model: string;
  text: string;
  sources_used: string[];
  confidence: number;
  refinement_id: number;
  definition_id?: number | null;
  llm_enabled: boolean;
}

export interface AuditEvent {
  id: number;
  term_id?: number | null;
  kind: AuditKind;
  summary: string;
  detail?: string | null;
  created_at: string;
}

export interface ImportResult {
  filename: string;
  kind: string;
  terms_added: number;
  definitions_added: number;
  skipped: number;
  detail?: string | null;
}

export interface PDFExtraction {
  filename: string;
  total_pages: number;
  extracted_terms: number;
  extractor: string;
  llm_errors?: string[];
  preview: Array<{
    term: string;
    definition?: string | null;
    category?: string | null;
    summary?: string | null;
    source_slug?: string | null;
  }>;
}

export interface SystemInfo {
  app: string;
  environment: string;
  llm: {
    enabled: boolean;
    ollama: boolean;
    huggingface: boolean;
    model: string;
  };
}
