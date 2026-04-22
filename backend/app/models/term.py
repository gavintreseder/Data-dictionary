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


class IndustryContext(str, Enum):
    GENERIC = "generic"
    FINANCE = "finance"
    HEALTHCARE = "healthcare"
    ENGINEERING = "engineering"
    LEGAL = "legal"
    PUBLIC_SECTOR = "public_sector"


class AuditKind(str, Enum):
    CREATED = "created"
    UPDATED = "updated"
    FLAG_CHANGED = "flag_changed"
    DEFINITION_ADDED = "definition_added"
    DEFINITION_REMOVED = "definition_removed"
    REFINED = "refined"
    TAGGED = "tagged"
    IMPORTED = "imported"


class TermTag(SQLModel, table=True):
    __tablename__ = "term_tags"
    term_id: Optional[int] = Field(
        default=None, foreign_key="terms.id", primary_key=True
    )
    tag_id: Optional[int] = Field(
        default=None, foreign_key="tags.id", primary_key=True
    )


class Tag(SQLModel, table=True):
    __tablename__ = "tags"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    slug: str = Field(index=True, unique=True)
    created_at: datetime = Field(default_factory=utcnow)

    terms: list["Term"] = Relationship(back_populates="tags", link_model=TermTag)


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
    industry_context: IndustryContext = Field(default=IndustryContext.GENERIC)
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
    audit_events: list["AuditEvent"] = Relationship(
        back_populates="term",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    tags: list[Tag] = Relationship(back_populates="terms", link_model=TermTag)


class Definition(SQLModel, table=True):
    __tablename__ = "definitions"

    id: Optional[int] = Field(default=None, primary_key=True)
    term_id: int = Field(foreign_key="terms.id", index=True)
    source_id: int = Field(foreign_key="sources.id", index=True)
    text: str
    part_of_speech: Optional[str] = None
    example: Optional[str] = None
    external_ref: Optional[str] = None
    is_consolidated: bool = Field(default=False)  # True for LLM-produced consensus
    created_at: datetime = Field(default_factory=utcnow)

    term: Term = Relationship(back_populates="definitions")
    source: Source = Relationship(back_populates="definitions")


class ImportJob(SQLModel, table=True):
    __tablename__ = "import_jobs"

    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    kind: str = Field(default="csv")  # csv | json | pdf
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
    industry_context: IndustryContext = Field(default=IndustryContext.GENERIC)
    source_slugs: str = Field(default="")  # csv of sources fed to the LLM
    confidence: Optional[float] = None  # 0..1 agreement score
    created_at: datetime = Field(default_factory=utcnow)

    term: Term = Relationship(back_populates="refinements")


class AuditEvent(SQLModel, table=True):
    __tablename__ = "audit_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    term_id: Optional[int] = Field(default=None, foreign_key="terms.id", index=True)
    kind: AuditKind = Field(index=True)
    summary: str
    detail: Optional[str] = None  # JSON blob or free-text diff
    created_at: datetime = Field(default_factory=utcnow, index=True)

    term: Optional[Term] = Relationship(back_populates="audit_events")
