from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select

from app.config import settings
from app.database import get_session
from app.models.term import (
    AuditKind,
    Definition,
    ImportJob,
    ImportStatus,
    Source,
    Term,
)
from app.schemas.term import ImportPreviewRow, ImportResult, PDFExtraction
from app.seed.loader import slugify
from app.services import audit
from app.services.pdf_extractor import extract_from_pdf_bytes_async

router = APIRouter(prefix="/api", tags=["import-export"])


# ---- Helpers ----------------------------------------------------------------


async def _get_or_create_term(
    session: AsyncSession, name: str, category: Optional[str], summary: Optional[str]
) -> tuple[Term, bool]:
    slug = slugify(name)
    term = (
        await session.execute(select(Term).where(Term.slug == slug))
    ).scalar_one_or_none()
    if term is None:
        term = Term(term=name, slug=slug, category=category, summary=summary)
        session.add(term)
        await session.flush()
        return term, True
    if category and not term.category:
        term.category = category
    if summary and not term.summary:
        term.summary = summary
    return term, False


async def _get_source(session: AsyncSession, slug: str) -> Optional[Source]:
    return (
        await session.execute(select(Source).where(Source.slug == slug))
    ).scalar_one_or_none()


# ---- Import CSV -------------------------------------------------------------


@router.post("/import/csv", response_model=ImportResult)
async def import_csv(
    file: UploadFile = File(...),
    term_column: str = Form("term"),
    category_column: Optional[str] = Form("category"),
    summary_column: Optional[str] = Form("summary"),
    definition_column: Optional[str] = Form("definition"),
    source_slug: str = Form("business"),
    session: AsyncSession = Depends(get_session),
) -> ImportResult:
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(raw))
    if not reader.fieldnames or term_column not in reader.fieldnames:
        raise HTTPException(
            status_code=400,
            detail=(
                f"CSV must have a '{term_column}' column. "
                f"Found: {reader.fieldnames or []}"
            ),
        )

    source = await _get_source(session, source_slug)
    if source is None:
        source = await _get_source(session, "business")

    added_terms = 0
    added_defs = 0
    skipped = 0
    for row in reader:
        term_name = (row.get(term_column) or "").strip()
        if not term_name:
            skipped += 1
            continue
        category = (row.get(category_column) or "").strip() if category_column else None
        summary = (row.get(summary_column) or "").strip() if summary_column else None
        definition_text = (
            (row.get(definition_column) or "").strip() if definition_column else ""
        )

        term, created = await _get_or_create_term(session, term_name, category, summary)
        if created:
            added_terms += 1

        if definition_text and source is not None:
            existing = (
                await session.execute(
                    select(Definition.id).where(
                        Definition.term_id == term.id,
                        Definition.source_id == source.id,
                        Definition.text == definition_text,
                    )
                )
            ).first()
            if existing is None:
                session.add(
                    Definition(
                        term_id=term.id,
                        source_id=source.id,
                        text=definition_text,
                    )
                )
                added_defs += 1

    job = ImportJob(
        filename=file.filename or "upload.csv",
        kind="csv",
        status=ImportStatus.COMPLETE,
        terms_added=added_terms,
        definitions_added=added_defs,
        detail=f"skipped {skipped}",
        finished_at=datetime.now(timezone.utc),
    )
    session.add(job)
    await audit.record(
        session,
        AuditKind.IMPORTED,
        f"CSV import: +{added_terms} terms, +{added_defs} definitions",
    )
    await session.commit()

    return ImportResult(
        filename=file.filename or "upload.csv",
        kind="csv",
        terms_added=added_terms,
        definitions_added=added_defs,
        skipped=skipped,
        detail=None,
    )


# ---- Import JSON ------------------------------------------------------------


@router.post("/import/json", response_model=ImportResult)
async def import_json(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> ImportResult:
    raw = (await file.read()).decode("utf-8-sig", errors="replace")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}")

    if isinstance(payload, dict) and "terms" in payload:
        terms_data = payload.get("terms") or []
    elif isinstance(payload, list):
        terms_data = payload
    else:
        raise HTTPException(
            status_code=400,
            detail="JSON must be an array of terms or an object with a 'terms' array.",
        )

    added_terms = 0
    added_defs = 0
    skipped = 0
    for entry in terms_data:
        if not isinstance(entry, dict):
            skipped += 1
            continue
        name = (entry.get("term") or entry.get("name") or "").strip()
        if not name:
            skipped += 1
            continue
        category = entry.get("category")
        summary = entry.get("summary")
        term, created = await _get_or_create_term(session, name, category, summary)
        if created:
            added_terms += 1

        for defn in entry.get("definitions") or []:
            if isinstance(defn, str):
                text = defn.strip()
                source_slug = "business"
            elif isinstance(defn, dict):
                text = (defn.get("text") or "").strip()
                source_slug = defn.get("source") or "business"
            else:
                continue
            if not text:
                continue
            source = await _get_source(session, source_slug)
            if source is None:
                source = await _get_source(session, "business")
            if source is None:
                continue
            existing = (
                await session.execute(
                    select(Definition.id).where(
                        Definition.term_id == term.id,
                        Definition.source_id == source.id,
                        Definition.text == text,
                    )
                )
            ).first()
            if existing is None:
                session.add(
                    Definition(term_id=term.id, source_id=source.id, text=text)
                )
                added_defs += 1

    session.add(
        ImportJob(
            filename=file.filename or "upload.json",
            kind="json",
            status=ImportStatus.COMPLETE,
            terms_added=added_terms,
            definitions_added=added_defs,
            finished_at=datetime.now(timezone.utc),
        )
    )
    await audit.record(
        session,
        AuditKind.IMPORTED,
        f"JSON import: +{added_terms} terms, +{added_defs} definitions",
    )
    await session.commit()

    return ImportResult(
        filename=file.filename or "upload.json",
        kind="json",
        terms_added=added_terms,
        definitions_added=added_defs,
        skipped=skipped,
    )


