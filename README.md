# Data Dictionary

A polished, demo-quality web app for building a business data dictionary.
Search terms across multiple sources (Free Dictionary, Wiktionary, Wikipedia,
ISO/IEC-style Standards, custom in-house entries), consolidate them with an
open-source LLM (or a built-in heuristic fallback), flag and tag them for
review, import from CSV/JSON/PDF, and export everything back out.

![Phases](https://img.shields.io/badge/phases-1--4-green) ![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20Next.js-blue)

## Feature tour

- **Multi-source lookup** — fan out to Free Dictionary, Wiktionary, Wikipedia,
  Merriam-Webster (key required), and a curated Standards corpus, in parallel
  with per-source caching and timeouts.
- **LLM consolidation** — plug in **Ollama** (`OLLAMA_URL`) or the
  **HuggingFace Inference API** (`HF_API_TOKEN`) and every term gets an
  industry-aware "consensus" definition with a confidence score and the list
  of sources that fed it. Without a key it falls back to a source-agreement
  heuristic so the feature still works.
- **Refinement prompts** — nudge the LLM per-term with free-text guidance
  ("emphasise measurability", "align with ISO 31000").
- **Industry context** — tag each term with finance / healthcare /
  engineering / legal / public-sector / general and the LLM prompt adapts.
- **Flag workflow** — `none` / `needs_review` / `approved` / `disputed` /
  `archived` with dot indicators, bulk actions, and optimistic updates.
- **Tags** — flexible many-to-many with a dedicated `/tags` page and
  facet filtering on the terms index.
- **Import** — CSV (with column-mapping UI), JSON (round-trips with the
  export), and PDF (via PyMuPDF4LLM + regex heuristics that pick up
  "*X* means ...", "**X** — ...", "X: ..." and similar patterns).
- **Export** — CSV, JSON, Markdown glossary from one endpoint.
- **Full-text-ish search** — LIKE-backed search across terms, summaries and
  definitions, returns ranked hits with snippet highlighting.
- **Shareable read-only links** — every term has a clean `/t/<slug>` URL
  (with OpenGraph-ready markup) plus an in-app "copy share link" button.
- **Audit log** — every create / update / flag change / refine / import
  lands in an append-only log, shown both per-term and globally on the
  dashboard.
- **Command palette** — `⌘K` (or `Ctrl-K`) opens a Linear-style palette with
  navigation, theme switching and live term search.
- **Keyboard shortcuts** — `/` focuses search, `g d` → dashboard, `g t` →
  terms, `g s` → search, `g i` → import.
- **Guided tour** — a first-time visitor gets a 4-step spotlight tour
  walking through the key flows. Skippable, remembered via `localStorage`.
- **Demo mode** — a one-click reset button in the header wipes custom data
  and re-seeds, so the demo is always ready for the next pitch.
- **Polish** — dark mode, Framer Motion page transitions, animated numbers
  on stat cards, skeleton loaders, toast notifications on every mutation,
  optimistic flag updates, color-coded source badges, a consistent sidebar
  with a command-tip panel.

## Stack

- **Backend:** FastAPI, SQLModel, async SQLite (aiosqlite), httpx, PyMuPDF4LLM
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4,
  TanStack Query, Framer Motion, **sonner** (toasts), **cmdk** (command
  palette), **papaparse** (CSV preview)
- **Deploy:** Single-container Docker image on Railway (static Next.js export
  served directly by FastAPI on one port)

## Quick start

### With Docker Compose

```bash
docker compose up --build
# → http://localhost:8080
```

### Without Docker

```bash
# Terminal 1 — backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080

# Terminal 2 — frontend
cd frontend
npm install
NEXT_PUBLIC_API_BASE=http://localhost:8080 npm run dev
# → http://localhost:3000
```

## Configuration

All optional; sensible defaults are provided.

| Variable          | What                                           | Default                              |
| ----------------- | ---------------------------------------------- | ------------------------------------ |
| `DATABASE_URL`    | Async SQLAlchemy URL                           | `sqlite+aiosqlite:///./data/dictionary.db` |
| `GROQ_API_KEY`    | Enables Groq (recommended — free + fast)       | — (heuristic fallback) |
| `GROQ_MODEL`      | Groq model                                     | `llama-3.1-8b-instant`               |
| `OLLAMA_URL`      | Enables Ollama LLM (e.g. `http://localhost:11434`) | — (heuristic fallback) |
| `OLLAMA_MODEL`    | Model name for Ollama                          | `llama3.2:3b`                        |
| `HF_API_TOKEN`    | Enables HuggingFace Inference Providers        | — (heuristic fallback)               |
| `HF_MODEL`        | Model for HF                                   | `mistralai/Mistral-7B-Instruct-v0.3` |
| `HF_PROVIDER`     | HF provider route                              | `hf-inference`                       |
| `LOOKUP_CACHE_TTL`| Seconds to cache per-source lookups            | 43200 (12h)                          |
| `PDF_MAX_BYTES`   | Max PDF upload size                            | 10 MiB                               |

### Turning on the LLM (free)

The LLM is used for two features:
1. **Refine box** on the term page — consolidates a consensus definition across sources.
2. **PDF import** — extracts defined terms contextually (much better than the regex-only fallback).

Both features fall back gracefully when no LLM is configured
(heuristic consensus and regex extraction respectively), so nothing
breaks — but the LLM is materially better, especially for PDFs.

**Three ways to plug one in, in order of "how easy is this":**

#### 1. Groq (recommended)

Fastest to set up, generous free tier (~30 req/min), sub-second responses.

1. Sign up at https://console.groq.com (GitHub or Google login, no card)
2. **API Keys → Create API Key** → copy `gsk_...`
3. On Railway: **Variables → New Variable** → `GROQ_API_KEY = gsk_...`
4. Redeploy. `GET /api/system` should show `llm.groq = true` and
   `model = "groq:llama-3.1-8b-instant"`.

Override model with `GROQ_MODEL`. Good picks:
- `llama-3.1-8b-instant` (default, fast)
- `llama-3.3-70b-versatile` (higher quality, a bit slower)
- `mixtral-8x7b-32768` (big context window)

#### 2. Hugging Face Inference Providers

If you already have an HF account. Uses the newer
`router.huggingface.co` chat-completions endpoint (NOT the deprecated
`api-inference.huggingface.co` one — that's why earlier HF tokens may
have silently failed).

1. Sign in at https://huggingface.co
2. Generate a read token at https://huggingface.co/settings/tokens
3. Set `HF_API_TOKEN=hf_...` on Railway, redeploy.
4. Optional: `HF_MODEL` and `HF_PROVIDER`. Default provider is
   `hf-inference` (the free serverless route). You can also point it at
   `together`, `fireworks-ai`, etc. if you have credits with those.

If HF extraction returns 0 results but Groq would be trivial to add,
the PDF import UI will say "LLM extraction failed — fell back to
regex" with the exact HTTP error, so you can see whether it's an auth
issue, a rate limit, or a deprecated model.

#### 3. Ollama (self-hosted, local)

Useful if you want zero external dependencies and already run Ollama
somewhere reachable from the container.

1. `ollama pull llama3.2:3b`
2. Set `OLLAMA_URL=http://host.docker.internal:11434` (or wherever
   Ollama is).

**Priority order:** if multiple are configured, the code tries
**Groq → Ollama → HF** per call and stops at the first success.

### Surviving Groq's free tier rate limits

Groq's free tier imposes a daily token budget (roughly 100k–200k tokens/day
depending on the model). A single 20-page PDF through the LLM extractor
is ~10k tokens. That means you can run a lot of small imports before
hitting the wall, but one or two large policy documents can burn the
budget.

