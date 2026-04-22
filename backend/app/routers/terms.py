from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import or_, select

from app.database import get_session
from app.models.term import (
    AuditEvent,
    AuditKind,
    Definition,
    FlagStatus,
    IndustryContext,
    Source,
    Tag,
    Term,
    TermTag,
)
from app.schemas.term import (
    AuditEventRead,
    DefinitionRead,
    FlagUpdate,
    SearchHit,
    SearchResult,
    StatsRead,
    TagRead,
    TagsUpdate,
    TermCreate,
    TermDetail,
    TermRead,
    TermUpdate,
)
from app.seed.loader import slugify
from app.services import audit

router = APIRouter(prefix="/api/terms", tags=["terms"])


async def _load_tags_for(session: AsyncSession, term_id: int) -> list[Tag]:
    return list(
        (
            await session.execute(
                select(Tag)
                .join(TermTag, TermTag.tag_id == Tag.id)
                .where(TermTag.term_id == term_id)
                .order_by(Tag.name.asc())
            )
        ).scalars().all()
    )


async def _term_read(session: AsyncSession, term: Term) -> TermRead:
    count = await session.scalar(
        select(func.count(Definition.id)).where(Definition.term_id == term.id)
    )
    tags = await _load_tags_for(session, term.id)
    return TermRead.model_validate(
        {
            "id": term.id,
            "term": term.term,
            "slug": term.slug,
            "category": term.category,
            "summary": term.summary,
            "flag": term.flag,
            "industry_context": term.industry_context,
            "created_at": term.created_at,
            "updated_at": term.updated_at,
            "definition_count": int(count or 0),
            "tags": [TagRead.model_validate(t, from_attributes=True) for t in tags],
        }
    )


async def _eager_term(session: AsyncSession, term_id: int) -> Optional[Term]:
    result = await session.execute(
        select(Term)
        .options(
            selectinload(Term.definitions).selectinload(Definition.source),
            selectinload(Term.tags),
        )
        .where(Term.id == term_id)
    )
    return result.scalar_one_or_none()


@router.get("/stats", response_model=StatsRead)
async def term_stats(session: AsyncSession = Depends(get_session)) -> StatsRead:
    total_terms = await session.scalar(select(func.count(Term.id))) or 0
    total_defs = await session.scalar(select(func.count(Definition.id))) or 0
    total_sources = await session.scalar(select(func.count(Source.id))) or 0
    total_tags = await session.scalar(select(func.count(Tag.id))) or 0

    flag_rows = (
        await session.execute(select(Term.flag, func.count(Term.id)).group_by(Term.flag))
    ).all()
    by_flag = {flag.value: count for flag, count in flag_rows}
    for flag in FlagStatus:
        by_flag.setdefault(flag.value, 0)

    source_rows = (
        await session.execute(
            select(Source.source_type, func.count(Definition.id))
            .join(Definition, Definition.source_id == Source.id, isouter=True)
            .group_by(Source.source_type)
        )
    ).all()
    by_source_type = {st.value: int(count or 0) for st, count in source_rows}

    recent_result = await session.execute(
        select(Term)
        .options(selectinload(Term.tags))
        .order_by(Term.updated_at.desc())
        .limit(6)
    )
    recent_terms = [await _term_read(session, t) for t in recent_result.scalars().all()]

    return StatsRead(
        total_terms=int(total_terms),
        total_definitions=int(total_defs),
        sources=int(total_sources),
        tags=int(total_tags),
        by_flag=by_flag,
        by_source_type=by_source_type,
        recent_terms=recent_terms,
    )


@router.get("", response_model=list[TermRead])
async def list_terms(
    q: Optional[str] = Query(None, description="Search on term or summary"),
    flag: Optional[FlagStatus] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> list[TermRead]:
    stmt = select(Term).options(selectinload(Term.tags))
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(func.lower(Term.term).like(like), func.lower(Term.summary).like(like))
        )
    if flag is not None:
        stmt = stmt.where(Term.flag == flag)
    if category:
        stmt = stmt.where(Term.category == category)
    if tag:
        stmt = stmt.join(Term.tags).where(Tag.slug == tag)
    stmt = stmt.order_by(Term.term.asc()).offset(offset).limit(limit)

    result = await session.execute(stmt)
    terms = result.scalars().unique().all()
    return [await _term_read(session, t) for t in terms]


