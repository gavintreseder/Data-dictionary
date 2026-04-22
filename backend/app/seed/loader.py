import json
import re
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import AsyncSessionLocal
from app.models.term import Definition, Source, SourceType, Tag, Term, TermTag

SEED_PATH = Path(__file__).parent / "sample_terms.json"


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip().lower()).strip("-")
    return slug or "term"


async def _load_sources(session: AsyncSession, data: dict) -> dict[str, Source]:
    by_slug: dict[str, Source] = {}
    for entry in data.get("sources", []):
        slug = entry["slug"]
        result = await session.execute(select(Source).where(Source.slug == slug))
        source = result.scalar_one_or_none()
        if source is None:
            source = Source(
                name=entry["name"],
                slug=slug,
                source_type=SourceType(entry.get("source_type", "online")),
                homepage=entry.get("homepage"),
                description=entry.get("description"),
            )
            session.add(source)
            await session.flush()
        by_slug[slug] = source
    return by_slug


async def _load_tags(session: AsyncSession, data: dict) -> dict[str, Tag]:
    by_name: dict[str, Tag] = {}
    for name in data.get("tags", []) or []:
        slug = slugify(name)
        existing = (
            await session.execute(select(Tag).where(Tag.slug == slug))
        ).scalar_one_or_none()
        if existing is None:
            existing = Tag(name=name, slug=slug)
            session.add(existing)
            await session.flush()
        by_name[name.lower()] = existing
    return by_name


async def _load_terms(
    session: AsyncSession,
    data: dict,
    sources: dict[str, Source],
    tags_by_name: dict[str, Tag],
) -> int:
    added = 0
    for entry in data.get("terms", []):
        name = entry["term"]
        slug = slugify(name)
        result = await session.execute(select(Term).where(Term.slug == slug))
        term = result.scalar_one_or_none()
        if term is not None:
            continue
        term = Term(
            term=name,
            slug=slug,
            category=entry.get("category"),
            summary=entry.get("summary"),
        )
        session.add(term)
        await session.flush()

        for defn in entry.get("definitions", []):
            source_slug = defn.get("source", "business")
            source = sources.get(source_slug)
            if source is None:
                continue
            session.add(
                Definition(
                    term_id=term.id,
                    source_id=source.id,
                    text=defn["text"],
                    part_of_speech=defn.get("part_of_speech"),
                    example=defn.get("example"),
                )
            )

        for tag_name in entry.get("tags", []) or []:
            tag = tags_by_name.get(tag_name.lower())
            if tag is None:
                tag = Tag(name=tag_name, slug=slugify(tag_name))
                session.add(tag)
                await session.flush()
                tags_by_name[tag_name.lower()] = tag
            session.add(TermTag(term_id=term.id, tag_id=tag.id))

        added += 1
    return added


async def seed_database() -> int:
    if not SEED_PATH.exists():
        return 0
    data = json.loads(SEED_PATH.read_text())
    async with AsyncSessionLocal() as session:
        sources = await _load_sources(session, data)
        tags = await _load_tags(session, data)
        added = await _load_terms(session, data, sources, tags)
        await session.commit()
        return added


async def reset_database() -> int:
    """Wipe all term-related data and re-seed. Used by demo mode."""
    from sqlalchemy import delete

    from app.models.term import (
        AuditEvent,
        Definition,
        LLMRefinement,
        Tag,
        Term,
        TermTag,
    )

    async with AsyncSessionLocal() as session:
        await session.execute(delete(AuditEvent))
        await session.execute(delete(LLMRefinement))
        await session.execute(delete(Definition))
        await session.execute(delete(TermTag))
        await session.execute(delete(Tag))
        await session.execute(delete(Term))
        await session.commit()

    return await seed_database()
