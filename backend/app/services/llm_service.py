"""Open-source LLM consolidation.

Two backends are supported; whichever has credentials configured will be used:
  - **Ollama** — local inference via OLLAMA_URL (e.g. http://host.docker.internal:11434)
  - **HuggingFace Inference API** — via HF_API_TOKEN

When neither is configured, `consolidate()` returns a heuristic best-guess
assembled from the source material so the UI still has something useful to
show (marked with confidence < 0.5 and model="heuristic").
"""

from __future__ import annotations

import difflib
import json
import logging
import re
from dataclasses import dataclass
from typing import Optional

import httpx

from app.config import llm_enabled, settings

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "You are a precise glossary editor. Produce ONE concise definition (max "
    "40 words) that reflects industry consensus for the given term. Write in "
    "plain, neutral English. Do not start with the term itself. Return only "
    "the definition — no preamble, no bullets, no quotation marks."
)


EXTRACT_SYSTEM_PROMPT = (
    "You are extracting defined terms from a business document. Identify "
    "terms that are explicitly defined in the passage: formal definitions, "
    "acronym expansions, or terminology with clear explanations given in "
    "the text. Do not invent definitions that aren't there. Return STRICT "
    "JSON — an array of objects with exactly two fields: `term` (1–6 words) "
    "and `definition` (1–2 sentences from the passage, lightly cleaned). "
    "Example: [{\"term\": \"Material Risk\", \"definition\": \"A risk that "
    "could affect achievement of strategic objectives.\"}]. No preamble, "
    "no trailing prose, no code fences."
)


@dataclass
class LLMResult:
    text: str
    model: str
    confidence: float
    sources_used: list[str]


@dataclass
class ExtractedPair:
    term: str
    definition: str


def _agreement_score(texts: list[str]) -> float:
    """Compute a rough agreement score based on pairwise similarity."""

    if len(texts) < 2:
        return 0.5 if texts else 0.0
    ratios: list[float] = []
    for i in range(len(texts)):
        for j in range(i + 1, len(texts)):
            ratios.append(
                difflib.SequenceMatcher(None, texts[i], texts[j]).ratio()
            )
    if not ratios:
        return 0.5
    return max(0.0, min(1.0, sum(ratios) / len(ratios)))


def _build_user_prompt(
    term: str,
    sources: dict[str, list[str]],
    industry_context: str,
    extra_prompt: Optional[str],
) -> str:
    lines = [f"Term: {term}", f"Industry context: {industry_context}"]
    if extra_prompt:
        lines.append(f"Additional guidance from the user: {extra_prompt}")
    lines.append("")
    lines.append("Existing definitions:")
    for slug, defs in sources.items():
        if not defs:
            continue
        lines.append(f"[{slug}]")
        for d in defs[:3]:
            lines.append(f"  - {d}")
    lines.append("")
    lines.append(
        "Write one definition that best represents the industry-standard "
        "meaning, tuned for the industry context above."
    )
    return "\n".join(lines)


async def _call_ollama(user_prompt: str) -> Optional[str]:
    if not settings.ollama_url:
        return None
    url = settings.ollama_url.rstrip("/") + "/api/generate"
    payload = {
        "model": settings.ollama_model,
        "system": SYSTEM_PROMPT,
        "prompt": user_prompt,
        "stream": False,
        "options": {"temperature": 0.2, "num_predict": 160},
    }
    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout) as client:
            resp = await client.post(url, json=payload)
    except httpx.HTTPError as exc:
        logger.warning("ollama call failed: %s", exc)
        return None
    if resp.status_code != 200:
        logger.warning("ollama returned %s: %s", resp.status_code, resp.text[:200])
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    return (data.get("response") or "").strip()