def _make_snippet(text: str, query: str, length: int = 160) -> str:
    idx = text.lower().find(query.lower())
    if idx == -1:
        return (text[:length] + "…") if len(text) > length else text
    start = max(0, idx - 40)
    end = min(len(text), idx + len(query) + 120)
    chunk = text[start:end]
    if start > 0:
        chunk = "…" + chunk
    if end < len(text):
        chunk = chunk + "…"
    return chunk


@router.get("/search", response_model=SearchResult)
async def search_all(
    q: str = Query(..., min_length=1),
    session: AsyncSession = Depends(get_session),
) -> SearchResult:
    like = f"%{q.lower()}%"
    term_rows = (
        await session.execute(
            select(Term)
            .options(selectinload(Term.tags))
            .where(
                or_(
                    func.lower(Term.term).like(like),
                    func.lower(Term.summary).like(like),
                    func.lower(Term.category).like(like),
                )
            )
            .order_by(Term.term.asc())
            .limit(50)
        )
    ).scalars().unique().all()

    def_rows = (
        await session.execute(
            select(Definition)
            .options(selectinload(Definition.source))
            .where(func.lower(Definition.text).like(like))
            .limit(50)
        )
    ).scalars().all()

    hits: list[SearchHit] = []
    for t in term_rows:
        hits.append(
            SearchHit(
                id=t.id,
                term_id=t.id,
                kind="term",
                title=t.term,
                snippet=_make_snippet(t.summary or t.term, q),
                flag=t.flag,
            )
        )
    for d in def_rows:
        hits.append(
            SearchHit(
                id=d.id,
                term_id=d.term_id,
                kind="definition",
                title=d.source.name,
                snippet=_make_snippet(d.text, q),
                source_slug=d.source.slug,
            )
        )

    return SearchResult(
        query=q,
        terms=[await _term_read(session, t) for t in term_rows],
        definitions=[DefinitionRead.model_validate(d, from_attributes=True) for d in def_rows],
        hits=hits,
    )


@router.get("/{term_id}", response_model=TermDetail)
async def get_term(
    term_id: int, session: AsyncSession = Depends(get_session)
) -> TermDetail:
    term = await _eager_term(session, term_id)
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")

    base = await _term_read(session, term)
    return TermDetail(
        **base.model_dump(),
        definitions=[
            DefinitionRead.model_validate(d, from_attributes=True)
            for d in sorted(term.definitions, key=lambda d: d.created_at)
        ],
    )


@router.get("/slug/{slug}", response_model=TermDetail)
async def get_term_by_slug(
    slug: str, session: AsyncSession = Depends(get_session)
) -> TermDetail:
    term = (
        await session.execute(
            select(Term)
            .options(
                selectinload(Term.definitions).selectinload(Definition.source),
                selectinload(Term.tags),
            )
            .where(Term.slug == slug)
        )
    ).scalar_one_or_none()
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")
    base = await _term_read(session, term)
    return TermDetail(
        **base.model_dump(),
        definitions=[
            DefinitionRead.model_validate(d, from_attributes=True)
            for d in sorted(term.definitions, key=lambda d: d.created_at)
        ],
    )


@router.post("", response_model=TermDetail, status_code=status.HTTP_201_CREATED)
async def create_term(
    payload: TermCreate, session: AsyncSession = Depends(get_session)
) -> TermDetail:
    slug = slugify(payload.term)
    existing = await session.scalar(select(Term).where(Term.slug == slug))
    if existing is not None:
        raise HTTPException(status_code=409, detail="A term with this name already exists")

    term = Term(
        term=payload.term.strip(),
        slug=slug,
        category=payload.category,
        summary=payload.summary,
        industry_context=payload.industry_context,
    )
    session.add(term)
    await session.flush()

    if payload.definition:
        source = await session.scalar(
            select(Source).where(Source.slug == payload.definition.source_slug)
        )
        if source is None:
            source = await session.scalar(select(Source).where(Source.slug == "business"))
        if source is not None:
            session.add(
                Definition(
                    term_id=term.id,
                    source_id=source.id,
                    text=payload.definition.text,
                    part_of_speech=payload.definition.part_of_speech,
                    example=payload.definition.example,
                )
            )

    await audit.record(
        session,
        AuditKind.CREATED,
        f'Created "{term.term}"',
        term_id=term.id,
    )
    await session.commit()
    return await get_term(term.id, session)


