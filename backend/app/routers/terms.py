from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import or_, select

from app.database import get_session
from app.models.term import Definition, FlagStatus, Source, Term
from app.schemas.term import (
    DefinitionRead,
    FlagUpdate,
    SearchResult,
    StatsRead,
    TermCreate,
    TermDetail,
    TermRead,
    TermUpdate,
)
from app.seed.loader import slugify

router = APIRouter(prefix="/api/terms", tags=["terms"])


async def _term_read(session: AsyncSession, term: Term) -> TermRead:
    count = await session.scalar(
        select(func.count(Definition.id)).where(Definition.term_id == term.id)
    )
    data = TermRead.model_validate(term, from_attributes=True)
    data.definition_count = int(count or 0)
    return data


@router.get("/stats", response_model=StatsRead)
async def term_stats(session: AsyncSession = Depends(get_session)) -> StatsRead:
    total_terms = await session.scalar(select(func.count(Term.id))) or 0
    total_defs = await session.scalar(select(func.count(Definition.id))) or 0
    total_sources = await session.scalar(select(func.count(Source.id))) or 0

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
        select(Term).order_by(Term.updated_at.desc()).limit(6)
    )
    recent_terms = [await _term_read(session, t) for t in recent_result.scalars().all()]

    return StatsRead(
        total_terms=int(total_terms),
        total_definitions=int(total_defs),
        sources=int(total_sources),
        by_flag=by_flag,
        by_source_type=by_source_type,
        recent_terms=recent_terms,
    )


@router.get("", response_model=list[TermRead])
async def list_terms(
    q: Optional[str] = Query(None, description="Search on term or summary"),
    flag: Optional[FlagStatus] = None,
    category: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
) -> list[TermRead]:
    stmt = select(Term)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(func.lower(Term.term).like(like), func.lower(Term.summary).like(like))
        )
    if flag is not None:
        stmt = stmt.where(Term.flag == flag)
    if category:
        stmt = stmt.where(Term.category == category)
    stmt = stmt.order_by(Term.term.asc()).offset(offset).limit(limit)

    result = await session.execute(stmt)
    terms = result.scalars().all()
    return [await _term_read(session, t) for t in terms]


@router.get("/search", response_model=SearchResult)
async def search_all(
    q: str = Query(..., min_length=1),
    session: AsyncSession = Depends(get_session),
) -> SearchResult:
    like = f"%{q.lower()}%"
    term_rows = (
        await session.execute(
            select(Term)
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
    ).scalars().all()

    def_rows = (
        await session.execute(
            select(Definition)
            .options(selectinload(Definition.source))
            .where(func.lower(Definition.text).like(like))
            .limit(50)
        )
    ).scalars().all()

    return SearchResult(
        terms=[await _term_read(session, t) for t in term_rows],
        definitions=[DefinitionRead.model_validate(d, from_attributes=True) for d in def_rows],
    )


@router.get("/{term_id}", response_model=TermDetail)
async def get_term(
    term_id: int, session: AsyncSession = Depends(get_session)
) -> TermDetail:
    result = await session.execute(
        select(Term)
        .options(selectinload(Term.definitions).selectinload(Definition.source))
        .where(Term.id == term_id)
    )
    term = result.scalar_one_or_none()
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
    if payload.term is not None:
        term.term = payload.term
        term.slug = slugify(payload.term)
    if payload.category is not None:
        term.category = payload.category
    if payload.summary is not None:
        term.summary = payload.summary
    if payload.flag is not None:
        term.flag = payload.flag
    term.updated_at = datetime.now(timezone.utc)
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
    term.flag = payload.flag
    term.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(term)
    return await _term_read(session, term)


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
