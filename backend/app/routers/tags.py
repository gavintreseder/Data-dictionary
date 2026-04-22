from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.term import Tag, TermTag
from app.schemas.term import TagRead

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=list[TagRead])
async def list_tags(session: AsyncSession = Depends(get_session)) -> list[TagRead]:
    result = await session.execute(select(Tag).order_by(Tag.name.asc()))
    return [TagRead.model_validate(t, from_attributes=True) for t in result.scalars().all()]


@router.get("/counts")
async def tag_counts(session: AsyncSession = Depends(get_session)) -> list[dict]:
    rows = (
        await session.execute(
            select(Tag.id, Tag.name, Tag.slug, func.count(TermTag.term_id))
            .join(TermTag, TermTag.tag_id == Tag.id, isouter=True)
            .group_by(Tag.id)
            .order_by(Tag.name.asc())
        )
    ).all()
    return [
        {"id": r[0], "name": r[1], "slug": r[2], "count": int(r[3] or 0)}
        for r in rows
    ]
