from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.term import FlagStatus, SourceType


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
    created_at: datetime
    source: SourceRead

    model_config = {"from_attributes": True}


class DefinitionCreate(BaseModel):
    text: str = Field(min_length=1)
    part_of_speech: Optional[str] = None
    example: Optional[str] = None
    source_slug: str = "business"


class TermRead(BaseModel):
    id: int
    term: str
    slug: str
    category: Optional[str] = None
    summary: Optional[str] = None
    flag: FlagStatus
    created_at: datetime
    updated_at: datetime
    definition_count: int = 0

    model_config = {"from_attributes": True}


class TermDetail(TermRead):
    definitions: list[DefinitionRead] = []


class TermCreate(BaseModel):
    term: str = Field(min_length=1, max_length=120)
    category: Optional[str] = None
    summary: Optional[str] = None
    definition: Optional[DefinitionCreate] = None


class TermUpdate(BaseModel):
    term: Optional[str] = None
    category: Optional[str] = None
    summary: Optional[str] = None
    flag: Optional[FlagStatus] = None


class FlagUpdate(BaseModel):
    flag: FlagStatus


class StatsRead(BaseModel):
    total_terms: int
    total_definitions: int
    sources: int
    by_flag: dict[str, int]
    by_source_type: dict[str, int]
    recent_terms: list[TermRead]


class LookupResult(BaseModel):
    term: str
    sources_queried: list[str]
    definitions_added: int
    term_id: int
    definitions: list[DefinitionRead]


class SearchResult(BaseModel):
    terms: list[TermRead]
    definitions: list[DefinitionRead]
