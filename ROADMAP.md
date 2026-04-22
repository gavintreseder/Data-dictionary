# Roadmap — v0.2

Phases 1 through 4 from the original plan, plus the cross-cutting polish
items, are now shipped. This file now reads as a history + what-next list.

---

## ✅ Phase 1 — Foundation

The initial demoable loop.

- Dashboard with term / flag / source counts and a recent-activity feed
- Terms index with search + filter by flag / category / tag
- Term detail page with definitions grouped by source, flag dropdown,
  "Lookup" button and a live link to the source homepage
- Add custom business-specific terms with their own definitions
- Flag workflow: `none` / `needs_review` / `approved` / `disputed` / `archived`
- Global search across terms and definitions
- Dark mode with Framer Motion page transitions
- Skeleton loading states (not spinners)
- FastAPI + SQLModel + SQLite backend, Next.js 15 + React 19 + Tailwind v4
  frontend, single-port deployment via Railway

---

## ✅ Phase 2 — Multi-source dictionaries + LLM consolidation

Made lookups feel smart. Instead of just showing raw definitions, we produce
a single "industry-aligned" consolidated definition and let users nudge it
with natural-language prompts.

- Adapter pattern with concurrent fan-out and per-source timeouts:
  - Free Dictionary (no key)
  - **Wiktionary** (REST API)
  - **Wikipedia** (REST summary)
  - **Standards** — a curated ISO/IEC-style local corpus
  - Merriam-Webster (scaffolded, activates when a key is provided)
- Per-source in-memory cache (TTL configurable)
- Open-source LLM consolidation with two backends, whichever is configured:
  - **Ollama** via `OLLAMA_URL`
  - **HuggingFace Inference API** via `HF_API_TOKEN`
- **Heuristic fallback** when no LLM is configured — picks the best consensus
  definition from source overlap, so refinement still produces useful output
  out of the box.
- "Refine this definition" text box on the term detail page; each refinement
  is stored as an `LLMRefinement` row with the prompt, sources used, model
  name and confidence score.
- Source chips under the LLM-generated text show which sources were used.
- Per-term **industry context** setting (generic / finance / healthcare /
  engineering / legal / public sector) is fed into the LLM prompt.
- **Confidence badge** (high / medium / low) on LLM output, based on source
  agreement and whether an LLM or heuristic produced it.

### Stretch (not yet)

- Embedding-based similarity for "related terms" (sqlite-vss)
- Auto-suggest merges when two custom terms have near-identical definitions

---

## ✅ Phase 3 — Import, search, export

Made it feel like a real tool a team can fill up. Bulk in, bulk out.

- **CSV import** with a column-mapping UI (papaparse preview of first 5 rows,
  auto-detection of common column names, per-column mapping)
- **JSON import** (round-trips with the JSON export)
- **Full export** — CSV, JSON, and a Markdown glossary from one endpoint
- **Search with snippets** across terms + all definitions, with highlighted
  match windows
- **Bulk actions** in the terms table — bulk-flag, bulk-delete, shift-selection
- **Tags** (many-to-many) with a dedicated `/tags` page, term-detail tag
  editor (optimistic), and facet filtering on the terms index
- **Audit log** of changes per term (create / update / flag change / refine /
  import), plus a global log on the dashboard
- **Shareable read-only view** at `/t/<slug>`; the URL is generated per-term
  and the copy button is one click away on the detail page

### Not yet

- SQLite **FTS5** virtual table (current search is LIKE-based with snippet
  extraction — good enough for the demo; FTS5 would add ranked relevance +
  stemming)
- OpenGraph preview cards for share links
- CSV/JSON import through drag-onto-sidebar vs the dedicated page

---

## ✅ Phase 4 — PDF ingestion, guided onboarding, demo mode

The "wow" phase.

- **PDF upload + extraction** via PyMuPDF4LLM with a regex heuristic that
  picks up `"Term" means …`, `**Term** — …`, `Term: …`, `Term is defined as …`
  patterns. Preview before import; confirm to write to the dictionary.
- **Guided onboarding tour** — a 4-step spotlight walkthrough on first visit
  highlighting the dashboard stats, activity log, terms page and import page.
  Skippable, remembered via `localStorage`, replayable from devtools or a
  reset.
- **Demo mode** — a one-click reset in the header wipes custom data and
  re-seeds, so the demo is always fresh.
- **Empty states with CTAs** — every list has a non-blank "no terms match"
  view with an icon, explanation, and action button.
- **Share links** on every term, including a public read-only page.

### Not yet

- Diff view between client's PDF definition and industry consensus with a
  "disagreement score"
- Public demo workspace with a "Fork this workspace" button

---

## ✅ Cross-cutting polish

- **Keyboard shortcuts** — `/` focuses search, `⌘K` / `Ctrl-K` opens the
  command palette, `g d` / `g t` / `g s` / `g i` chord navigation
- **Toast notifications** (sonner) on every mutation: add / flag / import /
  refine / tag / delete
- **Optimistic updates** via TanStack Query for flags and tag edits — no
  spinners on common actions
- **Animated numbers** on the dashboard stat cards (framer-motion spring)
- **Consistent iconography** (Lucide throughout)
- **Empty states** with CTAs everywhere a list can be blank
- **A11y basics** — aria labels on icon buttons, focus rings, keyboard nav,
  form labels, `<kbd>` elements for shortcut hints
- **Perf** — route-level code splitting, static export, minimal client
  bundles (most pages < 10 kB of route-specific JS)

---

## What's next (beyond v0.2)

These are the items most worth tackling if this progresses past demo:

- **FTS5** ranked search with live-as-you-type snippet highlighting
- **OpenGraph** preview cards for `/t/<slug>` so Slack / email embeds look good
- **Embeddings-based "related terms"** using `sentence-transformers` + sqlite-vss
- **Inter-PDF diff view** — compare a client's definition to the industry
  consensus with a disagreement score and merge suggestions
- **Multi-workspace** with public read-only demo workspaces and a "fork to
  your own" button
- **Auth** — the moment this stops being single-user
- **SSE / WebSocket** presence for live collaborative editing
- **Public API keys** + rate limiting for programmatic use
