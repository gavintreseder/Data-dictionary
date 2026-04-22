"""Heuristic + LLM definition extraction from PDFs.

Two extractors:
  - a fast regex pass that picks up explicit "X means ..." style patterns
  - an LLM pass (when OLLAMA_URL or HF_API_TOKEN is configured) that finds
    defined terms contextually, catching things the regex misses

The LLM pass is used first when available; regex results are merged in
to cover anything the LLM missed. If no LLM is configured we just use
the regex extractor.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Iterable, Optional

from app.services.llm_service import extract_terms as llm_extract_terms

logger = logging.getLogger(__name__)


@dataclass
class ExtractedTerm:
    term: str
    definition: str
    page: Optional[int] = None
    source: str = "regex"  # "regex" | "llm:<model>"


PATTERNS: list[re.Pattern[str]] = [
    re.compile(
        r'"(?P<term>[A-Z][A-Za-z0-9 \-–—]{1,60})"\s+(?:means|refers to|shall mean)\s+(?P<def>[^\n]{10,500}?[.;])',
        re.DOTALL,
    ),
    re.compile(
        r"\*\*(?P<term>[A-Z][A-Za-z0-9 \-–—]{1,60})\*\*\s*[—–\-:]+\s*(?P<def>[^\n]{10,500}?[.;])",
        re.DOTALL,
    ),
    re.compile(
        r"^(?P<term>[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\s*:\s+(?P<def>.{15,500}?[.;])",
        re.MULTILINE,
    ),
    re.compile(
        r"(?P<term>[A-Z][A-Za-z0-9 \-–—]{1,60})\s+is\s+defined\s+as\s+(?P<def>[^\n]{10,500}?[.;])",
    ),
]


_STOP_TERMS = {
    "The", "This", "These", "Note", "Example", "Figure", "Table",
    "Section", "Chapter", "Appendix", "Part", "Contents", "Page",
    "Annex", "Preface", "Introduction", "Background", "Abstract",
}


def _clean(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip()
    s = s.strip("‘’“”'\"")
    return s


def _dedupe(pairs: Iterable[ExtractedTerm]) -> list[ExtractedTerm]:
    seen: dict[str, ExtractedTerm] = {}
    for p in pairs:
        key = p.term.strip().lower()
        if not key:
            continue
        if key.split()[0] in {w.lower() for w in _STOP_TERMS}:
            continue
        existing = seen.get(key)
        if existing is None:
            seen[key] = p
            continue
        # Prefer LLM-sourced definitions; otherwise keep the longer one
        if existing.source == "regex" and p.source.startswith("llm"):
            seen[key] = p
        elif (
            existing.source.startswith("llm") == p.source.startswith("llm")
            and len(p.definition) > len(existing.definition)
        ):
            seen[key] = p
    return list(seen.values())


def _extract_regex(text: str) -> list[ExtractedTerm]:
    out: list[ExtractedTerm] = []
    for pattern in PATTERNS:
        for m in pattern.finditer(text):
            term = _clean(m.group("term"))
            defn = _clean(m.group("def"))
            if not term or not defn:
                continue
            if len(term) > 80 or len(defn) < 12:
                continue
            out.append(ExtractedTerm(term=term, definition=defn, source="regex"))
    return out


def _pdf_to_markdown(data: bytes) -> tuple[str, int]:
    """Returns (markdown_text, total_pages)."""
    try:
        import pymupdf  # type: ignore
        import pymupdf4llm  # type: ignore
    except ImportError:
        logger.warning("pymupdf / pymupdf4llm not installed; returning empty")
        return ("", 0)

    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        logger.exception("failed to open PDF: %s", exc)
        return ("", 0)

    total_pages = doc.page_count
    try:
        md = pymupdf4llm.to_markdown(doc)
    except Exception as exc:
        logger.warning("pymupdf4llm.to_markdown failed (%s); falling back to plain text", exc)
        md = "\n\n".join(page.get_text() for page in doc)
    finally:
        doc.close()

    return (md, total_pages)


async def extract_from_pdf_bytes_async(data: bytes) -> tuple[list[ExtractedTerm], int, str]:
    """Returns (terms, total_pages, extractor_label).

    extractor_label is "regex", "llm:<model>", or "llm+regex".
    """

    md, total_pages = _pdf_to_markdown(data)
    if not md:
        return ([], total_pages, "regex")

    # LLM pass (may be disabled)
    llm_pairs, llm_label = await llm_extract_terms(md)
    llm_terms = [
        ExtractedTerm(term=p.term, definition=p.definition, source=f"llm:{llm_label}")
        for p in llm_pairs
    ]

    # Regex pass (always — cheap, catches explicit patterns LLM may drop)
    regex_terms = _extract_regex(md)

    combined = _dedupe(llm_terms + regex_terms)

    if llm_terms and regex_terms:
        label = f"llm+regex ({llm_label})"
    elif llm_terms:
        label = f"llm ({llm_label})"
    else:
        label = "regex"

    return (combined, total_pages, label)


# Sync shim retained for any legacy callers; prefers the async path.
def extract_from_pdf_bytes(data: bytes) -> tuple[list[ExtractedTerm], int]:
    md, total_pages = _pdf_to_markdown(data)
    if not md:
        return ([], total_pages)
    return (_dedupe(_extract_regex(md)), total_pages)
