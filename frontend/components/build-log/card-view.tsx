"use client";

import { motion } from "framer-motion";
import { ChevronRight, Sparkles, Wrench } from "lucide-react";
import { useEffect, useState } from "react";

import { ToolCallRow } from "@/components/build-log/tool-call-row";
import { RolePill } from "@/components/build-log/role-pill";
import { cn } from "@/lib/utils";
import type { BuildLog, BuildMessage, BuildSession } from "@/lib/build-log";
import type { Depth, RoleFilter } from "@/app/behind-the-scenes/page";

const DEPTH_RANK: Record<Depth, number> = {
  summary: 1,
  thinking: 2,
  doing: 3,
  code: 4,
};

export function CardView({
  log,
  depth,
  roleFilter,
}: {
  log: BuildLog;
  depth: Depth;
  roleFilter: RoleFilter;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-10">
      {log.sessions.map((session) => (
        <SessionBlock
          key={session.id}
          session={session}
          depth={depth}
          roleFilter={roleFilter}
        />
      ))}
    </div>
  );
}

function SessionBlock({
  session,
  depth,
  roleFilter,
}: {
  session: BuildSession;
  depth: Depth;
  roleFilter: RoleFilter;
}) {
  const messages = session.messages.filter(
    (m) => roleFilter === "all" || m.role === roleFilter
  );
  return (
    <section className="space-y-4">
      <header className="space-y-1 border-l-2 border-[var(--color-primary)] pl-3">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Session · {session.id}
        </p>
        <h2 className="text-xl font-semibold">{session.title}</h2>
        {session.summary ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {session.summary}
          </p>
        ) : null}
        {session.note ? (
          <p className="mt-2 rounded-md border border-dashed bg-[var(--color-muted)]/40 px-3 py-2 text-xs italic text-[var(--color-muted-foreground)]">
            {session.note}
          </p>
        ) : null}
      </header>

      <ol className="space-y-3">
        {messages.map((m, idx) => (
          <MessageCard key={m.id} message={m} index={idx} depth={depth} />
        ))}
        {messages.length === 0 ? (
          <li className="rounded-md border border-dashed bg-[var(--color-muted)]/30 px-3 py-2 text-xs italic text-[var(--color-muted-foreground)]">
            No messages match the current filter.
          </li>
        ) : null}
      </ol>
    </section>
  );
}

function MessageCard({
  message,
  index,
  depth,
}: {
  message: BuildMessage;
  index: number;
  depth: Depth;
}) {
  const isUser = message.role === "user";
  const rank = DEPTH_RANK[depth];

  // Section auto-open state, driven by global depth, with local overrides.
  const [thinkingOpen, setThinkingOpen] = useState(rank >= 2);
  const [doingOpen, setDoingOpen] = useState(rank >= 3);

  // Re-sync when global depth changes
  useEffect(() => {
    setThinkingOpen(rank >= 2);
    setDoingOpen(rank >= 3);
  }, [rank]);

  const sideBorder = isUser
    ? "border-l-4 border-blue-500/40"
    : "border-l-4 border-purple-500/40";

  const hasThinking = !!message.content;
  const hasDoing = !!message.tool_calls?.length;

  return (
    <li>
      <motion.article
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, delay: Math.min(index, 6) * 0.02 }}
        className={cn(
          "rounded-xl bg-[var(--color-card)] shadow-sm",
          sideBorder,
          "px-4 py-3"
        )}
      >
        {/* Level 1: Summary (always visible) */}
        <header className="flex items-start gap-2">
          <RolePill role={message.role} />
          <p className="flex-1 text-sm leading-snug">{message.summary}</p>
        </header>

        {/* Level 2: Thinking (collapsible section) */}
        {hasThinking ? (
          <Section
            title="Thinking"
            icon={Sparkles}
            open={thinkingOpen}
            onToggle={() => setThinkingOpen((o) => !o)}
          >
            <p className="whitespace-pre-wrap rounded-md bg-[var(--color-muted)]/40 p-3 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              {message.content}
            </p>
          </Section>
        ) : null}

        {/* Level 3: Doing (collapsible section listing tool calls).
            Each tool call in turn opens to Level 4: Code. */}
        {hasDoing ? (
          <Section
            title={`Doing · ${message.tool_calls!.length} tool${
              message.tool_calls!.length === 1 ? "" : "s"
            }`}
            icon={Wrench}
            open={doingOpen}
            onToggle={() => setDoingOpen((o) => !o)}
          >
            <ul className="space-y-0.5">
              {message.tool_calls!.map((tc, i) => (
                <ToolCallRow
                  key={i}
                  call={tc}
                  forceOpen={rank >= 4 ? true : null}
                />
              ))}
            </ul>
          </Section>
        ) : null}
      </motion.article>
    </li>
  );
}

function Section({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: typeof Sparkles;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-90"
          )}
        />
        <Icon className="h-3 w-3" />
        {title}
      </button>
      {open ? <div className="mt-1 ml-1 pl-3">{children}</div> : null}
    </div>
  );
}
