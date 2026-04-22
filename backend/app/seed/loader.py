import json
import re
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import AsyncSessionLocal
from app.models.term import Definition, Source, SourceType, Term

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


async def _load_terms(
    session: AsyncSession, data: dict, sources: dict[str, Source]
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
        added += 1
    return added


async def seed_database() -> int:
    if not SEED_PATH.exists():
        return 0
    data = json.loads(SEED_PATH.read_text())
    async with AsyncSessionLocal() as session:
        sources = await _load_sources(session, data)
        added = await _load_terms(session, data, sources)
        await session.commit()
        return added
