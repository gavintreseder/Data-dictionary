from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class FlagStatus(str, Enum):
    NONE = "none"
    NEEDS_REVIEW = "needs_review"
    APPROVED = "approved"
    DISPUTED = "disputed"
    ARCHIVED = "archived"


class SourceType(str, Enum):
    ONLINE = "online"
    USER_DEFINED = "user_defined"
    PDF_IMPORT = "pdf_import"
    LLM_GENERATED = "llm_generated"


class ImportStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETE = "complete"
    FAILED = "failed"


class Source(SQLModel, table=True):
    __tablename__ = "sources"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    slug: str = Field(index=True, unique=True)
    source_type: SourceType = Field(default=SourceType.ONLINE)
    homepage: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)

    definitions: list["Definition"] = Relationship(back_populates="source")


class Term(SQLModel, table=True):
    __tablename__ = "terms"

    id: Optional[int] = Field(default=None, primary_key=True)
    term: str = Field(index=True)
    slug: str = Field(index=True, unique=True)
    category: Optional[str] = Field(default=None, index=True)
    summary: Optional[str] = None
    flag: FlagStatus = Field(default=FlagStatus.NONE, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    definitions: list["Definition"] = Relationship(
        back_populates="term",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    refinements: list["LLMRefinement"] = Relationship(
        back_populates="term",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class Definition(SQLModel, table=True):
    __tablename__ = "definitions"

    id: Optional[int] = Field(default=None, primary_key=True)
    term_id: int = Field(foreign_key="terms.id", index=True)
    source_id: int = Field(foreign_key="sources.id", index=True)
    text: str
    part_of_speech: Optional[str] = None
    example: Optional[str] = None
    external_ref: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)

    term: Term = Relationship(back_populates="definitions")
    source: Source = Relationship(back_populates="definitions")


class ImportJob(SQLModel, table=True):
    __tablename__ = "import_jobs"

    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    status: ImportStatus = Field(default=ImportStatus.PENDING)
    detail: Optional[str] = None
    terms_added: int = 0
    definitions_added: int = 0
    created_at: datetime = Field(default_factory=utcnow)
    finished_at: Optional[datetime] = None


class LLMRefinement(SQLModel, table=True):
    __tablename__ = "llm_refinements"

    id: Optional[int] = Field(default=None, primary_key=True)
    term_id: int = Field(foreign_key="terms.id", index=True)
    prompt: Optional[str] = None
    text: str
    model: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)

    term: Term = Relationship(back_populates="refinements")
