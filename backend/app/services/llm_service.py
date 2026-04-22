"""Open-source LLM consolidation + extraction.

Three backends are supported; whichever is configured (preference order
Groq → Ollama → Hugging Face) will handle each call:

  - **Groq** — `GROQ_API_KEY`. Free tier is generous and very fast.
  - **Ollama** — `OLLAMA_URL`, e.g. `http://host.docker.internal:11434`.
  - **Hugging Face Inference Providers** — `HF_API_TOKEN`. Uses the newer
    `router.huggingface.co/<provider>/v1/chat/completions` endpoint
    (the old `api-inference.huggingface.co/models/<model>` path has been
    partially deprecated for free-tier instruct models).

When none is configured, `consolidate()` returns a heuristic best-guess
and `extract_terms()` returns an empty list so the caller can fall
back to regex.
"""

from __future__ import annotations

import difflib
import json
import logging
import re
from dataclasses import dataclass, field
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


@dataclass
class CallOutcome:
    """Tracks one LLM call so failures can be surfaced to the caller."""

    text: Optional[str] = None
    model: str = ""
    errors: list[str] = field(default_factory=list)


def _agreement_score(texts: list[str]) -> float:
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


# ---- Provider calls (OpenAI-compatible where possible) ---------------------


async def _call_openai_compat(
    *,
    base_url: str,
    api_key: str,
    model: str,
    system: str,
    user: str,
    max_tokens: int,
    json_mode: bool = False,
    timeout: float,
    label: str,
) -> tuple[Optional[str], Optional[str]]:
    """Generic OpenAI-compatible chat-completions POST.

    Returns (text, error). If both are None, the call wasn't configured.
    """

    url = base_url.rstrip("/") + "/v1/chat/completions"
    payload: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.1,
        "max_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        msg = f"{label} network error: {exc.__class__.__name__}: {exc}"
        logger.warning(msg)
        return (None, msg)

    if resp.status_code != 200:
        msg = f"{label} HTTP {resp.status_code}: {resp.text[:300]}"
        logger.warning(msg)
        return (None, msg)

    try:
        data = resp.json()
    except ValueError:
        msg = f"{label} non-JSON response"
        logger.warning(msg)
        return (None, msg)

    try:
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        msg = f"{label} unexpected body: {str(data)[:300]}"
        logger.warning(msg)
        return (None, msg)

    if not text or not text.strip():
        return (None, f"{label} returned empty content")

    return (text.strip(), None)


async def _call_ollama(system: str, user: str, *, json_mode: bool, max_tokens: int) -> tuple[Optional[str], Optional[str]]:
    if not settings.ollama_url:
        return (None, None)
    url = settings.ollama_url.rstrip("/") + "/api/generate"
    payload: dict = {
        "model": settings.ollama_model,
        "system": system,
        "prompt": user,
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": max_tokens},
    }
    if json_mode:
        payload["format"] = "json"
    try:
        async with httpx.AsyncClient(timeout=settings.llm_timeout * 2) as client:
            resp = await client.post(url, json=payload)
    except httpx.HTTPError as exc:
        msg = f"ollama network error: {exc}"
        logger.warning(msg)
        return (None, msg)
    if resp.status_code != 200:
        msg = f"ollama HTTP {resp.status_code}: {resp.text[:300]}"
        logger.warning(msg)
        return (None, msg)
    try:
        data = resp.json()
    except ValueError:
        return (None, "ollama non-JSON response")
    text = (data.get("response") or "").strip()
    return (text if text else None, None if text else "ollama empty response")


async def _call_groq(system: str, user: str, *, json_mode: bool, max_tokens: int) -> tuple[Optional[str], Optional[str]]:
    if not settings.groq_api_key:
        return (None, None)
    return await _call_openai_compat(
        base_url="https://api.groq.com/openai",
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        system=system,
        user=user,
        max_tokens=max_tokens,
        json_mode=json_mode,
        timeout=settings.llm_timeout,
        label=f"groq:{settings.groq_model}",
    )


async def _call_hf(system: str, user: str, *, json_mode: bool, max_tokens: int) -> tuple[Optional[str], Optional[str]]:
    """Hugging Face Inference Providers (router) — OpenAI-compatible."""

    if not settings.hf_api_token:
        return (None, None)
    # router.huggingface.co/<provider>/models/<model>/v1/chat/completions
    base = (
        f"https://router.huggingface.co/{settings.hf_provider}/models/"
        f"{settings.hf_model}"
    )
    return await _call_openai_compat(
        base_url=base,
        api_key=settings.hf_api_token,
        model=settings.hf_model,
        system=system,
        user=user,
        max_tokens=max_tokens,
        json_mode=False,  # not every HF provider accepts response_format
        timeout=settings.llm_timeout * 2,
        label=f"hf:{settings.hf_model}",
    )


