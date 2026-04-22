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
| `OLLAMA_URL`      | Enables Ollama LLM (e.g. `http://localhost:11434`) | — (heuristic fallback) |
| `OLLAMA_MODEL`    | Model name for Ollama                          | `llama3.2:3b`                        |
| `HF_API_TOKEN`    | Enables HuggingFace Inference API              | — (heuristic fallback)               |
| `HF_MODEL`        | Model for HF                                   | `mistralai/Mistral-7B-Instruct-v0.3` |
| `LOOKUP_CACHE_TTL`| Seconds to cache per-source lookups            | 43200 (12h)                          |
| `PDF_MAX_BYTES`   | Max PDF upload size                            | 10 MiB                               |

### Turning on the LLM (free, via Hugging Face)

The app uses the LLM for **two** things: (1) consolidating a "consensus"
definition on the term page, and (2) extracting defined terms from PDFs.
Both features fall back to non-LLM paths when no token is configured
(heuristic consensus and regex extraction respectively), but the LLM is
materially better — especially for PDF extraction.

1. Create a free Hugging Face account at https://huggingface.co
2. Generate a **read** token at https://huggingface.co/settings/tokens
   (any token with the default "Read" scope is enough — no billing needed
   for the free Inference API tier)
3. On Railway: **Variables → New Variable** → `HF_API_TOKEN = hf_xxxxx`,
   then redeploy. Locally: add `HF_API_TOKEN=hf_xxxxx` to `backend/.env`
   or export it before starting uvicorn.
4. Optional: override the model with `HF_MODEL`. Good options:
   - `mistralai/Mistral-7B-Instruct-v0.3` (default, balanced)
   - `meta-llama/Llama-3.2-3B-Instruct` (faster, smaller)
   - `HuggingFaceH4/zephyr-7b-beta` (good at following structured output)

Verify it's on by hitting `GET /api/system` — `llm.enabled` should be
`true` and `llm.huggingface` should be `true`. The dashboard's yellow
"heuristic mode" banner will also disappear.

Rate limits on the free HF Inference API are modest (~300 req/hour) —
fine for a demo, not a production workload.

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