@router.put("/{term_id}", response_model=TermDetail)
async def update_term(
    term_id: int,
    payload: TermUpdate,
    session: AsyncSession = Depends(get_session),
) -> TermDetail:
    term = await session.get(Term, term_id)
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")
    before = {
        "term": term.term,
        "category": term.category,
        "summary": term.summary,
        "flag": term.flag.value,
        "industry_context": term.industry_context.value,
    }
    if payload.term is not None:
        term.term = payload.term
        term.slug = slugify(payload.term)
    if payload.category is not None:
        term.category = payload.category
    if payload.summary is not None:
        term.summary = payload.summary
    if payload.flag is not None:
        term.flag = payload.flag
    if payload.industry_context is not None:
        term.industry_context = payload.industry_context
    term.updated_at = datetime.now(timezone.utc)

    await audit.record(
        session,
        AuditKind.UPDATED,
        f'Updated "{term.term}"',
        term_id=term.id,
        detail=str(before),
    )
    await session.commit()
    return await get_term(term_id, session)


@router.put("/{term_id}/flag", response_model=TermRead)
async def flag_term(
    term_id: int,
    payload: FlagUpdate,
    session: AsyncSession = Depends(get_session),
) -> TermRead:
    term = await session.get(Term, term_id)
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")
    prev = term.flag.value
    term.flag = payload.flag
    term.updated_at = datetime.now(timezone.utc)
    await audit.record(
        session,
        AuditKind.FLAG_CHANGED,
        f'Flag: {prev} → {payload.flag.value}',
        term_id=term.id,
    )
    await session.commit()
    await session.refresh(term)
    return await _term_read(session, term)


@router.put("/{term_id}/tags", response_model=TermDetail)
async def set_tags(
    term_id: int,
    payload: TagsUpdate,
    session: AsyncSession = Depends(get_session),
) -> TermDetail:
    from sqlalchemy import delete

    term = await session.get(Term, term_id)
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")

    clean_names = [n.strip() for n in payload.tags if n and n.strip()]
    seen: dict[str, Tag] = {}
    for name in clean_names:
        slug = slugify(name)
        tag = (
            await session.execute(select(Tag).where(Tag.slug == slug))
        ).scalar_one_or_none()
        if tag is None:
            tag = Tag(name=name, slug=slug)
            session.add(tag)
            await session.flush()
        seen[slug] = tag

    # Replace associations via direct link-table writes (avoids async lazy-load)
    await session.execute(delete(TermTag).where(TermTag.term_id == term_id))
    for tag in seen.values():
        session.add(TermTag(term_id=term_id, tag_id=tag.id))

    term.updated_at = datetime.now(timezone.utc)

    await audit.record(
        session,
        AuditKind.TAGGED,
        f'Tags set: {", ".join(t.name for t in seen.values()) or "(none)"}',
        term_id=term.id,
    )
    await session.commit()
    return await get_term(term_id, session)


@router.delete("/{term_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_term(term_id: int, session: AsyncSession = Depends(get_session)) -> None:
    term = await session.get(Term, term_id)
    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")
    await session.delete(term)
    await session.commit()


@router.get("/{term_id}/definitions", response_model=list[DefinitionRead])
async def get_definitions(
    term_id: int, session: AsyncSession = Depends(get_session)
) -> list[DefinitionRead]:
    exists = await session.get(Term, term_id)
    if exists is None:
        raise HTTPException(status_code=404, detail="Term not found")
    result = await session.execute(
        select(Definition)
        .options(selectinload(Definition.source))
        .where(Definition.term_id == term_id)
        .order_by(Definition.created_at.asc())
    )
    defs = result.scalars().all()
    return [DefinitionRead.model_validate(d, from_attributes=True) for d in defs]


@router.delete(
    "/{term_id}/definitions/{definition_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_definition(
    term_id: int,
    definition_id: int,
    session: AsyncSession = Depends(get_session),
) -> None:
    d = await session.get(Definition, definition_id)
    if d is None or d.term_id != term_id:
        raise HTTPException(status_code=404, detail="Definition not found")
    await session.delete(d)
    await audit.record(
        session,
        AuditKind.DEFINITION_REMOVED,
        f"Removed a definition",
        term_id=term_id,
    )
    await session.commit()


@router.get("/{term_id}/audit", response_model=list[AuditEventRead])
async def term_audit(
    term_id: int, session: AsyncSession = Depends(get_session)
) -> list[AuditEventRead]:
    result = await session.execute(
        select(AuditEvent)
        .where(AuditEvent.term_id == term_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(100)
    )
    return [
        AuditEventRead.model_validate(e, from_attributes=True)
        for e in result.scalars().all()
    ]