# ---- PDF extraction + import ------------------------------------------------


@router.post("/import/pdf/preview", response_model=PDFExtraction)
async def preview_pdf(
    file: UploadFile = File(...),
) -> PDFExtraction:
    data = await file.read()
    if len(data) > settings.pdf_max_bytes:
        raise HTTPException(status_code=413, detail="PDF too large")
    terms, total_pages, extractor, llm_errors = await extract_from_pdf_bytes_async(data)
    return PDFExtraction(
        filename=file.filename or "upload.pdf",
        total_pages=total_pages,
        extracted_terms=len(terms),
        extractor=extractor,
        llm_errors=llm_errors[:3],  # cap for size
        preview=[
            ImportPreviewRow(term=t.term, definition=t.definition, source_slug="pdf")
            for t in terms[:100]
        ],
    )


@router.post("/import/pdf", response_model=ImportResult)
async def import_pdf(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> ImportResult:
    data = await file.read()
    if len(data) > settings.pdf_max_bytes:
        raise HTTPException(status_code=413, detail="PDF too large")

    terms, total_pages, extractor, _ = await extract_from_pdf_bytes_async(data)

    pdf_source = await _get_source(session, "pdf")
    if pdf_source is None:
        raise HTTPException(status_code=500, detail="PDF source missing in database")

    added_terms = 0
    added_defs = 0
    for t in terms:
        term, created = await _get_or_create_term(session, t.term, None, None)
        if created:
            added_terms += 1
        existing = (
            await session.execute(
                select(Definition.id).where(
                    Definition.term_id == term.id,
                    Definition.source_id == pdf_source.id,
                    Definition.text == t.definition,
                )
            )
        ).first()
        if existing is None:
            session.add(
                Definition(
                    term_id=term.id,
                    source_id=pdf_source.id,
                    text=t.definition,
                    external_ref=file.filename or "uploaded.pdf",
                )
            )
            added_defs += 1

    session.add(
        ImportJob(
            filename=file.filename or "upload.pdf",
            kind="pdf",
            status=ImportStatus.COMPLETE,
            terms_added=added_terms,
            definitions_added=added_defs,
            detail=f"{total_pages} pages, {len(terms)} extracted via {extractor}",
            finished_at=datetime.now(timezone.utc),
        )
    )
    await audit.record(
        session,
        AuditKind.IMPORTED,
        f"PDF import: {file.filename} → +{added_terms} terms, +{added_defs} definitions ({extractor})",
    )
    await session.commit()

    return ImportResult(
        filename=file.filename or "upload.pdf",
        kind="pdf",
        terms_added=added_terms,
        definitions_added=added_defs,
        skipped=max(0, len(terms) - added_defs),
        detail=f"{total_pages} pages scanned via {extractor}",
    )


# ---- Export -----------------------------------------------------------------


async def _all_terms(session: AsyncSession) -> list[Term]:
    result = await session.execute(
        select(Term)
        .options(
            selectinload(Term.definitions).selectinload(Definition.source),
            selectinload(Term.tags),
        )
        .order_by(Term.term.asc())
    )
    return list(result.scalars().unique().all())


@router.get("/export")
async def export_terms(
    format: str = Query("json", pattern="^(json|csv|md)$"),
    session: AsyncSession = Depends(get_session),
):
    terms = await _all_terms(session)

    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            ["term", "category", "summary", "flag", "tags", "source", "definition"]
        )
        for t in terms:
            tag_str = ",".join(tag.name for tag in t.tags)
            if not t.definitions:
                writer.writerow(
                    [t.term, t.category or "", t.summary or "", t.flag.value, tag_str, "", ""]
                )
                continue
            for d in t.definitions:
                writer.writerow(
                    [
                        t.term,
                        t.category or "",
                        t.summary or "",
                        t.flag.value,
                        tag_str,
                        d.source.slug,
                        d.text,
                    ]
                )
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="dictionary.csv"'},
        )

    if format == "md":
        lines = ["# Data Dictionary\n"]
        for t in terms:
            lines.append(f"## {t.term}\n")
            meta = []
            if t.category:
                meta.append(f"_Category:_ {t.category}")
            if t.tags:
                meta.append("_Tags:_ " + ", ".join(tag.name for tag in t.tags))
            meta.append(f"_Flag:_ {t.flag.value}")
            lines.append(" · ".join(meta) + "\n")
            if t.summary:
                lines.append(f"{t.summary}\n")
            for d in t.definitions:
                lines.append(f"- **[{d.source.name}]** {d.text}")
            lines.append("")
        body = "\n".join(lines)
        return StreamingResponse(
            iter([body]),
            media_type="text/markdown",
            headers={"Content-Disposition": 'attachment; filename="dictionary.md"'},
        )

    # json
    payload = {
        "terms": [
            {
                "term": t.term,
                "slug": t.slug,
                "category": t.category,
                "summary": t.summary,
                "flag": t.flag.value,
                "industry_context": t.industry_context.value,
                "tags": [tag.name for tag in t.tags],
                "definitions": [
                    {
                        "source": d.source.slug,
                        "text": d.text,
                        "part_of_speech": d.part_of_speech,
                        "example": d.example,
                        "external_ref": d.external_ref,
                        "is_consolidated": d.is_consolidated,
                    }
                    for d in t.definitions
                ],
            }
            for t in terms
        ]
    }
    return StreamingResponse(
        iter([json.dumps(payload, indent=2, default=str)]),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="dictionary.json"'},
    )
