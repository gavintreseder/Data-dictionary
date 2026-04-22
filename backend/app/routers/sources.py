from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.term import Source
from app.schemas.term import SourceRead

router = APIRouter(prefix="/api/sources", tags=["sources"])


@router.get("", response_model=list[SourceRead])
async def list_sources(session: AsyncSession = Depends(get_session)) -> list[SourceRead]:
    result = await session.execute(select(Source).order_by(Source.name.asc()))
    return [SourceRead.model_validate(s, from_attributes=True) for s in result.scalars().all()]
