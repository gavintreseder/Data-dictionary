"use client";

import {
  Bot,
  Code as CodeIcon,
  ListTree,
  MessageSquare,
  Sparkles,
  TableOfContents,
  User,
  Users,
  Wrench,
} from "lucide-react";
import { useState } from "react";

import { CardView } from "@/components/build-log/card-view";
import { FinderView } from "@/components/build-log/finder-view";
import { TreeView } from "@/components/build-log/tree-view";
import { Card, CardContent } from "@/components/ui/card";
import { buildLog } from "@/lib/build-log";
import { cn } from "@/lib/utils";

export type View = "cards" | "finder" | "tree";
export type Depth = "summary" | "thinking" | "doing" | "code";
export type RoleFilter = "all" | "user" | "assistant";

const VIEWS: Array<{ id: View; label: string; icon: typeof MessageSquare; hint: string }> = [
  {
    id: "cards",
    label: "Conversation",
    icon: MessageSquare,
    hint: "Chronological cards in a single column — same flow as the Claude chat window.",
  },
  {
    id: "finder",
    label: "Finder",
    icon: TableOfContents,
    hint: "Apple-style three-column drill-down: Sessions → Summary → Tools.",
  },
  {
    id: "tree",
    label: "Tree",
    icon: ListTree,
    hint: "Windows-style tree with chevrons. Best for skimming the whole build top-down.",
  },
];

const DEPTH_OPTIONS: Array<{
  id: Depth;
  label: string;
  hint: string;
  icon: typeof MessageSquare;
}> = [
  { id: "summary", label: "Summary", icon: MessageSquare, hint: "What the chat meant, in one line." },
  { id: "thinking", label: "Thinking", icon: Sparkles, hint: "The original assistant text — replaces the summary." },
  { id: "doing", label: "Doing", icon: Wrench, hint: "Tools, commands, files created — what the agent actually did." },
  { id: "code", label: "Code", icon: CodeIcon, hint: "The actual commands/code/results behind the doing." },
];

const ROLE_OPTIONS: Array<{
  id: RoleFilter;
  label: string;
  hint: string;
  icon: typeof MessageSquare;
}> = [
  { id: "all", label: "Everyone", icon: Users, hint: "Show both sides of the conversation." },
  { id: "user", label: "Me (user)", icon: User, hint: "Show only my prompts — the human side." },
  { id: "assistant", label: "Agent", icon: Bot, hint: "Show only the agent's responses." },
];

export default function BehindTheScenesPage() {
  const [view, setView] = useState<View>("cards");
  const [depth, setDepth] = useState<Depth>("summary");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const totalMessages = buildLog.sessions.reduce(
    (acc, s) => acc + s.messages.length,
    0
  );
  const totalTools = buildLog.sessions.reduce(
    (acc, s) =>
      acc +
      s.messages.reduce(
        (a, m) =>
          a + (m.blocks?.filter((b) => b.type === "tool").length ?? 0),
        0
      ),
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
          Pick a view, filter by who&apos;s talking, and drill from one-line
          summaries down to the actual commands the agent ran.
        </p>
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {buildLog.sessions.length} session{buildLog.sessions.length === 1 ? "" : "s"} ·{" "}
          {totalMessages} messages ·{" "}
          {totalTools} tool calls captured.
        </p>
      </header>

      {/* Controls */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <ControlGroup label="View">
              {VIEWS.map((v) => (
                <Pill
                  key={v.id}
                  active={view === v.id}
                  onClick={() => setView(v.id)}
                  hint={v.hint}
                  icon={v.icon}
                  label={v.label}
                />
              ))}
            </ControlGroup>

            <ControlGroup label="Show">
              {ROLE_OPTIONS.map((r) => (
                <Pill
                  key={r.id}
                  active={roleFilter === r.id}
                  onClick={() => setRoleFilter(r.id)}
                  hint={r.hint}
                  icon={r.icon}
                  label={r.label}
                />
              ))}
            </ControlGroup>
          </div>

          <ControlGroup label="Detail">
            {DEPTH_OPTIONS.map((d) => (
              <Pill
                key={d.id}
                active={depth === d.id}
                onClick={() => setDepth(d.id)}
                hint={d.hint}
                icon={d.icon}
                label={d.label}
              />
            ))}
          </ControlGroup>
        </CardContent>
      </Card>

      {/* The view */}
      {view === "cards" ? (
        <CardView log={buildLog} depth={depth} roleFilter={roleFilter} />
      ) : view === "finder" ? (
        <FinderView log={buildLog} depth={depth} roleFilter={roleFilter} />
      ) : (
        <TreeView log={buildLog} depth={depth} roleFilter={roleFilter} />
      )}
    </div>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="mr-1 inline-flex items-center text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {label}
      </span>
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  hint,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  hint: string;
  icon: typeof MessageSquare;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
          : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