When it runs out you'll see:

> LLM extraction failed — fell back to regex. Cause:
> `groq:... HTTP 429: {"error":{"message":"Rate limit reached ..."}}`

Three things help:

1. **Set `HF_API_TOKEN` as well.** When Groq returns 429, the code
   automatically blacklists Groq for the rest of that PDF and falls
   through to HF for the remaining chunks. No code change needed —
   just a second env var.
2. **Switch models on Groq.** `llama-3.1-8b-instant` has the highest
   free budget; `llama-3.3-70b-versatile` is higher quality but much
   tighter on tokens. Set `GROQ_MODEL=llama-3.1-8b-instant` if you've
   been using the 70b.
3. **Split big PDFs.** The chunker already processes long PDFs in
   ~10k-char windows with deduplication — but if you routinely import
   50+ page documents you'll want a paid tier or a self-hosted Ollama.

## Deploy to Railway

1. Push this repo to GitHub
2. Railway → "Deploy from GitHub repo" (it auto-detects `Dockerfile` +
   `railway.toml`)
3. Optionally set `OLLAMA_URL` or `HF_API_TOKEN` to enable LLM consolidation
4. Healthcheck is wired at `/api/health`

## API surface (highlights)

```
GET    /api/health                      healthcheck
GET    /api/system                      llm status, model, env
GET    /api/terms                       list + filter (q, flag, category, tag)
POST   /api/terms                       create
GET    /api/terms/{id}                  full detail
GET    /api/terms/slug/{slug}           public read-only
PUT    /api/terms/{id}                  partial update
PUT    /api/terms/{id}/flag             change flag
PUT    /api/terms/{id}/tags             replace tag list
DELETE /api/terms/{id}                  delete term
GET    /api/terms/{id}/definitions      list
DELETE /api/terms/{id}/definitions/{did} remove one
GET    /api/terms/{id}/audit            audit trail
POST   /api/terms/{id}/refine           LLM consolidation
GET    /api/terms/search?q=             ranked hits w/ snippets
GET    /api/terms/stats                 dashboard stats
POST   /api/lookup/{word}               multi-source fan-out
GET    /api/tags                        list
GET    /api/tags/counts                 with term counts
GET    /api/sources                     list
GET    /api/audit?limit=                global audit
POST   /api/import/csv                  multipart + column mapping
POST   /api/import/json                 multipart
POST   /api/import/pdf/preview          multipart, non-destructive
POST   /api/import/pdf                  multipart, writes to dictionary
GET    /api/export?format=csv|json|md   download
POST   /api/demo/reset                  wipe & reseed
```