async def _invoke(
    *, system: str, user: str, json_mode: bool, max_tokens: int
) -> CallOutcome:
    """Try Groq → Ollama → HF in order. Record failures as we go."""

    outcome = CallOutcome()

    for label, model, caller in (
        ("groq", settings.groq_model, _call_groq),
        ("ollama", settings.ollama_model, _call_ollama),
        ("hf", settings.hf_model, _call_hf),
    ):
        text, err = await caller(
            system, user, json_mode=json_mode, max_tokens=max_tokens
        )
        if text:
            outcome.text = text
            outcome.model = f"{label}:{model}"
            return outcome
        if err:
            outcome.errors.append(err)

    return outcome


# ---- Consolidation (used by the Refine box) --------------------------------


def _heuristic_consolidate(
    term: str, sources: dict[str, list[str]]
) -> Optional[str]:
    flat: list[tuple[str, str]] = []
    for slug, defs in sources.items():
        for d in defs[:3]:
            if d:
                flat.append((slug, d.strip()))
    if not flat:
        return None

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
        scored.append((score, -len(text), text))
    scored.sort(reverse=True)
    return scored[0][2]


def _clean_llm_output(text: str, term: str) -> str:
    text = re.sub(r"^\s*[-*•]\s*", "", text).strip()
    lower_term = term.lower()
    if text.lower().startswith(lower_term):
        stripped = text[len(term) :].lstrip(" ,:-—")
        if stripped:
            text = stripped[0].upper() + stripped[1:]
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
        outcome = await _invoke(
            system=SYSTEM_PROMPT,
            user=user_prompt,
            json_mode=False,
            max_tokens=200,
        )
        if outcome.text:
            text = _clean_llm_output(outcome.text, term)
            conf = min(1.0, 0.4 + 0.6 * agreement)
            return LLMResult(
                text=text, model=outcome.model, confidence=conf, sources_used=used
            )

    pick = _heuristic_consolidate(term, sources)
    if not pick:
        return None
    return LLMResult(
        text=pick,
        model="heuristic",
        confidence=max(0.15, min(0.55, agreement)),
        sources_used=used,
    )


# ---- Term extraction for PDFs ----------------------------------------------


_CHUNK_CHARS = 6000
_CHUNK_OVERLAP = 400


def _chunk_text(text: str) -> list[str]:
    text = text.strip()
    if len(text) <= _CHUNK_CHARS:
        return [text] if text else []

    chunks: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        end = min(n, i + _CHUNK_CHARS)
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
    if not text:
        return []
    fenced = re.search(r"```(?:json)?\s*(\[[\s\S]*?\])\s*```", text)
    if fenced:
        text = fenced.group(1)

    # If we got an object {terms: [...]} wrapping the array, unwrap it
    fenced_obj = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if fenced_obj and "[" not in text:
        text = fenced_obj.group(1)

    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end > start:
        candidate = text[start : end + 1]
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            repaired = re.sub(r",(\s*[\]}])", r"\1", candidate)
            try:
                data = json.loads(repaired)
            except json.JSONDecodeError:
                data = []
        if isinstance(data, list):
            return data

    # Try parsing a whole JSON object with {"terms": [...]}
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        try:
            obj = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return []
        if isinstance(obj, dict):
            for key in ("terms", "items", "definitions", "results"):
                arr = obj.get(key)
                if isinstance(arr, list):
                    return arr

    return []


def _dedupe_pairs(pairs: list[ExtractedPair]) -> list[ExtractedPair]:
    seen: dict[str, ExtractedPair] = {}
    for p in pairs:
        key = p.term.strip().lower()
        if not key or len(key) > 80:
            continue
        if len(p.definition.strip()) < 8:
            continue
        if key in seen:
            if len(p.definition) > len(seen[key].definition):
                seen[key] = p
        else:
            seen[key] = p
    return list(seen.values())


async def extract_terms(
    text: str,
) -> tuple[list[ExtractedPair], str, list[str]]:
    """Extract (term, definition) pairs using an LLM.

    Returns (pairs, model_label, errors). When no LLM is configured,
    returns ([], "disabled", []).
    """

    if not text.strip():
        return ([], "disabled", [])
    if not llm_enabled():
        return ([], "disabled", [])

    chunks = _chunk_text(text)
    all_pairs: list[ExtractedPair] = []
    model_label = ""
    all_errors: list[str] = []

    for idx, chunk in enumerate(chunks):
        user_prompt = (
            "Extract every defined term and its definition from the passage "
            "below. Return JSON only — an array like "
            "[{\"term\":\"...\",\"definition\":\"...\"}, ...].\n\n"
            f"Passage (chunk {idx + 1} of {len(chunks)}):\n{chunk}"
        )
        outcome = await _invoke(
            system=EXTRACT_SYSTEM_PROMPT,
            user=user_prompt,
            json_mode=True,
            max_tokens=1400,
        )
        if outcome.errors:
            all_errors.extend(outcome.errors)
        if not outcome.text:
            continue

        model_label = outcome.model
        for item in _extract_json_array(outcome.text):
            if not isinstance(item, dict):
                continue
            term = str(item.get("term") or item.get("name") or "").strip()
            defn = str(item.get("definition") or item.get("def") or "").strip()
            if term and defn:
                all_pairs.append(ExtractedPair(term=term, definition=defn))

    return (_dedupe_pairs(all_pairs), model_label or "llm", all_errors)
