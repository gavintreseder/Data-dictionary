"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { ToolCallRow } from "@/components/build-log/tool-call-row";
import { RolePill } from "@/components/build-log/role-pill";
import { cn } from "@/lib/utils";
import type { BuildLog, BuildMessage, BuildSession } from "@/lib/build-log";

type Depth = "summary" | "content" | "tools";

export function CardView({
  log,
  depth,
}: {
  log: BuildLog;
  depth: Depth;
}) {
  return (
    <div className="space-y-10">
      {log.sessions.map((session) => (
        <SessionBlock key={session.id} session={session} depth={depth} />
      ))}
    </div>
  );
}

function SessionBlock({ session, depth }: { session: BuildSession; depth: Depth }) {
  return (
    <section className="space-y-5">
      <header className="space-y-1 border-l-2 border-[var(--color-primary)] pl-3">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Session · {session.id}
        </p>
        <h2 className="text-xl font-semibold">{session.title}</h2>
        {session.summary ? (
          <p className="max-w-2xl text-sm text-[var(--color-muted-foreground)]">
            {session.summary}
          </p>
        ) : null}
        {session.placeholder ? (
          <p className="mt-2 max-w-2xl rounded-md border border-dashed bg-[var(--color-muted)]/40 px-3 py-2 text-xs italic text-[var(--color-muted-foreground)]">
            {session.note}
          </p>
        ) : null}
      </header>

      <ol className="space-y-3">
        {session.messages.map((m, idx) => (
          <MessageCard key={m.id} message={m} index={idx} depth={depth} />
        ))}
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

  // depth controls what's shown by default:
  //   summary → just the one-line summary, content collapsed, tools collapsed
  //   content → summary + content, tools collapsed
  //   tools   → everything expanded
  const showContent = depth !== "summary" || openLocal;
  const showTools = depth === "tools" || openLocal;

  const indent = isUser ? "ml-0" : "ml-6 md:ml-16";
  const stripeColor = isUser ? "bg-blue-500/40" : "bg-purple-500/40";
  const sideBorder = isUser
    ? "border-l-2 border-blue-500/30"
    : "border-l-2 border-purple-500/30";

  return (
    <li className={cn("relative", indent)}>
      {/* swimlane connector */}
      <span
        aria-hidden
        className={cn(
          "absolute -left-3 top-3 h-3 w-3 rounded-full",
          stripeColor
        )}
      />
      <motion.article
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: Math.min(index, 6) * 0.02 }}
        className={cn(
          "rounded-xl bg-[var(--color-card)] shadow-sm",
          sideBorder,
          "px-4 py-3"
        )}
      >
        <header className="flex flex-wrap items-center gap-2">
          <RolePill role={message.role} />
          <p className="flex-1 text-sm leading-snug">{message.summary}</p>
          {(message.content || (message.tool_calls?.length ?? 0) > 0) ? (
            <button
              type="button"
              onClick={() => setOpenLocal((o) => !o)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
              aria-expanded={openLocal}
            >
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  openLocal && "rotate-180"
                )}
              />
              {openLocal ? "collapse" : "expand"}
            </button>
          ) : null}
          {message.tool_calls?.length ? (
            <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] tabular-nums text-[var(--color-muted-foreground)]">
              {message.tool_calls.length} tool{message.tool_calls.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </header>

        {showContent && message.content ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            {message.content}
          </p>
        ) : null}

        {showTools && message.tool_calls?.length ? (
          <div className="mt-3 ml-2 border-l border-dashed border-[var(--color-border)] pl-3">
            <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Tool calls
            </p>
            <ul className="space-y-0.5">
              {message.tool_calls.map((tc, i) => (
                <ToolCallRow
                  key={i}
                  call={tc}
                  forceOpen={depth === "tools" ? null : null}
                />
              ))}
            </ul>
          </div>
        ) : null}
      </motion.article>
    </li>
  );
}
