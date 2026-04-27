"use client";

import { ChevronRight, FolderOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ToolCallRow } from "@/components/build-log/tool-call-row";
import { RolePill } from "@/components/build-log/role-pill";
import { cn } from "@/lib/utils";
import {
  type BuildLog,
  type BuildMessage,
  type BuildSession,
  messageToolCount,
} from "@/lib/build-log";

type Depth = "summary" | "content" | "tools";

export function TreeView({ log, depth }: { log: BuildLog; depth: Depth }) {
  const allOpenSessions = useMemo(
    () => new Set(log.sessions.filter((s) => !s.placeholder).map((s) => s.id)),
    [log]
  );
  const allOpenMessages = useMemo(
    () =>
      depth === "tools" || depth === "content"
        ? new Set(
            log.sessions.flatMap((s) => s.messages.map((m) => `${s.id}/${m.id}`))
          )
        : new Set<string>(),
    [log, depth]
  );

  const [openSessions, setOpenSessions] = useState<Set<string>>(allOpenSessions);
  const [openMessages, setOpenMessages] = useState<Set<string>>(allOpenMessages);

  // Re-sync expansion when global depth control changes
  useEffect(() => {
    setOpenSessions(allOpenSessions);
    setOpenMessages(allOpenMessages);
  }, [allOpenSessions, allOpenMessages]);

  const toggle = (
    set: Set<string>,
    setter: (s: Set<string>) => void,
    key: string
  ) => {
    const next = new Set(set);
    next.has(key) ? next.delete(key) : next.add(key);
    setter(next);
  };

  return (
    <div className="rounded-xl border bg-[var(--color-card)] p-2 font-mono text-sm">
      <ul>
        {log.sessions.map((s) => {
          const open = openSessions.has(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => toggle(openSessions, setOpenSessions, s.id)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-[var(--color-muted)]"
                aria-expanded={open}
              >
                <ChevronRight
                  className={cn(
                    "h-3 w-3 text-[var(--color-muted-foreground)] transition-transform",
                    open && "rotate-90"
                  )}
                />
                <FolderOpen className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
                <span className="font-medium">{s.title}</span>
                <span className="ml-2 text-[10px] text-[var(--color-muted-foreground)]">
                  {s.placeholder
                    ? "placeholder"
                    : `${s.messages.length} msgs`}
                </span>
              </button>
              {open ? (
                <SessionTree
                  session={s}
                  depth={depth}
                  openMessages={openMessages}
                  toggleMessage={(k) =>
                    toggle(openMessages, setOpenMessages, k)
                  }
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SessionTree({
  session,
  depth,
  openMessages,
  toggleMessage,
}: {
  session: BuildSession;
  depth: Depth;
  openMessages: Set<string>;
  toggleMessage: (k: string) => void;
}) {
  if (session.placeholder) {
    return (
      <p className="ml-9 mt-1 max-w-2xl border-l border-dashed border-[var(--color-border)] pl-3 text-[11px] italic text-[var(--color-muted-foreground)]">
        {session.note}
      </p>
    );
  }
  return (
    <ul className="ml-3 border-l border-[var(--color-border)]/60 pl-3">
      {session.messages.map((m) => {
        const key = `${session.id}/${m.id}`;
        const open = openMessages.has(key);
        const hasChildren = !!(m.content || messageToolCount(m) > 0);
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => hasChildren && toggleMessage(key)}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left hover:bg-[var(--color-muted)]"
            >
              {hasChildren ? (
                <ChevronRight
                  className={cn(
                    "h-3 w-3 text-[var(--color-muted-foreground)] transition-transform",
                    open && "rotate-90"
                  )}
                />
              ) : (
                <span className="w-3" />
              )}
              <RolePill role={m.role} />
              <span className="flex-1 truncate text-xs font-sans">
                {m.summary}
              </span>
              {messageToolCount(m) > 0 ? (
                <span className="shrink-0 rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] font-sans text-[var(--color-muted-foreground)]">
                  {messageToolCount(m)} tools
                </span>
              ) : null}
            </button>
            {open ? <MessageBranch message={m} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

function MessageBranch({ message }: { message: BuildMessage }) {
  return (
    <div className="ml-4 mt-1 space-y-2 border-l border-[var(--color-border)]/60 pl-3 font-sans">
      {message.content ? (
        <p className="whitespace-pre-wrap rounded-md bg-[var(--color-muted)]/40 p-2 text-xs text-[var(--color-muted-foreground)]">
          {message.content}
        </p>
      ) : null}
      {message.tool_calls?.length ? (
        <ul className="space-y-0.5">
          {message.tool_calls.map((tc, i) => (
            <ToolCallRow key={i} call={tc} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
