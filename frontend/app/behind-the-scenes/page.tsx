"use client";

import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ListTree,
  MessageSquare,
  Sparkles,
  TableOfContents,
} from "lucide-react";
import { useState } from "react";

import { CardView } from "@/components/build-log/card-view";
import { FinderView } from "@/components/build-log/finder-view";
import { TreeView } from "@/components/build-log/tree-view";
import { Card, CardContent } from "@/components/ui/card";
import { buildLog } from "@/lib/build-log";
import { cn } from "@/lib/utils";

type View = "cards" | "finder" | "tree";
type Depth = "summary" | "content" | "tools";

const VIEWS: Array<{ id: View; label: string; icon: typeof MessageSquare; hint: string }> = [
  {
    id: "cards",
    label: "Conversation",
    icon: MessageSquare,
    hint: "Chronological cards in offset swimlanes — what I said vs what the agent said vs what tools ran.",
  },
  {
    id: "finder",
    label: "Finder",
    icon: TableOfContents,
    hint: "Apple-style three-column drill-down: Sessions → Messages → Detail.",
  },
  {
    id: "tree",
    label: "Tree",
    icon: ListTree,
    hint: "Windows-style tree with chevrons. Best for skimming the whole build top-down.",
  },
];

const DEPTH_OPTIONS: Array<{ id: Depth; label: string; hint: string }> = [
  { id: "summary", label: "Summaries", hint: "Just the one-liners" },
  { id: "content", label: "+ Detail", hint: "Show explanation text" },
  { id: "tools", label: "+ Tools", hint: "Expand every tool call" },
];

export default function BehindTheScenesPage() {
  const [view, setView] = useState<View>("cards");
  const [depth, setDepth] = useState<Depth>("summary");

  const totalMessages = buildLog.sessions.reduce(
    (acc, s) => acc + s.messages.length,
    0
  );
  const totalTools = buildLog.sessions.reduce(
    (acc, s) =>
      acc + s.messages.reduce((a, m) => a + (m.tool_calls?.length ?? 0), 0),
    0
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="inline-flex items-center gap-1 rounded-full border bg-[var(--color-muted)] px-2 py-0.5 text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <Sparkles className="h-3 w-3" />
          Behind the scenes
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          How this app was built
        </h1>
        <p className="max-w-2xl text-[var(--color-muted-foreground)]">
          A record of the agentic coding session(s) that produced this app.
          The view switcher gives you three lenses on the same data.
          Use the depth control to zoom from one-line summaries down to every
          tool call.
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {buildLog.sessions.length} session{buildLog.sessions.length === 1 ? "" : "s"} ·{" "}
          {totalMessages} messages ·{" "}
          {totalTools} tool calls captured.
        </p>
      </header>

      {/* Controls */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const active = view === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setView(v.id)}
                  title={v.hint}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                  )}
                  aria-pressed={active}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {v.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <ChevronsUpDown className="h-3 w-3" />
              Detail
            </span>
            {DEPTH_OPTIONS.map((d) => {
              const active = depth === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDepth(d.id)}
                  title={d.hint}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
                  )}
                  aria-pressed={active}
                >
                  {active ? (
                    <ChevronDown className="mr-1 inline h-3 w-3" />
                  ) : (
                    <ChevronRight className="mr-1 inline h-3 w-3" />
                  )}
                  {d.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tip */}
      {view === "cards" ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          Tip: user messages stay flush left; agent responses indent right; tool
          calls indent further. Click any card to expand it independently.
        </p>
      ) : null}

      {/* The view */}
      {view === "cards" ? (
        <CardView log={buildLog} depth={depth} />
      ) : view === "finder" ? (
        <FinderView log={buildLog} />
      ) : (
        <TreeView log={buildLog} depth={depth} />
      )}
    </div>
  );
}
