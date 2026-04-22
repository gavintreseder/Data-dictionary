# Roadmap

A four-phase plan for turning the data dictionary demo into a product that
feels like a polished SaaS tool.

Each phase is intended to be demoable on its own — you can hand the link to
someone and it should look and feel like a working product, not a prototype.

---

## Phase 1 — Foundation (this release)

**Goal:** A polished, single-container demo that shows the core loop:
search → view definitions → flag → add custom term.

**Shipped:**

- Dashboard with term/flag/source counts, recent activity, and quick search
- Terms index with full-text search and filtering by flag/source
- Term detail page with definitions grouped by source, color-coded badges,
  flag dropdown, and a "Lookup" button that hits the Free Dictionary API
  (no key required) and persists results
- Add custom business-specific terms with their own definitions
- Flag workflow: `none` / `needs_review` / `approved` / `disputed` / `archived`
- Global search across terms and definitions
- Dark mode with Framer Motion page transitions
- Skeleton loading states (not spinners)
- FastAPI + SQLModel + SQLite backend, Next.js 15 + React 19 + Tailwind v4
  frontend, single-port deployment via Railway

**Deliberately not built yet:**

- No LLM integration (open-source LLM planned for Phase 2)
- No file imports (PDF/CSV planned for Phases 3–4)
- Single-user, no auth (demo mode)

---

## Phase 2 — Multi-source dictionaries + open-source LLM consolidation

**Goal:** Make lookups feel smart. Instead of just showing raw definitions,
produce a single "industry-aligned" consolidated definition that the user can
nudge with natural-language prompts.

**Features:**

- Adapter pattern for additional sources: Wiktionary, WordNet (offline),
  Urban Dictionary (for slang detection), Wikipedia summaries, Investopedia
  (finance), ISO/IEC glossaries
- Concurrent fan-out lookup with per-source timeouts and caching
- Open-source LLM consolidation — two paths:
  - **Ollama** on the host: `llama3.2:3b` or `mistral:7b-instruct` via
    `http://host.docker.internal:11434`
  - **Hugging Face Inference API** (free tier) with
    `mistralai/Mistral-7B-Instruct-v0.3` as a fallback
- "Refine this definition" text box on the term detail page — each refinement
  is stored as an `LLMRefinement` row so you can see the history
- Show which sources were used to build the consolidated definition as chips
  under the LLM-generated text
- Per-term "industry context" setting (finance / healthcare / engineering /
  generic) that's fed into the LLM prompt
- Confidence badge on LLM output based on source agreement

**Stretch:**

- Embedding-based similarity for "related terms" (sqlite-vss or a tiny
  sentence-transformers model)
- Auto-suggest merges when two custom terms have near-identical definitions

---

## Phase 3 — Import, full-text search, export

**Goal:** Make it feel like a real data dictionary a team would actually fill
up. Bulk in, bulk out.

**Features:**

- CSV import with column mapping UI (term / definition / source / category)
- JSON import (round-trips with the export)
- Full export: CSV, JSON, Markdown glossary
- SQLite FTS5 full-text search across terms + all definitions with snippet
  highlighting
- Bulk actions in the terms table: flag-many, delete-many, tag-many
- Category/tag system with a sidebar facet panel
- Audit log of changes per term (who changed the flag, when, diff of
  definition text)
- Shareable read-only view of a single term (`/t/<slug>`) with OpenGraph
  preview — makes it Slack-friendly

---

## Phase 4 — PDF ingestion, guided onboarding, demo mode

**Goal:** The "wow" phase. Drop in a client's policy PDF, watch the app
extract their in-house definitions, compare them against industry standards,
and flag the ones that disagree.

**Features:**

- PDF upload and ingestion via **PyMuPDF4LLM** (markdown-aware extraction)
- Heuristic + LLM extraction of "defined terms" from PDFs — look for patterns
  like "*X* means ...", "X is defined as ...", all-caps headers, glossary
  sections
- Side-by-side diff view: client's PDF definition vs. industry consensus,
  with a "disagreement score"
- Guided onboarding tour (react-joyride) that walks a first-time visitor
  through the key flows in ~60 seconds
- Demo mode toggle — resets the database to the seeded state and replays a
  scripted tour, so the app is always demo-ready
- Public demo workspace that anyone with the link can explore (read-only),
  plus a "Fork this workspace" button that clones it into a private one
- Rich empty states with illustrations and example prompts so the app never
  looks blank

---

## Cross-cutting polish (any phase)

These are the details that make it *feel* like a product:

- **Keyboard shortcuts:** `/` focuses search, `⌘K` opens a command palette,
  `g t` goes to terms, `g d` goes to dashboard
- **Toast notifications** on every mutation (add / flag / import)
- **Optimistic updates** via TanStack Query — no spinners on flag changes
- **Empty states with CTAs** — "No terms yet. Import a CSV or add your first
  term."
- **Animated numbers** on the dashboard stat cards
- **Consistent iconography** (Lucide)
- **A11y:** keyboard navigation, ARIA labels, focus rings, reduced-motion
  support
- **Perf:** route-level code splitting, RSC where it helps, Next.js static
  export for everything that isn't live

---

## Non-goals (for the demo)

- Multi-tenant auth / SSO
- Real-time collaboration (presence, live cursors)
- Mobile-native apps
- Enterprise audit/compliance features (SOC2, etc.)

These belong to a post-demo productization phase.
