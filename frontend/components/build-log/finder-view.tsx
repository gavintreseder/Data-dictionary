"use client";

import { ChevronRight, Code as CodeIcon, Sparkles, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RolePill } from "@/components/build-log/role-pill";
import { cn } from "@/lib/utils";
import {
  type BuildLog,
  type BuildMessage,
  type ToolCall,
  messageToolCount,
  totalToolCalls,
} from "@/lib/build-log";
import type { Depth, RoleFilter } from "@/app/behind-the-scenes/page";

type Section = "thinking" | "doing";

const DEPTH_RANK: Record<Depth, number> = {
  summary: 1,
  thinking: 2,
  doing: 3,
  code: 4,
};

export function FinderView({
  log,
  depth,
  roleFilter,
}: {
  log: BuildLog;
  depth: Depth;
  roleFilter: RoleFilter;
}) {
  const rank = DEPTH_RANK[depth];

  const [sessionId, setSessionId] = useState<string | undefined>(
    log.sessions[0]?.id
  );
  const [messageId, setMessageId] = useState<string | undefined>();
  const [section, setSection] = useState<Section | undefined>();
  const [toolIdx, setToolIdx] = useState<number | undefined>();

  const session = useMemo(
    () => log.sessions.find((s) => s.id === sessionId),
    [log, sessionId]
  );

  const visibleMessages = useMemo(
    () =>
      session?.messages.filter(
        (m) => roleFilter === "all" || m.role === roleFilter
      ) ?? [],
    [session, roleFilter]
  );

  const message = useMemo(
    () => visibleMessages.find((m) => m.id === messageId),
    [visibleMessages, messageId]
  );

  const tool: ToolCall | undefined =
    message && toolIdx !== undefined ? message.tool_calls?.[toolIdx] : undefined;

  // Snap message selection back to the first visible message if the current
  // one is filtered out.
  useEffect(() => {
    if (!visibleMessages.length) {
      setMessageId(undefined);
      return;
    }
    if (!message) setMessageId(visibleMessages[0].id);
  }, [visibleMessages, message]);

  // Auto-drill to the depth level when the global filter changes.
  useEffect(() => {
    if (!message) return;
    if (rank >= 4 && message.tool_calls?.length) {
      setSection("doing");
      setToolIdx(0);
    } else if (rank >= 3 && message.tool_calls?.length) {
      setSection("doing");
      setToolIdx(undefined);
    } else if (rank >= 2 && message.content) {
      setSection("thinking");
      setToolIdx(undefined);
    } else {
      setSection(undefined);
      setToolIdx(undefined);
    }
  }, [rank, message]);

  // When the user picks a new message, snap section back to whatever the
  // current depth implies.
  useEffect(() => {
    setToolIdx(undefined);
  }, [messageId]);

  const hasThinking = !!message?.content;
  const hasDoing = !!message?.tool_calls?.length;

  const showSectionsCol = !!message;
  const showSectionDetailCol = showSectionsCol && !!section;
  const showCodeCol = showSectionDetailCol && section === "doing" && tool !== undefined;

  return (
    <div className="overflow-x-auto rounded-xl border bg-[var(--color-card)]">
      <div className="flex h-[640px] min-w-max">
        {/* Col 1 — Sessions */}
        <Column title="Sessions" widthClass="w-56">
          <ul>
            {log.sessions.map((s) => {
              const visible = s.messages.filter(
                (m) => roleFilter === "all" || m.role === roleFilter
              );
              return (
                <FinderItem
                  key={s.id}
                  active={s.id === sessionId}
                  onClick={() => {
                    setSessionId(s.id);
                    setMessageId(undefined);
                  }}
                  title={s.title}
                  hint={`${visible.length} msgs · ${totalToolCalls(s)} tools`}
                  showChevron
                />
              );
            })}
          </ul>
        </Column>

        {/* Col 2 — Messages (Summary list) */}
        <Column title="Summary" widthClass="w-80">
          {visibleMessages.length === 0 ? (
            <Empty>No messages match the current filter.</Empty>
          ) : (
            <ul>
              {visibleMessages.map((m) => (
                <FinderItem
                  key={m.id}
                  active={m.id === messageId}
                  onClick={() => setMessageId(m.id)}
                  title={m.summary}
                  role={m.role}
                  hint={
                    messageToolCount(m) > 0
                      ? `${messageToolCount(m)} tool${
                          messageToolCount(m) === 1 ? "" : "s"
                        }`
                      : undefined
                  }
                  showChevron
                />
              ))}
            </ul>
          )}
        </Column>

        {/* Col 3 — Sections of selected message: Thinking + Doing */}
        {showSectionsCol ? (
          <Column title="Sections" widthClass="w-64">
            {!hasThinking && !hasDoing ? (
              <Empty>This message has no thinking or doing content.</Empty>
            ) : (
              <ul>
                {hasThinking ? (
                  <FinderItem
                    active={section === "thinking"}
                    onClick={() => {
                      setSection("thinking");
                      setToolIdx(undefined);
                    }}
                    title="Thinking"
                    hint="raw text"
                    icon={<Sparkles className="h-3 w-3 text-purple-500" />}
                    showChevron
                  />
                ) : null}
                {hasDoing ? (
                  <FinderItem
                    active={section === "doing"}
                    onClick={() => {
                      setSection("doing");
                      setToolIdx(undefined);
                    }}
                    title={`Doing · ${message!.tool_calls!.length} tool${
                      message!.tool_calls!.length === 1 ? "" : "s"
                    }`}
                    icon={<Wrench className="h-3 w-3 text-amber-500" />}
                    showChevron
                  />
                ) : null}
              </ul>
            )}
          </Column>
        ) : null}

        {/* Col 4 — Section detail (thinking text OR list of tools) */}
        {showSectionDetailCol && section === "thinking" && message?.content ? (
          <Column title="Thinking" widthClass="w-[26rem]" flush>
            <div className="p-3">
              <p className="whitespace-pre-wrap text-sm text-[var(--color-muted-foreground)]">
                {message.content}
              </p>
            </div>
          </Column>
        ) : null}

        {showSectionDetailCol && section === "doing" && message?.tool_calls?.length ? (
          <Column title="Doing" widthClass="w-80">
            <ul>
              {message.tool_calls.map((tc, i) => (
                <FinderItem
                  key={i}
                  active={toolIdx === i}
                  onClick={() => setToolIdx(i)}
                  title={tc.summary}
                  hint={tc.tool}
                  icon={<Wrench className="h-3 w-3 text-[var(--color-muted-foreground)]" />}
                  showChevron={!!(tc.details || tc.result)}
                />
              ))}
            </ul>
          </Column>
        ) : null}

        {/* Col 5 — Code (selected tool's command/result) */}
        {showCodeCol && tool ? (
          <Column title="Code" widthClass="w-[26rem]" flush>
            <div className="space-y-3 p-3 text-xs">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <CodeIcon className="h-3 w-3" />
                {tool.tool}
              </div>
              <p className="text-sm">{tool.summary}</p>
              {tool.details ? (
                <pre className="whitespace-pre-wrap break-words rounded-md border border-[var(--color-border)]/60 bg-[var(--color-muted)]/30 p-2 font-mono text-[11px] text-[var(--color-muted-foreground)]">
                  {tool.details}
                </pre>
              ) : null}
              {tool.result ? (
                <pre className="whitespace-pre-wrap break-words rounded-md border border-[var(--color-border)]/60 bg-[var(--color-muted)]/30 p-2 font-mono text-[11px] text-[var(--color-muted-foreground)]">
                  {tool.result}
                </pre>
              ) : null}
              {!tool.details && !tool.result ? (
                <p className="rounded-md border border-dashed bg-[var(--color-muted)]/30 p-2 text-[11px] italic text-[var(--color-muted-foreground)]">
                  No command detail captured for this tool call.
                </p>
              ) : null}
            </div>
          </Column>
        ) : null}
      </div>
    </div>
  );
}

function Column({
  title,
  children,
  widthClass,
  flush,
}: {
  title: string;
  children: React.ReactNode;
  widthClass: string;
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col border-r border-[var(--color-border)] last:border-r-0",
        widthClass
      )}
    >
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
  icon,
  showChevron,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  role?: BuildMessage["role"];
  icon?: React.ReactNode;
  showChevron?: boolean;
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
        {role ? <RolePill role={role} /> : icon ?? null}
        <span className="flex-1 truncate">{title}</span>
        {hint ? (
          <span className="shrink-0 text-[10px] text-[var(--color-muted-foreground)]">
            {hint}
          </span>
        ) : null}
        {showChevron ? (
          <ChevronRight className="h-3 w-3 text-[var(--color-muted-foreground)]" />
        ) : null}
      </button>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-4 text-xs italic text-[var(--color-muted-foreground)]">
      {children}
    </p>
  );
}
