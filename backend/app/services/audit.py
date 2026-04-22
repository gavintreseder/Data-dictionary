"""Lightweight audit helper so routers can drop events in one line."""

from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.term import AuditEvent, AuditKind


async def record(
    session: AsyncSession,
    kind: AuditKind,
    summary: str,
    *,
    term_id: Optional[int] = None,
    detail: Optional[str] = None,
) -> None:
    session.add(
        AuditEvent(term_id=term_id, kind=kind, summary=summary, detail=detail)
    )
