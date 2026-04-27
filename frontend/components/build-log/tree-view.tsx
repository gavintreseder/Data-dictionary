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
  type MessageBlock,
  type ToolBlock,
  toolBlockCount,
} from "@/lib/build-log";
import type { Depth, RoleFilter } from "@/app/behind-the-scenes/page";

const DEPTH_RANK: Record<Depth, number> = {
  summary: 1,
  thinking: 2,
  doing: 3,
  code: 4,
};

const sessionKey = (sid: string) => `s/${sid}`;
const messageKey = (sid: string, mid: string) => `s/${sid}/m/${mid}`;
const blockKey = (sid: string, mid: string, i: number) =>
  `s/${sid}/m/${mid}/b/${i}`;

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

  const autoOpen = useMemo(() => {
    const open = new Set<string>();
    for (const s of log.sessions) {
      open.add(sessionKey(s.id));
      const visible = s.messages.filter(
        (m) => roleFilter === "all" || m.role === roleFilter
      );
      for (const m of visible) {
        if (rank >= 2) open.add(messageKey(s.id, m.id));
        if (rank >= 4 && m.blocks) {
          m.blocks.forEach((b, i) => {
            if (b.type === "tool") open.add(blockKey(s.id, m.id, i));
          });
        }
      }
    }
    return open;
  }, [log, rank, roleFilter]);

  const [openNodes, setOpenNodes] = useState<Set<string>>(autoOpen);
  useEffect(() => setOpenNodes(new Set(autoOpen)), [autoOpen]);

  const toggle = (k: string) => {
    setOpenNodes((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };
  const isOpen = (k: string) => openNodes.has(k);

  return (
    <div className="rounded-xl border bg-[var(--color-card)] p-2 font-mono text-sm">
      <ul>
        {log.sessions.map((s) => {
          const sk = sessionKey(s.id);
          const open = isOpen(sk);
          const visible = s.messages.filter(
            (m) => roleFilter === "all" || m.role === roleFilter
          );
          return (
            <li key={s.id}>
              <Row
                onClick={() => toggle(sk)}
                open={open}
                hasChildren={visible.length > 0}
                icon={
                  <FolderOpen className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
                }
              >
                <span className="font-medium">{s.title}</span>
                <span className="ml-2 text-[10px] text-[var(--color-muted-foreground)]">
                  {visible.length} msg{visible.length === 1 ? "" : "s"}
                </span>
              </Row>
              {open ? (
                <Branch>
                  {visible.length === 0 ? (
                    <p className="px-2 py-1 text-[11px] italic text-[var(--color-muted-foreground)]">
                      No messages match the current filter.
                    </p>
                  ) : (
                    visible.map((m) => (
                      <MessageNode
                        key={m.id}
                        sessionId={s.id}
                        message={m}
                        rank={rank}
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
  rank,
  isOpen,
  toggle,
}: {
  sessionId: string;
  message: BuildMessage;
  rank: number;
  isOpen: (k: string) => boolean;
  toggle: (k: string) => void;
}) {
  const mk = messageKey(sessionId, message.id);
  const open = isOpen(mk);
  const blocks = filterBlocks(message.blocks ?? [], rank);
  const hasChildren = blocks.length > 0;
  const tools = toolBlockCount(message);
  return (
    <li>
      <Row
        onClick={() => hasChildren && toggle(mk)}
        open={open}
        hasChildren={hasChildren}
        icon={<RolePill role={message.role} />}
      >
        <span className="flex-1 truncate text-xs font-sans">
          {message.summary}
        </span>
        {tools > 0 ? (
          <span className="shrink-0 rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] font-sans text-[var(--color-muted-foreground)]">
            {tools} tool{tools === 1 ? "" : "s"}
          </span>
        ) : null}
      </Row>
      {open ? (
        <Branch>
          {blocks.map((b, idx) => {
            // Find original index for stable key
            const origIdx = message.blocks!.indexOf(b);
            return b.type === "thinking" ? (
              <ThinkingNode key={idx} text={b.text} />
            ) : (
              <ToolNode
                key={idx}
                sessionId={sessionId}
                messageId={message.id}
                index={origIdx}
                tool={b}
                isOpen={isOpen}
                toggle={toggle}
              />
            );
          })}
        </Branch>
      ) : null}
    </li>
  );
}

function ThinkingNode({ text }: { text: string }) {
  // Show the first line as a leaf row; full text on hover/expanded view
  const first = text.split("\n").find((l) => l.trim()) ?? text;
  return (
    <li>
      <div className="flex items-start gap-1.5 px-2 py-1">
        <span className="w-3" />
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-purple-500" />
        <span className="text-xs font-sans leading-relaxed text-[var(--color-foreground)]">
          {first.length > 200 ? first.slice(0, 200) + "…" : first}
          {text !== first ? (
            <span className="ml-1 text-[10px] text-[var(--color-muted-foreground)]">
              ({text.length} chars)
            </span>
          ) : null}
        </span>
      </div>
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
  tool: ToolBlock;
  isOpen: (k: string) => boolean;
  toggle: (k: string) => void;
}) {
  const k = blockKey(sessionId, messageId, index);
  const open = isOpen(k);
  const hasCode = !!(tool.details || tool.result);
  return (
    <li>
      <Row
        onClick={() => hasCode && toggle(k)}
        open={open}
        hasChildren={hasCode}
        icon={<Wrench className="h-3 w-3 text-amber-500" />}
      >
        <span className="text-xs font-sans">
          <span className="font-mono font-medium">{tool.tool}</span>{" "}
          <span className="text-[var(--color-muted-foreground)]">·</span>{" "}
          <span className="text-[var(--color-muted-foreground)]">
            {tool.summary}
          </span>
        </span>
      </Row>
      {open && hasCode ? (
        <Branch>
          <div className="rounded-md border border-[var(--color-border)]/60 bg-[var(--color-muted)]/30 p-2">
            <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              <CodeIcon className="h-3 w-3" /> Code
            </div>
            {tool.details ? (
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-[var(--color-foreground)]">
                {tool.details}
              </pre>
            ) : null}
            {tool.result ? (
              <pre className="mt-2 whitespace-pre-wrap break-words border-t border-[var(--color-border)]/60 pt-2 font-mono text-[11px] text-[var(--color-muted-foreground)]">
                {tool.result}
              </pre>
            ) : null}
          </div>
        </Branch>
      ) : null}
    </li>
  );
}

function filterBlocks(blocks: MessageBlock[], rank: number): MessageBlock[] {
  if (rank <= 1) return [];
  if (rank === 2) return blocks.filter((b) => b.type === "thinking");
  return blocks;
}

function Row({
  onClick,
  open,
  hasChildren,
  icon,
  children,
}: {
  onClick: () => void;
  open: boolean;
  hasChildren: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
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
