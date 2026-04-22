"""Dictionary lookup adapters.

Phase 1 only uses the Free Dictionary API (no key required). The
Merriam-Webster adapter is scaffolded so we can plug in a key in Phase 2
without restructuring anything.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

FREE_DICT_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
DEFAULT_TIMEOUT = 6.0


@dataclass
class ExternalDefinition:
    """Source-agnostic shape returned by every adapter."""

    source_slug: str
    text: str
    part_of_speech: Optional[str] = None
    example: Optional[str] = None
    external_ref: Optional[str] = None


async def _fetch_free_dictionary(
    word: str, client: httpx.AsyncClient
) -> list[ExternalDefinition]:
    url = FREE_DICT_URL.format(word=word.lower().strip())
    try:
        resp = await client.get(url, timeout=DEFAULT_TIMEOUT)
    except httpx.HTTPError as exc:
        logger.warning("free_dictionary fetch failed for %s: %s", word, exc)
        return []

    if resp.status_code != 200:
        return []

    try:
        payload = resp.json()
    except ValueError:
        return []

    out: list[ExternalDefinition] = []
    if not isinstance(payload, list):
        return out

    for entry in payload:
        source_ref = None
        sources = entry.get("sourceUrls") or []
        if sources:
            source_ref = sources[0]
        for meaning in entry.get("meanings", []) or []:
            pos = meaning.get("partOfSpeech")
            for defn in meaning.get("definitions", []) or []:
                text = (defn.get("definition") or "").strip()
                if not text:
                    continue
                out.append(
                    ExternalDefinition(
                        source_slug="free-dictionary",
                        text=text,
                        part_of_speech=pos,
                        example=(defn.get("example") or None),
                        external_ref=source_ref,
                    )
                )
    return out


async def _fetch_merriam_webster(
    word: str, client: httpx.AsyncClient  # noqa: ARG001
) -> list[ExternalDefinition]:
    # Placeholder for Phase 2 — no API key configured.
    return []


SOURCE_ADAPTERS = {
    "free-dictionary": _fetch_free_dictionary,
    "merriam-webster": _fetch_merriam_webster,
}


async def lookup_word(
    word: str, sources: Optional[list[str]] = None
) -> dict[str, list[ExternalDefinition]]:
    """Fan out a lookup to every configured adapter concurrently."""

    chosen = sources or list(SOURCE_ADAPTERS.keys())
    results: dict[str, list[ExternalDefinition]] = {}

    async with httpx.AsyncClient() as client:
        tasks = {
            slug: asyncio.create_task(SOURCE_ADAPTERS[slug](word, client))
            for slug in chosen
            if slug in SOURCE_ADAPTERS
        }
        for slug, task in tasks.items():
            try:
                results[slug] = await task
            except Exception as exc:  # pragma: no cover - defensive
                logger.exception("adapter %s crashed for %s: %s", slug, word, exc)
                results[slug] = []

    return results
