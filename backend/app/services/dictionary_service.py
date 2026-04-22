"""Dictionary lookup adapters with caching.

Every adapter returns a normalised list[ExternalDefinition] so the lookup
router doesn't need to know which source it's talking to.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Awaitable, Callable, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

FREE_DICT_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
WIKTIONARY_URL = "https://en.wiktionary.org/api/rest_v1/page/definition/{word}"
WIKIPEDIA_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/{word}"
USER_AGENT = "DataDictionaryDemo/0.1 (https://github.com/gavintreseder/data-dictionary)"

_STANDARDS_PATH = Path(__file__).parent.parent / "seed" / "standards_corpus.json"


@dataclass
class ExternalDefinition:
    source_slug: str
    text: str
    part_of_speech: Optional[str] = None
    example: Optional[str] = None
    external_ref: Optional[str] = None


# ---- In-memory cache (process-local) ----------------------------------------

_cache: dict[tuple[str, str], tuple[float, list[ExternalDefinition]]] = {}


def _cache_get(source: str, word: str) -> Optional[list[ExternalDefinition]]:
    key = (source, word.lower())
    entry = _cache.get(key)
    if not entry:
        return None
    expires, value = entry
    if time.time() > expires:
        _cache.pop(key, None)
        return None
    return value


def _cache_set(source: str, word: str, value: list[ExternalDefinition]) -> None:
    key = (source, word.lower())
    _cache[key] = (time.time() + settings.lookup_cache_ttl, value)


# ---- Adapters ---------------------------------------------------------------


async def _fetch_free_dictionary(
    word: str, client: httpx.AsyncClient
) -> list[ExternalDefinition]:
    cached = _cache_get("free-dictionary", word)
    if cached is not None:
        return cached

    out: list[ExternalDefinition] = []
    try:
        resp = await client.get(
            FREE_DICT_URL.format(word=word.lower().strip()),
            timeout=settings.lookup_source_timeout,
        )
    except httpx.HTTPError as exc:
        logger.warning("free_dictionary fetch failed for %s: %s", word, exc)
        return out

    if resp.status_code != 200:
        return out

    try:
        payload = resp.json()
    except ValueError:
        return out

    if not isinstance(payload, list):
        return out

    for entry in payload:
        sources = entry.get("sourceUrls") or []
        source_ref = sources[0] if sources else None
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

    _cache_set("free-dictionary", word, out)
    return out


_HTML_TAG = re.compile(r"<[^>]+>")


def _strip_html(s: str) -> str:
    return _HTML_TAG.sub("", s or "").strip()


async def _fetch_wiktionary(
    word: str, client: httpx.AsyncClient
) -> list[ExternalDefinition]:
    cached = _cache_get("wiktionary", word)
    if cached is not None:
        return cached

    out: list[ExternalDefinition] = []
    try:
        resp = await client.get(
            WIKTIONARY_URL.format(word=word.strip()),
            timeout=settings.lookup_source_timeout,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
    except httpx.HTTPError as exc:
        logger.warning("wiktionary fetch failed for %s: %s", word, exc)
        return out

    if resp.status_code != 200:
        return out

    try:
        payload = resp.json()
    except ValueError:
        return out

    for lang, entries in payload.items():
        if lang != "en":
            continue
        for entry in entries:
            pos = entry.get("partOfSpeech")
            for defn in entry.get("definitions", []) or []:
                text = _strip_html(defn.get("definition") or "")
                if not text:
                    continue
                examples_html = defn.get("examples") or []
                example = _strip_html(examples_html[0]) if examples_html else None
                out.append(
                    ExternalDefinition(
                        source_slug="wiktionary",
                        text=text,
                        part_of_speech=pos,
                        example=example,
                        external_ref=f"https://en.wiktionary.org/wiki/{word}",
                    )
                )

    _cache_set("wiktionary", word, out)
    return out


async def _fetch_wikipedia(
    word: str, client: httpx.AsyncClient
) -> list[ExternalDefinition]:
    cached = _cache_get("wikipedia", word)
    if cached is not None:
        return cached

    out: list[ExternalDefinition] = []
    try:
        resp = await client.get(
            WIKIPEDIA_SUMMARY_URL.format(word=word.strip().replace(" ", "_")),
            timeout=settings.lookup_source_timeout,
            headers={"User-Agent": USER_AGENT},
        )
    except httpx.HTTPError as exc:
        logger.warning("wikipedia fetch failed for %s: %s", word, exc)
        return out

    if resp.status_code != 200:
        return out

    try:
        payload = resp.json()
    except ValueError:
        return out

    extract = (payload.get("extract") or "").strip()
    if not extract:
        return out

    # Wikipedia summaries can be a few paragraphs; take the first sentence-ish
    # fragment so it fits the "definition" shape.
    first = re.split(r"(?<=[.!?])\s+", extract, maxsplit=1)[0]
    url = payload.get("content_urls", {}).get("desktop", {}).get("page")

    out.append(
        ExternalDefinition(
            source_slug="wikipedia",
            text=first,
            part_of_speech=None,
            example=None,
            external_ref=url,
        )
    )

    _cache_set("wikipedia", word, out)
    return out


async def _fetch_merriam_webster(
    word: str, client: httpx.AsyncClient  # noqa: ARG001
) -> list[ExternalDefinition]:
    # Reserved for a real MW API key; returns nothing by default.
    return []


# ---- Standards corpus (ISO/IEC-style local set) -----------------------------

_standards_corpus: Optional[dict[str, list[dict]]] = None


def _load_standards() -> dict[str, list[dict]]:
    global _standards_corpus
    if _standards_corpus is not None:
        return _standards_corpus
    if not _STANDARDS_PATH.exists():
        _standards_corpus = {}
        return _standards_corpus
    data = json.loads(_STANDARDS_PATH.read_text())
    _standards_corpus = {k.lower(): v for k, v in data.items()}
    return _standards_corpus


async def _fetch_standards(
    word: str, client: httpx.AsyncClient  # noqa: ARG001
) -> list[ExternalDefinition]:
    corpus = _load_standards()
    entries = corpus.get(word.lower().strip()) or []
    return [
        ExternalDefinition(
            source_slug="standards",
            text=e["text"],
            part_of_speech=e.get("part_of_speech"),
            external_ref=e.get("reference"),
        )
        for e in entries
    ]


SOURCE_ADAPTERS: dict[
    str, Callable[[str, httpx.AsyncClient], Awaitable[list[ExternalDefinition]]]
] = {
    "free-dictionary": _fetch_free_dictionary,
    "wiktionary": _fetch_wiktionary,
    "wikipedia": _fetch_wikipedia,
    "standards": _fetch_standards,
    "merriam-webster": _fetch_merriam_webster,
}


async def lookup_word(
    word: str, sources: Optional[list[str]] = None
) -> dict[str, list[ExternalDefinition]]:
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
            except Exception as exc:
                logger.exception("adapter %s crashed for %s: %s", slug, word, exc)
                results[slug] = []

    return results
