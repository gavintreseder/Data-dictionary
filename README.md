# Data Dictionary

A polished, demo-quality web app for managing business data dictionaries.
Search terms across multiple sources (Merriam-Webster, Free Dictionary, custom
business definitions), flag them for review, and build a curated internal
glossary.

![Phase 1](https://img.shields.io/badge/phase-1-blue) ![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20Next.js-green)

## Stack

- **Backend:** FastAPI, SQLModel, SQLite (async via aiosqlite), httpx
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4,
  TanStack Query, Framer Motion
- **Deploy:** Single-container Docker image on Railway (static Next.js export
  served by FastAPI on one port)

## Quick start (local)

### With Docker Compose (recommended)

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
npm run dev
# → http://localhost:3000 (talks to backend on :8080)
```

Set `NEXT_PUBLIC_API_BASE=http://localhost:8080` in `frontend/.env.local` when
running the frontend separately.

## Deploy to Railway

1. Push this repo to GitHub
2. New Railway project → "Deploy from GitHub repo"
3. Railway auto-detects `Dockerfile` and `railway.toml`
4. Set no env vars (SQLite defaults are fine for the demo)
5. The deployed URL serves both the UI and the API

Healthcheck: `GET /api/health`

## Project layout

```
backend/
  app/
    main.py               FastAPI app, lifespan, CORS, static mount
    config.py             Pydantic settings
    database.py           Async SQLite session
    models/term.py        Term, Definition, Source, ImportJob, LLMRefinement
    schemas/term.py       Pydantic request/response schemas
    routers/
      terms.py            CRUD, flag, stats
      lookup.py           Multi-source concurrent lookup
      sources.py          Source listing
    services/
      dictionary_service.py  Free Dictionary + Merriam-Webster adapters
    seed/sample_terms.json
  requirements.txt

frontend/
  app/
    layout.tsx            Root layout with sidebar + providers
    page.tsx              Dashboard
    terms/page.tsx        Terms index
    terms/[id]/page.tsx   Term detail
    search/page.tsx       Global search
  components/
    ui/*                  badge, button, card, dialog, input, select, skeleton
    sidebar-nav.tsx
    add-term-dialog.tsx
    flag-badge.tsx
    source-badge.tsx
    theme-toggle.tsx
    providers.tsx
  lib/
    api.ts                fetch wrapper
    types.ts              TS interfaces matching backend
    utils.ts              cn() helper

Dockerfile                Multi-stage: build frontend → copy into backend → uvicorn
docker-compose.yml        Local dev
railway.toml              Railway config
ROADMAP.md                4-phase roadmap
```

## What works in Phase 1

- Dashboard with term/flag/source counts and recent activity
- Browse 25 seeded business terms in a searchable, filterable table
- Click a term to see definitions grouped by source with color-coded badges
- "Lookup" button fetches live definitions from the Free Dictionary API
- Add custom business terms with definitions
- Flag terms (`needs_review` / `approved` / `disputed` / `archived`)
- Dark mode toggle
- Global search across terms and definitions

## What's next

See [ROADMAP.md](./ROADMAP.md) for Phases 2–4 (multi-source dictionaries +
open-source LLM consolidation, CSV/JSON import, PDF ingestion, guided demo mode).

## License

MIT