async def _call_hf(user_prompt: str) -> Optional[str]:
    if not settings.hf_api_token:
        return None
    url = f"https://api-inference.huggingface.co/models/{settings.hf_model}"
    headers = {
        "Authorization": f"Bearer {settings.hf_api_token}",
        "Content-Type": "application/json",
    }
    full_prompt = f"<s>[INST] {SYSTEM_PROMPT}\n\n{user_prompt} [/INST]"
    payload = {
        "inputs": full_prompt,
        "parameters": {
            "max_new_tokens": 160,
            "temperature": 0.2,
            "return_full_text": False,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("huggingface call failed: %s", exc)
        return None
    if resp.status_code != 200:
        logger.warning("huggingface returned %s: %s", resp.status_code, resp.text[:200])
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    if isinstance(data, list) and data:
        return (data[0].get("generated_text") or "").strip()
    if isinstance(data, dict):
        return (data.get("generated_text") or "").strip()
    return None


def _heuristic_consolidate(
    term: str, sources: dict[str, list[str]]
) -> Optional[str]:
    """Fallback when no LLM is configured.

    Picks the shortest definition that still contains the most common content
    words across sources — a crude consensus pick.
    """

    flat: list[tuple[str, str]] = []
    for slug, defs in sources.items():
        for d in defs[:3]:
            if d:
                flat.append((slug, d.strip()))
    if not flat:
        return None

    # score each candidate by token overlap with the others
    def tokens(text: str) -> set[str]:
        return {t.lower() for t in re.findall(r"[A-Za-z]{4,}", text)}

    scored = []
    for idx, (_, text) in enumerate(flat):
        mine = tokens(text)
        score = 0
        for jdx, (_, other) in enumerate(flat):
            if idx == jdx:
                continue
            score += len(mine & tokens(other))
        # shorter text tiebreaker
        scored.append((score, -len(text), text))
    scored.sort(reverse=True)
    return scored[0][2]


def _clean_llm_output(text: str, term: str) -> str:
    text = re.sub(r"^\s*[-*•]\s*", "", text).strip()
    # Trim the term if it starts the output ("X is ...")
    stripped = text
    lower_term = term.lower()
    if stripped.lower().startswith(lower_term):
        stripped = stripped[len(term) :].lstrip(" ,:-—")
        if stripped:
            stripped = stripped[0].upper() + stripped[1:]
            text = stripped
    # first sentence only for very long outputs
    parts = re.split(r"(?<=[.!?])\s+", text)
    if len(parts) > 3:
        text = " ".join(parts[:2])
    return text.strip().strip('"')


async def consolidate(
    term: str,
    sources: dict[str, list[str]],
    industry_context: str = "generic",
    extra_prompt: Optional[str] = None,
) -> Optional[LLMResult]:
    used = [s for s, defs in sources.items() if defs]
    if not used:
        return None

    all_texts: list[str] = []
    for defs in sources.values():
        all_texts.extend(defs[:3])
    agreement = _agreement_score(all_texts)

    user_prompt = _build_user_prompt(term, sources, industry_context, extra_prompt)

    if llm_enabled():
        text = await _call_ollama(user_prompt)
        model = f"ollama:{settings.ollama_model}" if text else ""
        if not text:
            text = await _call_hf(user_prompt)
            model = f"hf:{settings.hf_model}" if text else ""
        if text:
            text = _clean_llm_output(text, term)
            # slightly boost confidence when an LLM produced it
            conf = min(1.0, 0.4 + 0.6 * agreement)
            return LLMResult(
                text=text, model=model, confidence=conf, sources_used=used
            )

    # Fallback — heuristic consensus
    pick = _heuristic_consolidate(term, sources)
    if not pick:
        return None
    return LLMResult(
        text=pick,
        model="heuristic",
        confidence=max(0.15, min(0.55, agreement)),
        sources_used=used,
    )


# ---------- Term extraction from free-text (used by PDF import) -------------

_CHUNK_CHARS = 6000
_CHUNK_OVERLAP = 400


def _chunk_text(text: str) -> list[str]:
    """Split on paragraph boundaries up to ~6k chars, with a small overlap.

    Overlap avoids cutting a definition across chunks.
    """
    text = text.strip()
    if len(text) <= _CHUNK_CHARS:
        return [text] if text else []

    chunks: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        end = min(n, i + _CHUNK_CHARS)
        # try to extend to the next paragraph break for a cleaner split
        if end < n:
            nl = text.rfind("\n\n", i + int(_CHUNK_CHARS * 0.7), end)
            if nl != -1:
                end = nl
        chunks.append(text[i:end])
        if end == n:
            break
        i = max(end - _CHUNK_OVERLAP, i + 1)
    return chunks


def _extract_json_array(text: str) -> list[dict]:
    """Pull the first JSON array out of an LLM response, tolerating preamble
    and code fences."""

    if not text:
        return []
    # strip ``` fences
    fenced = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", text)
    if fenced:
        text = fenced.group(1)
    # or first top-level [...]
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return []
    candidate = text[start : end + 1]
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError:
        # try a trailing-comma repair
        repaired = re.sub(r",(\s*[\]}])", r"\1", candidate)
        try:
            data = json.loads(repaired)
        except json.JSONDecodeError:
            return []
    return data if isinstance(data, list) else []


async def _call_ollama_extract(user_prompt: str) -> Optional[str]:
    if not settings.ollama_url:
        return None
    url = settings.ollama_url.rstrip("/") + "/api/generate"
    payload = {
        "model": settings.ollama_model,
        "system": EXTRACT_SYSTEM_PROMPT,
        "prompt": user_prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.1, "num_predict": 1400},
    }
    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout * 2) as client:
            resp = await client.post(url, json=payload)
    except httpx.HTTPError as exc:
        logger.warning("ollama extract failed: %s", exc)
        return None
    if resp.status_code != 200:
        logger.warning("ollama extract returned %s: %s", resp.status_code, resp.text[:200])
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    return (data.get("response") or "").strip()