## Project layout

```
backend/
  app/
    main.py                     FastAPI, lifespan, CORS, static mount + SPA catchall
    config.py                   Pydantic settings (LLM, cache, PDF limits)
    database.py                 Async engine + session
    models/term.py              Term, Definition, Source, Tag, TermTag,
                                ImportJob, LLMRefinement, AuditEvent
    schemas/term.py             Pydantic shapes
    routers/
      terms.py                  CRUD, flag, tags, search, stats, audit
      lookup.py                 Fan-out lookup
      refine.py                 LLM consolidation
      sources.py                Sources list
      tags.py                   Tags + counts
      audit.py                  Global audit
      import_export.py          CSV/JSON/PDF import + CSV/JSON/MD export
      system.py                 System info + demo reset
    services/
      dictionary_service.py     Adapters: free-dict, wiktionary, wikipedia, standards, MW
      llm_service.py            Ollama + HF + heuristic fallback
      pdf_extractor.py          PyMuPDF4LLM + regex heuristics
      audit.py                  Helper
    seed/
      sample_terms.json         25 seeded business terms with tags
      standards_corpus.json     Curated ISO/IEC definitions for 20 common terms
      loader.py                 Seed + reset
  requirements.txt

frontend/
  app/
    layout.tsx                  Sidebar, header, palette, shortcuts, tour, transitions
    page.tsx                    Dashboard (animated stats, recent activity, audit)
    terms/page.tsx              Terms index with filters + bulk actions
    terms/[id]/…                Enhanced detail with refine box, tags, audit sidebar
    search/page.tsx             Global search with snippets
    tags/page.tsx               Tag cloud with counts
    import/page.tsx             CSV mapping UI + JSON + PDF preview
    t/[slug]/…                  Public shareable term page
  components/
    ui/*                        badge, button, card, dialog, input, select, skeleton
    providers.tsx               QueryClient + ThemeProvider + Toaster
    sidebar-nav.tsx             Nav with shortcut hints
    header.tsx                  Search, demo reset, theme, add-term
    command-palette.tsx         ⌘K palette
    keyboard-shortcuts.tsx      / and g-chord navigation
    tour.tsx                    4-step spotlight onboarding
    animated-number.tsx         Spring-tweened counters
    refine-box.tsx              LLM consolidation UI
    tag-editor.tsx              Optimistic tag chips
    audit-timeline.tsx          Vertical timeline with icons
    flag-badge.tsx              Dot-indicator flag chip
    source-badge.tsx            Color-coded per-source chip
    confidence-badge.tsx        High/med/low LLM confidence
    industry-select.tsx         Industry context picker
    empty-state.tsx             Reusable "nothing here" card
    add-term-dialog.tsx         Add custom term
    theme-toggle.tsx            light → dark → system
    page-transition.tsx         Framer Motion wrapper
  lib/
    api.ts                      Typed fetch client
    types.ts                    Backend-matched TS types
    utils.ts                    cn(), formatRelative()

Dockerfile                      Multi-stage: build frontend → copy into backend
docker-compose.yml              Local dev
railway.toml                    Railway config
README.md, ROADMAP.md
```

## License

MIT
