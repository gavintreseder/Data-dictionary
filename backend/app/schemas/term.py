from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.term import (
    AuditKind,
    FlagStatus,
    IndustryContext,
    SourceType,
)


class SourceRead(BaseModel):
    id: int
    name: str
    slug: str
    source_type: SourceType
    homepage: Optional[str] = None
    description: Optional[str] = None

    model_config = {"from_attributes": True}


class DefinitionRead(BaseModel):
    id: int
    term_id: int
    text: str
    part_of_speech: Optional[str] = None
    example: Optional[str] = None
    external_ref: Optional[str] = None
    is_consolidated: bool = False
    created_at: datetime
    source: SourceRead

    model_config = {"from_attributes": True}


class DefinitionCreate(BaseModel):
    text: str = Field(min_length=1)
    part_of_speech: Optional[str] = None
    example: Optional[str] = None
    source_slug: str = "business"


class TagRead(BaseModel):
    id: int
    name: str
    slug: str

    model_config = {"from_attributes": True}


class TermRead(BaseModel):
    id: int
    term: str
    slug: str
    category: Optional[str] = None
    summary: Optional[str] = None
    flag: FlagStatus
    industry_context: IndustryContext = IndustryContext.GENERIC
    created_at: datetime
    updated_at: datetime
    definition_count: int = 0
    tags: list[TagRead] = []

    model_config = {"from_attributes": True}


class TermDetail(TermRead):
    definitions: list[DefinitionRead] = []


class TermCreate(BaseModel):
    term: str = Field(min_length=1, max_length=160)
    category: Optional[str] = None
    summary: Optional[str] = None
    industry_context: IndustryContext = IndustryContext.GENERIC
    definition: Optional[DefinitionCreate] = None


class TermUpdate(BaseModel):
    term: Optional[str] = None
    category: Optional[str] = None
    summary: Optional[str] = None
    flag: Optional[FlagStatus] = None
    industry_context: Optional[IndustryContext] = None


class FlagUpdate(BaseModel):
    flag: FlagStatus


class TagsUpdate(BaseModel):
    tags: list[str]  # tag names; created on the fly


class StatsRead(BaseModel):
    total_terms: int
    total_definitions: int
    sources: int
    tags: int
    by_flag: dict[str, int]
    by_source_type: dict[str, int]
    recent_terms: list[TermRead]


class LookupResult(BaseModel):
    term: str
    sources_queried: list[str]
    definitions_added: int
    term_id: int
    definitions: list[DefinitionRead]


class SearchHit(BaseModel):
    id: int
    term_id: int
    kind: str  # "term" | "definition"
    title: str
    snippet: str
    source_slug: Optional[str] = None
    flag: Optional[FlagStatus] = None


class SearchResult(BaseModel):
    query: str
    terms: list[TermRead]
    definitions: list[DefinitionRead]
    hits: list[SearchHit]


class RefineRequest(BaseModel):
    prompt: Optional[str] = None
    industry_context: Optional[IndustryContext] = None
    apply: bool = False  # if true, also insert a consolidated Definition


class RefineResponse(BaseModel):
    term_id: int
    model: str
    text: str
    sources_used: list[str]
    confidence: float
    refinement_id: int
    definition_id: Optional[int] = None
    llm_enabled: bool


class AuditEventRead(BaseModel):
    id: int
    term_id: Optional[int]
    kind: AuditKind
    summary: str
    detail: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ImportPreviewRow(BaseModel):
    term: str
    category: Optional[str] = None
    summary: Optional[str] = None
    definition: Optional[str] = None
    source_slug: Optional[str] = None


class ImportCSVMapping(BaseModel):
    term_column: str = "term"
    category_column: Optional[str] = "category"
    summary_column: Optional[str] = "summary"
    definition_column: Optional[str] = "definition"
    source_slug: str = "business"


class ImportResult(BaseModel):
    filename: str
    kind: str
    terms_added: int
    definitions_added: int
    skipped: int
    detail: Optional[str] = None


class PDFExtraction(BaseModel):
    filename: str
    total_pages: int
    extracted_terms: int
    preview: list[ImportPreviewRow]
