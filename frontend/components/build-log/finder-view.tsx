"use client";

import {
  ChevronRight,
  Code as CodeIcon,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RolePill } from "@/components/build-log/role-pill";
import { cn } from "@/lib/utils";
import {
  type BuildLog,
  type BuildMessage,
  type ThinkingBlock,
  type ToolBlock,
  toolBlockCount,
  totalToolCalls,
} from "@/lib/build-log";
import type { Depth, RoleFilter } from "@/app/behind-the-scenes/page";

const DEPTH_RANK: Record<Depth, number> = {
  summary: 1,
  thinking: 2,
  doing: 3,
  code: 4,
};

type Selection =
  | { kind: "thinking"; origIdx: number }
  | { kind: "tool"; origIdx: number };

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
  const [selection, setSelection] = useState<Selection | undefined>();

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

  // Split the message's blocks into two parallel lists, preserving
  // their original index so we can pull the right block for the detail
  // pane.
  const thinkingBlocks = useMemo(() => {
    if (!message?.blocks) return [];
    return message.blocks
      .map((b, origIdx) => ({ block: b, origIdx }))
      .filter(
        (entry): entry is { block: ThinkingBlock; origIdx: number } =>
          entry.block.type === "thinking"
      );
  }, [message]);

  const toolBlocks = useMemo(() => {
    if (!message?.blocks) return [];
    return message.blocks
      .map((b, origIdx) => ({ block: b, origIdx }))
      .filter(
        (entry): entry is { block: ToolBlock; origIdx: number } =>
          entry.block.type === "tool"
      );
  }, [message]);

  const selectedBlock = useMemo(() => {
    if (!message?.blocks || !selection) return undefined;
    return message.blocks[selection.origIdx];
  }, [message, selection]);

  // Snap message to first visible when filter/session changes
  useEffect(() => {
    if (!visibleMessages.length) {
      setMessageId(undefined);
      return;
    }
    if (!message) setMessageId(visibleMessages[0].id);
  }, [visibleMessages, message]);

  // Reset block selection when message changes
  useEffect(() => {
    setSelection(undefined);
  }, [messageId]);

  // Auto-drill the selection based on the depth filter:
  //   L1 Summary  → no selection (just sessions + messages visible)
  //   L2 Thinking → select first thinking block
  //   L3 Doing    → select first tool block (collapsed code)
  //   L4 Code     → select first tool block (code visible)
  useEffect(() => {
    if (!message) return;
    if (rank <= 1) {
      setSelection(undefined);
      return;
    }
    if (rank === 2 && thinkingBlocks.length) {
      setSelection({ kind: "thinking", origIdx: thinkingBlocks[0].origIdx });
      return;
    }
    if (rank >= 3 && toolBlocks.length) {
      setSelection({ kind: "tool", origIdx: toolBlocks[0].origIdx });
      return;
    }
    if (rank >= 2 && thinkingBlocks.length) {
      setSelection({ kind: "thinking", origIdx: thinkingBlocks[0].origIdx });
    }
  }, [rank, message, thinkingBlocks, toolBlocks]);

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

        {/* Col 2 — Messages */}
        <Column title="Messages" widthClass="w-80">
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
                    toolBlockCount(m) > 0
                      ? `${toolBlockCount(m)} tool${
                          toolBlockCount(m) === 1 ? "" : "s"
                        }`
                      : undefined
                  }
                  showChevron={(m.blocks?.length ?? 0) > 0}
                />
              ))}
            </ul>
          )}
        </Column>

        {/* Col 3 — Thinking blocks */}
        {message ? (
          <Column title="Thinking" widthClass="w-72">
            {thinkingBlocks.length === 0 ? (
              <Empty>No thinking blocks.</Empty>
            ) : (
              <ul>
                {thinkingBlocks.map(({ block, origIdx }) => (
                  <FinderItem
                    key={origIdx}
                    active={
                      selection?.kind === "thinking" &&
                      selection.origIdx === origIdx
                    }
                    onClick={() => setSelection({ kind: "thinking", origIdx })}
                    title={firstLine(block.text)}
                    icon={
                      <Sparkles className="h-3 w-3 shrink-0 text-purple-500" />
                    }
                    hint={`#${origIdx + 1}`}
                    showChevron
                  />
                ))}
              </ul>
            )}
          </Column>
        ) : null}

        {/* Col 4 — Doing (tool blocks) */}
        {message ? (
          <Column title="Doing" widthClass="w-72">
            {toolBlocks.length === 0 ? (
              <Empty>No tool calls.</Empty>
            ) : (
              <ul>
                {toolBlocks.map(({ block, origIdx }) => (
                  <FinderItem
                    key={origIdx}
                    active={
                      selection?.kind === "tool" &&
                      selection.origIdx === origIdx
                    }
                    onClick={() => setSelection({ kind: "tool", origIdx })}
                    title={block.summary || block.tool}
                    icon={
                      <Wrench className="h-3 w-3 shrink-0 text-amber-500" />
                    }
                    hint={block.tool}
                    showChevron={!!(block.details || block.result)}
                  />
                ))}
              </ul>
            )}
          </Column>
        ) : null}

        {/* Col 5 — Detail */}
        {selectedBlock ? (
          <Column
            title={selectedBlock.type === "thinking" ? "Text" : "Code"}
            widthClass="w-[28rem]"
            flush
          >
            {selectedBlock.type === "thinking" ? (
              <div className="p-3">
                <p className="whitespace-pre-wrap text-sm text-[var(--color-foreground)]">
                  {selectedBlock.text}
                </p>
              </div>
            ) : (
              <ToolDetail tool={selectedBlock} />
            )}
          </Column>
        ) : null}
      </div>
    </div>
  );
}

function firstLine(s: string): string {
  const line = s.split("\n").find((l) => l.trim()) ?? s;
  return line.length > 100 ? line.slice(0, 100) + "…" : line;
}

function ToolDetail({ tool }: { tool: ToolBlock }) {
  return (
    <div className="space-y-3 p-3 text-xs">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <CodeIcon className="h-3 w-3" />
        {tool.tool}
      </div>
      <p className="text-sm">{tool.summary}</p>
      {tool.details ? (
        <pre className="whitespace-pre-wrap break-words rounded-md border border-[var(--color-border)]/60 bg-[var(--color-muted)]/30 p-2 font-mono text-[11px] text-[var(--color-foreground)]">
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
