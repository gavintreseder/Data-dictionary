"use client";

import {
  ChevronRight,
  Code as CodeIcon,
  FolderOpen,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { RolePill } from "@/components/build-log/role-pill";
import { cn } from "@/lib/utils";
import {
  type BuildLog,
  type BuildMessage,
  type BuildSession,
  type ToolCall,
  messageToolCount,
} from "@/lib/build-log";
import type { Depth, RoleFilter } from "@/app/behind-the-scenes/page";

const DEPTH_RANK: Record<Depth, number> = {
  summary: 1,
  thinking: 2,
  doing: 3,
  code: 4,
};

// Node id helpers — each level encodes a unique key
const sessionKey = (sid: string) => `s/${sid}`;
const messageKey = (sid: string, mid: string) => `s/${sid}/m/${mid}`;
const thinkingKey = (sid: string, mid: string) =>
  `s/${sid}/m/${mid}/thinking`;
const doingKey = (sid: string, mid: string) => `s/${sid}/m/${mid}/doing`;
const toolKey = (sid: string, mid: string, i: number) =>
  `s/${sid}/m/${mid}/doing/t/${i}`;

export function TreeView({
  log,
  depth,
  roleFilter,
}: {
  log: BuildLog;
  depth: Depth;
  roleFilter: RoleFilter;
}) {
  const rank = DEPTH_RANK[depth];

  // Compute the auto-expanded set based on depth + role filter
  const autoOpen = useMemo(() => {
    const open = new Set<string>();
    for (const s of log.sessions) {
      // Always auto-open sessions so messages are visible
      open.add(sessionKey(s.id));
      const visibleMessages = s.messages.filter(
        (m) => roleFilter === "all" || m.role === roleFilter
      );
      for (const m of visibleMessages) {
        // Level 2 — open the message node so Thinking/Doing become visible
        if (rank >= 2) open.add(messageKey(s.id, m.id));
        // Level 2 — open the Thinking child if there is content
        if (rank >= 2 && m.content) open.add(thinkingKey(s.id, m.id));
        // Level 3 — open the Doing child so tools are listed
        if (rank >= 3 && m.tool_calls?.length) open.add(doingKey(s.id, m.id));
        // Level 4 — open every tool node so its Code child shows
        if (rank >= 4 && m.tool_calls?.length) {
          m.tool_calls.forEach((_, i) => open.add(toolKey(s.id, m.id, i)));
        }
      }
    }
    return open;
  }, [log, rank, roleFilter]);

  const [openNodes, setOpenNodes] = useState<Set<string>>(autoOpen);

  // Resync when filter/depth changes
  useEffect(() => {
    setOpenNodes(new Set(autoOpen));
  }, [autoOpen]);

  const toggle = (key: string) => {
    setOpenNodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const isOpen = (key: string) => openNodes.has(key);

  return (
    <div className="rounded-xl border bg-[var(--color-card)] p-2 font-mono text-sm">
      <ul>
        {log.sessions.map((s) => {
          const visibleMessages = s.messages.filter(
            (m) => roleFilter === "all" || m.role === roleFilter
          );
          const sKey = sessionKey(s.id);
          const open = isOpen(sKey);
          return (
            <li key={s.id}>
              <Row
                onClick={() => toggle(sKey)}
                open={open}
                hasChildren={visibleMessages.length > 0}
                icon={<FolderOpen className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />}
                ariaExpanded={open}
              >
                <span className="font-medium">{s.title}</span>
                <span className="ml-2 text-[10px] text-[var(--color-muted-foreground)]">
                  {visibleMessages.length} msg
                  {visibleMessages.length === 1 ? "" : "s"}
                </span>
              </Row>
              {open ? (
                <Branch>
                  {visibleMessages.length === 0 ? (
                    <p className="px-2 py-1 text-[11px] italic text-[var(--color-muted-foreground)]">
                      No messages match the current filter.
                    </p>
                  ) : (
                    visibleMessages.map((m) => (
                      <MessageNode
                        key={m.id}
                        sessionId={s.id}
                        message={m}
                        isOpen={isOpen}
                        toggle={toggle}
                      />
                    ))
                  )}
                </Branch>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MessageNode({
  sessionId,
  message,
  isOpen,
  toggle,
}: {
  sessionId: string;
  message: BuildMessage;
  isOpen: (k: string) => boolean;
  toggle: (k: string) => void;
}) {
  const mKey = messageKey(sessionId, message.id);
  const open = isOpen(mKey);
  const hasThinking = !!message.content;
  const hasDoing = !!message.tool_calls?.length;
  const hasChildren = hasThinking || hasDoing;

  return (
    <li>
      <Row
        onClick={() => hasChildren && toggle(mKey)}
        open={open}
        hasChildren={hasChildren}
        icon={<RolePill role={message.role} />}
        ariaExpanded={open}
      >
        <span className="flex-1 truncate text-xs font-sans">
          {message.summary}
        </span>
        {messageToolCount(message) > 0 ? (
          <span className="shrink-0 rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] font-sans text-[var(--color-muted-foreground)]">
            {messageToolCount(message)} tools
          </span>
        ) : null}
      </Row>
      {open ? (
        <Branch>
          {hasThinking ? (
            <ThinkingNode
              sessionId={sessionId}
              messageId={message.id}
              content={message.content!}
              isOpen={isOpen}
              toggle={toggle}
            />
          ) : null}
          {hasDoing ? (
            <DoingNode
              sessionId={sessionId}
              messageId={message.id}
              tools={message.tool_calls!}
              isOpen={isOpen}
              toggle={toggle}
            />
          ) : null}
        </Branch>
      ) : null}
    </li>
  );
}

function ThinkingNode({
  sessionId,
  messageId,
  content,
  isOpen,
  toggle,
}: {
  sessionId: string;
  messageId: string;
  content: string;
  isOpen: (k: string) => boolean;
  toggle: (k: string) => void;
}) {
  const k = thinkingKey(sessionId, messageId);
  const open = isOpen(k);
  return (
    <li>
      <Row
        onClick={() => toggle(k)}
        open={open}
        hasChildren
        icon={<Sparkles className="h-3 w-3 text-purple-500" />}
        ariaExpanded={open}
      >
        <span className="text-xs font-sans uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Thinking
        </span>
      </Row>
      {open ? (
        <Branch>
          <p className="whitespace-pre-wrap rounded-md bg-[var(--color-muted)]/40 p-2 text-xs font-sans text-[var(--color-muted-foreground)]">
            {content}
          </p>
        </Branch>
      ) : null}
    </li>
  );
}

function DoingNode({
  sessionId,
  messageId,
  tools,
  isOpen,
  toggle,
}: {
  sessionId: string;
  messageId: string;
  tools: ToolCall[];
  isOpen: (k: string) => boolean;
  toggle: (k: string) => void;
}) {
  const k = doingKey(sessionId, messageId);
  const open = isOpen(k);
  return (
    <li>
      <Row
        onClick={() => toggle(k)}
        open={open}
        hasChildren
        icon={<Wrench className="h-3 w-3 text-amber-500" />}
        ariaExpanded={open}
      >
        <span className="text-xs font-sans uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Doing · {tools.length} tool{tools.length === 1 ? "" : "s"}
        </span>
      </Row>
      {open ? (
        <Branch>
          {tools.map((tc, i) => (
            <ToolNode
              key={i}
              sessionId={sessionId}
              messageId={messageId}
              index={i}
              tool={tc}
              isOpen={isOpen}
              toggle={toggle}
            />
          ))}
        </Branch>
      ) : null}
    </li>
  );
}

function ToolNode({
  sessionId,
  messageId,
  index,
  tool,
  isOpen,
  toggle,
}: {
  sessionId: string;
  messageId: string;
  index: number;
  tool: ToolCall;
  isOpen: (k: string) => boolean;
  toggle: (k: string) => void;
}) {
  const k = toolKey(sessionId, messageId, index);
  const open = isOpen(k);
  const hasCode = !!(tool.details || tool.result);
  return (
    <li>
      <Row
        onClick={() => hasCode && toggle(k)}
        open={open}
        hasChildren={hasCode}
        icon={<Wrench className="h-3 w-3 text-[var(--color-muted-foreground)]" />}
        ariaExpanded={open}
      >
        <span className="text-xs font-sans">
          <span className="font-mono font-medium">{tool.tool}</span>{" "}
          <span className="text-[var(--color-muted-foreground)]">·</span>{" "}
          {tool.summary}
        </span>
      </Row>
      {open && hasCode ? (
        <Branch>
          <CodeBlock tool={tool} />
        </Branch>
      ) : null}
    </li>
  );
}

function CodeBlock({ tool }: { tool: ToolCall }) {
  return (
    <div className="rounded-md border border-[var(--color-border)]/60 bg-[var(--color-muted)]/30 p-2 text-[11px] leading-relaxed">
      <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <CodeIcon className="h-3 w-3" />
        Code
      </div>
      {tool.details ? (
        <pre className="whitespace-pre-wrap break-words font-mono text-[var(--color-muted-foreground)]">
          {tool.details}
        </pre>
      ) : null}
      {tool.result ? (
        <pre className="mt-2 whitespace-pre-wrap break-words border-t border-[var(--color-border)]/60 pt-2 font-mono text-[var(--color-muted-foreground)]">
          {tool.result}
        </pre>
      ) : null}
    </div>
  );
}

function Row({
  onClick,
  open,
  hasChildren,
  icon,
  ariaExpanded,
  children,
}: {
  onClick: () => void;
  open: boolean;
  hasChildren: boolean;
  icon: React.ReactNode;
  ariaExpanded: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={ariaExpanded}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left",
        hasChildren ? "hover:bg-[var(--color-muted)]" : "cursor-default"
      )}
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
      {icon}
      {children}
    </button>
  );
}

function Branch({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-3 border-l border-[var(--color-border)]/60 pl-3">
      {children}
    </ul>
  );
}
