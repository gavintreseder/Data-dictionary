"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { ToolBlockView } from "@/components/build-log/tool-block";
import { RolePill } from "@/components/build-log/role-pill";
import { cn } from "@/lib/utils";
import type {
  BuildLog,
  BuildMessage,
  BuildSession,
  MessageBlock,
} from "@/lib/build-log";
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
  const rank = DEPTH_RANK[depth];
  const isUser = message.role === "user";
  const hasBody = (message.blocks?.length ?? 0) > 0;

  // Body open = depth >= L2 (Thinking), with a per-card override.
  const [bodyOpen, setBodyOpen] = useState(rank >= 2);
  useEffect(() => {
    setBodyOpen(rank >= 2);
  }, [rank]);

  const sideBorder = isUser
    ? "border-l-4 border-blue-500/40"
    : "border-l-4 border-purple-500/40";

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
        {/* Card header: summary + collapse chevron */}
        <header className="flex items-start gap-2">
          <RolePill role={message.role} />
          <p className="flex-1 text-sm leading-snug">{message.summary}</p>
          {hasBody ? (
            <button
              type="button"
              onClick={() => setBodyOpen((o) => !o)}
              aria-expanded={bodyOpen}
              className="shrink-0 rounded-md p-0.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
              title={bodyOpen ? "Collapse" : "Expand"}
            >
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  bodyOpen && "rotate-90"
                )}
              />
            </button>
          ) : null}
        </header>

        {/* Body: chronological stream of blocks, filtered by depth.
            - L1 Summary: hidden
            - L2 Thinking: only thinking blocks
            - L3 Doing: thinking + tool grey lines (code collapsed)
            - L4 Code: thinking + tool grey lines (code auto-expanded) */}
        {hasBody && bodyOpen ? (
          <div className="mt-3 space-y-2 border-t border-[var(--color-border)]/40 pt-3">
            {filterBlocks(message.blocks!, rank).map((b, i) => (
              <BlockView key={i} block={b} rank={rank} />
            ))}
          </div>
        ) : null}
      </motion.article>
    </li>
  );
}

function filterBlocks(blocks: MessageBlock[], rank: number): MessageBlock[] {
  if (rank <= 1) return [];
  if (rank === 2) return blocks.filter((b) => b.type === "thinking");
  return blocks; // L3, L4 — show everything
}

function BlockView({ block, rank }: { block: MessageBlock; rank: number }) {
  if (block.type === "thinking") {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-foreground)]">
        {block.text}
      </p>
    );
  }
  return <ToolBlockView block={block} forceOpen={rank >= 4 ? true : null} />;
}
