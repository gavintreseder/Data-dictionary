from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.config import llm_enabled
from app.database import get_session
from app.models.term import (
    AuditKind,
    Definition,
    LLMRefinement,
    Source,
    Term,
)
from app.schemas.term import RefineRequest, RefineResponse
from app.services import audit
from app.services.llm_service import consolidate

router = APIRouter(prefix="/api/terms", tags=["refine"])


@router.post("/{term_id}/refine", response_model=RefineResponse)
async def refine(
    term_id: int,
    payload: RefineRequest,
    session: AsyncSession = Depends(get_session),
) -> RefineResponse:
    term = (
        await session.execute(
            select(Term)
            .options(selectinload(Term.definitions).selectinload(Definition.source))
            .where(Term.id == term_id)
        )
    ).scalar_one_or_none()

    if term is None:
        raise HTTPException(status_code=404, detail="Term not found")

    industry = (
        payload.industry_context.value
        if payload.industry_context is not None
        else term.industry_context.value
    )

    # Collect input definitions grouped by source slug (non-llm sources).
    sources: dict[str, list[str]] = {}
    for d in term.definitions:
        if d.source.slug == "llm":
            continue
        sources.setdefault(d.source.slug, []).append(d.text)

    if not sources:
        raise HTTPException(
            status_code=400,
            detail=(
                "Add at least one external definition first (try the Lookup button)."
            ),
        )

    result = await consolidate(
        term.term,
        sources,
        industry_context=industry,
        extra_prompt=payload.prompt,
    )
    if result is None:
        raise HTTPException(status_code=503, detail="Unable to consolidate at this time.")

    refinement = LLMRefinement(
        term_id=term.id,
        prompt=payload.prompt,
        text=result.text,
        model=result.model,
        industry_context=term.industry_context
        if payload.industry_context is None
        else payload.industry_context,
        source_slugs=",".join(result.sources_used),
        confidence=result.confidence,
    )
    session.add(refinement)
    await session.flush()

    definition_id = None
    if payload.apply:
        llm_source = (
            await session.execute(select(Source).where(Source.slug == "llm"))
        ).scalar_one_or_none()
        if llm_source is not None:
            defn = Definition(
                term_id=term.id,
                source_id=llm_source.id,
                text=result.text,
                is_consolidated=True,
                external_ref=None,
            )
            session.add(defn)
            await session.flush()
            definition_id = defn.id

    await audit.record(
        session,
        AuditKind.REFINED,
        f"Consolidated definition ({result.model}, confidence {result.confidence:.0%})",
        term_id=term.id,
        detail=result.text[:400],
    )
    await session.commit()

    return RefineResponse(
        term_id=term.id,
        model=result.model,
        text=result.text,
        sources_used=result.sources_used,
        confidence=result.confidence,
        refinement_id=refinement.id,
        definition_id=definition_id,
        llm_enabled=llm_enabled(),
    )
