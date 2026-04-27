"use client";

import { motion } from "framer-motion";
import { useState } from "react";

import { ToolCallRow } from "@/components/build-log/tool-call-row";
import { RolePill } from "@/components/build-log/role-pill";
import { cn } from "@/lib/utils";
import type { BuildLog, BuildMessage, BuildSession } from "@/lib/build-log";
import type { Depth, RoleFilter } from "@/app/behind-the-scenes/page";

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
  const [openLocal, setOpenLocal] = useState(false);
  const isUser = message.role === "user";

  // Depth modes:
  //   summary  → show curated 1-line summary
  //   thinking → replace summary with the raw assistant text (falls back to summary)
  //   doing    → summary + tool call list (names + summaries)
  //   code     → summary + tool calls + their commands/details/results expanded
  const showThinking = depth === "thinking" && !!message.content;
  const showTools = (depth === "doing" || depth === "code") && !!message.tool_calls?.length;
  const expandToolDetails = depth === "code";

  // For user messages, "thinking" still shows their full prompt content (they don't have tools)
  const headlineText =
    showThinking && message.content ? message.content : message.summary;

  // Local expand toggles into "code" mode for this card only
  const localShowAll = openLocal;

  const sideBorder = isUser
    ? "border-l-4 border-blue-500/40"
    : "border-l-4 border-purple-500/40";

  const canExpand =
    !!message.content ||
    (message.tool_calls && message.tool_calls.length > 0);

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
        <header className="flex items-start gap-2">
          <RolePill role={message.role} />
          <p
            className={cn(
              "flex-1 text-sm leading-snug",
              showThinking && "whitespace-pre-wrap text-[var(--color-foreground)]"
            )}
          >
            {headlineText}
          </p>
          {canExpand ? (
            <button
              type="button"
              onClick={() => setOpenLocal((o) => !o)}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
              aria-expanded={localShowAll}
            >
              {localShowAll ? "less" : "more"}
            </button>
          ) : null}
        </header>

        {/* In Doing/Code (or local-expanded), show the original message content as well */}
        {(localShowAll || depth === "doing" || depth === "code") &&
        !showThinking &&
        message.content ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            {message.content}
          </p>
        ) : null}

        {/* Tool calls — interleaved like the chat does */}
        {(showTools || localShowAll) && message.tool_calls?.length ? (
          <div className="mt-3 ml-1 border-l border-dashed border-[var(--color-border)] pl-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Tool calls
            </p>
            <ul className="space-y-0.5">
              {message.tool_calls.map((tc, i) => (
                <ToolCallRow
                  key={i}
                  call={tc}
                  forceOpen={expandToolDetails || localShowAll ? true : null}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </motion.article>
    </li>
  );
}
