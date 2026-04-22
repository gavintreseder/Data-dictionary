from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.database import get_session
from app.models.term import AuditKind, Definition, Source, Term
from app.schemas.term import DefinitionRead, LookupResult
from app.seed.loader import slugify
from app.services import audit
from app.services.dictionary_service import lookup_word

router = APIRouter(prefix="/api/lookup", tags=["lookup"])


@router.post("/{word}", response_model=LookupResult)
async def lookup(
    word: str,
    session: AsyncSession = Depends(get_session),
) -> LookupResult:
    word = word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="Word is required")

    slug = slugify(word)
    term = (
        await session.execute(select(Term).where(Term.slug == slug))
    ).scalar_one_or_none()
    newly_created = False
    if term is None:
        term = Term(term=word.title(), slug=slug, summary=None)
        session.add(term)
        await session.flush()
        newly_created = True

    results = await lookup_word(word)
    added = 0

    for source_slug, defs in results.items():
        if not defs:
            continue
        source = (
            await session.execute(select(Source).where(Source.slug == source_slug))
        ).scalar_one_or_none()
        if source is None:
            continue

        existing_texts = set(
            (
                await session.execute(
                    select(Definition.text).where(
                        Definition.term_id == term.id,
                        Definition.source_id == source.id,
                    )
                )
            ).scalars().all()
        )

        for extern in defs[:5]:
            if extern.text in existing_texts:
                continue
            session.add(
                Definition(
                    term_id=term.id,
                    source_id=source.id,
                    text=extern.text,
                    part_of_speech=extern.part_of_speech,
                    example=extern.example,
                    external_ref=extern.external_ref,
                )
            )
            existing_texts.add(extern.text)
            added += 1

    if newly_created:
        await audit.record(
            session,
            AuditKind.CREATED,
            f'Created "{term.term}" via lookup',
            term_id=term.id,
        )
    if added:
        await audit.record(
            session,
            AuditKind.DEFINITION_ADDED,
            f"Added {added} definition(s) from "
            + ", ".join(slug for slug, defs in results.items() if defs),
            term_id=term.id,
        )

    await session.commit()

    refreshed = (
        await session.execute(
            select(Definition)
            .options(selectinload(Definition.source))
            .where(Definition.term_id == term.id)
            .order_by(Definition.created_at.asc())
        )
    ).scalars().all()

    return LookupResult(
        term=term.term,
        sources_queried=list(results.keys()),
        definitions_added=added,
        term_id=term.id,
        definitions=[
            DefinitionRead.model_validate(d, from_attributes=True) for d in refreshed
        ],
    )
