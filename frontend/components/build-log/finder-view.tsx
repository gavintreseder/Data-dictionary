"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RolePill } from "@/components/build-log/role-pill";
import { ToolCallRow } from "@/components/build-log/tool-call-row";
import { cn } from "@/lib/utils";
import {
  type BuildLog,
  type BuildMessage,
  type BuildSession,
  messageToolCount,
  sessionMessageCount,
  totalToolCalls,
} from "@/lib/build-log";

export function FinderView({ log }: { log: BuildLog }) {
  const firstSession = log.sessions.find((s) => !s.placeholder)?.id ?? log.sessions[0]?.id;

  const [sessionId, setSessionId] = useState<string | undefined>(firstSession);
  const [messageId, setMessageId] = useState<string | undefined>();

  const session = useMemo(
    () => log.sessions.find((s) => s.id === sessionId),
    [log, sessionId]
  );
  const message = useMemo(
    () => session?.messages.find((m) => m.id === messageId),
    [session, messageId]
  );

  // Pick the first message of the selected session by default
  useEffect(() => {
    if (!session) return;
    if (!message || message && !session.messages.some((m) => m.id === message.id)) {
      setMessageId(session.messages[0]?.id);
    }
  }, [session, message]);

  return (
    <div className="grid h-[640px] grid-cols-1 gap-0 overflow-hidden rounded-xl border bg-[var(--color-card)] md:grid-cols-[14rem_minmax(18rem,1fr)_minmax(20rem,1.4fr)]">
      {/* Column 1 — sessions */}
      <Column title="Sessions">
        <ul>
          {log.sessions.map((s) => (
            <FinderItem
              key={s.id}
              active={s.id === sessionId}
              onClick={() => setSessionId(s.id)}
              title={s.title}
              hint={
                s.placeholder
                  ? "(placeholder)"
                  : `${sessionMessageCount(s)} msgs · ${totalToolCalls(s)} tools`
              }
            />
          ))}
        </ul>
      </Column>

      {/* Column 2 — messages in selected session */}
      <Column title={session?.title ?? "Messages"}>
        {session?.placeholder ? (
          <p className="px-3 py-4 text-xs italic text-[var(--color-muted-foreground)]">
            {session.note}
          </p>
        ) : (
          <ul>
            {session?.messages.map((m) => (
              <FinderItem
                key={m.id}
                active={m.id === messageId}
                onClick={() => setMessageId(m.id)}
                title={m.summary}
                role={m.role}
                hint={
                  messageToolCount(m) > 0
                    ? `${messageToolCount(m)} tool${messageToolCount(m) === 1 ? "" : "s"}`
                    : undefined
                }
              />
            ))}
          </ul>
        )}
      </Column>

      {/* Column 3 — message detail */}
      <Column title={message ? message.summary : "Detail"} flush>
        {message ? <Detail message={message} /> : (
          <p className="px-3 py-4 text-xs text-[var(--color-muted-foreground)]">
            Select a message to see its content + tool calls.
          </p>
        )}
      </Column>
    </div>
  );
}

function Column({
  title,
  children,
  flush,
}: {
  title: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div className="flex flex-col border-b border-[var(--color-border)] last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="border-b bg-[var(--color-muted)]/40 px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {title}
      </div>
      <div
        className={cn(
          "flex-1 overflow-y-auto scrollbar-soft",
          flush ? "" : "py-1"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function FinderItem({
  active,
  onClick,
  title,
  hint,
  role,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  role?: BuildMessage["role"];
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2 text-left text-xs",
          active
            ? "bg-[var(--color-primary)]/10 text-[var(--color-foreground)]"
            : "hover:bg-[var(--color-muted)]"
        )}
      >
        {role ? <RolePill role={role} /> : null}
        <span className="flex-1 truncate">{title}</span>
        {hint ? (
          <span className="shrink-0 text-[10px] text-[var(--color-muted-foreground)]">
            {hint}
          </span>
        ) : null}
        <ChevronRight className="h-3 w-3 text-[var(--color-muted-foreground)]" />
      </button>
    </li>
  );
}

function Detail({ message }: { message: BuildMessage }) {
  return (
    <div className="space-y-3 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <RolePill role={message.role} />
        <p className="font-medium">{message.summary}</p>
      </div>
      {message.content ? (
        <p className="whitespace-pre-wrap text-[var(--color-muted-foreground)]">
          {message.content}
        </p>
      ) : null}
      {message.tool_calls?.length ? (
        <div className="border-t pt-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
            {message.tool_calls.length} tool call
            {message.tool_calls.length === 1 ? "" : "s"}
          </p>
          <ul className="space-y-0.5">
            {message.tool_calls.map((tc, i) => (
              <ToolCallRow key={i} call={tc} defaultOpen={false} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
