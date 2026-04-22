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
  created_at: string;
  source: Source;
}

export interface Term {
  id: number;
  term: string;
  slug: string;
  category?: string | null;
  summary?: string | null;
  flag: FlagStatus;
  created_at: string;
  updated_at: string;
  definition_count: number;
}

export interface TermDetail extends Term {
  definitions: Definition[];
}

export interface Stats {
  total_terms: number;
  total_definitions: number;
  sources: number;
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

export interface SearchResult {
  terms: Term[];
  definitions: Definition[];
}

export interface TermCreate {
  term: string;
  category?: string | null;
  summary?: string | null;
  definition?: {
    text: string;
    part_of_speech?: string | null;
    example?: string | null;
    source_slug?: string;
  };
}
