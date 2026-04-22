from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.database import get_session
from app.models.term import AuditEvent
from app.schemas.term import AuditEventRead

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get("", response_model=list[AuditEventRead])
async def global_audit(
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[AuditEventRead]:
    result = await session.execute(
        select(AuditEvent).order_by(AuditEvent.created_at.desc()).limit(limit)
    )
    return [
        AuditEventRead.model_validate(e, from_attributes=True)
        for e in result.scalars().all()
    ]