async def _call_hf_extract(user_prompt: str) -> Optional[str]:
    if not settings.hf_api_token:
        return None
    url = f"https://api-inference.huggingface.co/models/{settings.hf_model}"
    headers = {
        "Authorization": f"Bearer {settings.hf_api_token}",
        "Content-Type": "application/json",
    }
    full_prompt = (
        f"<s>[INST] {EXTRACT_SYSTEM_PROMPT}\n\n{user_prompt} [/INST]"
    )
    payload = {
        "inputs": full_prompt,
        "parameters": {
            "max_new_tokens": 1200,
            "temperature": 0.1,
            "return_full_text": False,
        },
        "options": {"wait_for_model": True},
    }
    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout * 2) as client:
            resp = await client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        logger.warning("hf extract failed: %s", exc)
        return None
    if resp.status_code != 200:
        logger.warning("hf extract returned %s: %s", resp.status_code, resp.text[:200])
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    if isinstance(data, list) and data:
        return (data[0].get("generated_text") or "").strip()
    if isinstance(data, dict):
        return (data.get("generated_text") or "").strip()
    return None


def _dedupe_pairs(pairs: list[ExtractedPair]) -> list[ExtractedPair]:
    seen: dict[str, ExtractedPair] = {}
    for p in pairs:
        key = p.term.strip().lower()
        if not key or len(key) > 80:
            continue
        if len(p.definition.strip()) < 8:
            continue
        if key in seen:
            # keep the longer definition
            if len(p.definition) > len(seen[key].definition):
                seen[key] = p
        else:
            seen[key] = p
    return list(seen.values())


async def extract_terms(text: str) -> tuple[list[ExtractedPair], str]:
    """Extract (term, definition) pairs from free text using an LLM.

    Returns (pairs, model_label). When no LLM is configured, returns
    ([], "disabled") so the caller can fall back to a regex pass.
    """

    if not llm_enabled() or not text.strip():
        return ([], "disabled")

    chunks = _chunk_text(text)
    all_pairs: list[ExtractedPair] = []
    model_label = ""

    for chunk in chunks:
        user_prompt = (
            "Extract every defined term and its definition from the passage "
            "below. Return JSON only.\n\nPassage:\n" + chunk
        )

        raw = await _call_ollama_extract(user_prompt)
        if raw:
            model_label = f"ollama:{settings.ollama_model}"
        else:
            raw = await _call_hf_extract(user_prompt)
            if raw:
                model_label = f"hf:{settings.hf_model}"

        if not raw:
            continue

        for item in _extract_json_array(raw):
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or item.get("name") or "").strip()
            defn = str(item.get("definition") or item.get("def") or "").strip()
            if term and defn:
                all_pairs.append(ExtractedPair(term=term, definition=defn))

    return (_dedupe_pairs(all_pairs), model_label or "llm")
