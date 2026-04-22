"""Heuristic definition extraction from PDFs.

Uses pymupdf4llm to get markdown, then looks for common "defined term"
patterns to pull out (term → definition) pairs.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Iterable, Optional

logger = logging.getLogger(__name__)


@dataclass
class ExtractedTerm:
    term: str
    definition: str
    page: Optional[int] = None


# Patterns ordered by specificity.
PATTERNS: list[re.Pattern[str]] = [
    # "Term" means the ...
    re.compile(
        r'"(?P<term>[A-Z][A-Za-z0-9 \-–—]{1,60})"\s+(?:means|refers to|shall mean)\s+(?P<def>[^\n]{10,500}?[.;])',
        re.DOTALL,
    ),
    # **Term** — definition
    re.compile(
        r"\*\*(?P<term>[A-Z][A-Za-z0-9 \-–—]{1,60})\*\*\s*[—–\-:]+\s*(?P<def>[^\n]{10,500}?[.;])",
        re.DOTALL,
    ),
    # Term: definition (line-anchored, term Title Case <=4 words)
    re.compile(
        r"^(?P<term>[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})\s*:\s+(?P<def>.{15,500}?[.;])",
        re.MULTILINE,
    ),
    # Term is defined as ...
    re.compile(
        r"(?P<term>[A-Z][A-Za-z0-9 \-–—]{1,60})\s+is\s+defined\s+as\s+(?P<def>[^\n]{10,500}?[.;])",
    ),
]


_STOP_TERMS = {
    "The",
    "This",
    "These",
    "Note",
    "Example",
    "Figure",
    "Table",
    "Section",
    "Chapter",
    "Appendix",
    "Part",
    "Contents",
    "Page",
    "Annex",
    "Preface",
    "Introduction",
    "Background",
    "Abstract",
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
        if key not in seen:
            seen[key] = p
    return list(seen.values())


def _extract_from_text(text: str) -> list[ExtractedTerm]:
    out: list[ExtractedTerm] = []
    for pattern in PATTERNS:
        for m in pattern.finditer(text):
            term = _clean(m.group("term"))
            defn = _clean(m.group("def"))
            if not term or not defn:
                continue
            if len(term) > 80 or len(defn) < 12:
                continue
            out.append(ExtractedTerm(term=term, definition=defn))
    return _dedupe(out)


def extract_from_pdf_bytes(data: bytes) -> tuple[list[ExtractedTerm], int]:
    """Returns (terms, total_pages)."""

    # Try pymupdf4llm first (markdown-aware extraction).
    try:
        import pymupdf  # type: ignore
        import pymupdf4llm  # type: ignore
    except ImportError:
        logger.warning("pymupdf / pymupdf4llm not installed; returning empty extraction")
        return ([], 0)

    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        logger.exception("failed to open PDF: %s", exc)
        return ([], 0)

    total_pages = doc.page_count
    try:
        md = pymupdf4llm.to_markdown(doc)
    except Exception as exc:
        logger.warning("pymupdf4llm.to_markdown failed (%s); falling back to plain text", exc)
        md = "\n\n".join(page.get_text() for page in doc)
    finally:
        doc.close()

    return (_extract_from_text(md), total_pages)
