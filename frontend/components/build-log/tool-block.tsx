"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { ToolBlock as ToolBlockData } from "@/lib/build-log";

const TOOL_VERBS: Record<string, string> = {
  Bash: "Ran",
  Edit: "Edited",
  MultiEdit: "Edited",
  Write: "Created",
  Read: "Read",
  Grep: "Searched",
  Glob: "Globbed",
  Task: "Launched agent",
  WebFetch: "Fetched",
  WebSearch: "Searched the web",
  TodoWrite: "Updated todos",
  AskUserQuestion: "Asked",
  ExitPlanMode: "Submitted plan",
};

const TOOL_TINTS: Record<string, string> = {
  Bash: "text-emerald-600 dark:text-emerald-400",
  Edit: "text-blue-600 dark:text-blue-400",
  MultiEdit: "text-blue-600 dark:text-blue-400",
  Write: "text-purple-600 dark:text-purple-400",
  Read: "text-sky-600 dark:text-sky-400",
  Task: "text-amber-600 dark:text-amber-400",
  WebFetch: "text-rose-600 dark:text-rose-400",
};

export function ToolBlockView({
  block,
  forceOpen,
}: {
  block: ToolBlockData;
  forceOpen?: boolean | null;
}) {
  const [openLocal, setOpenLocal] = useState(false);
  const open = forceOpen ?? openLocal;
  // Keep local in sync when the global toggle changes — so toggling back to
  // null (per-item control) preserves the last global state until the user
  // clicks.
  useEffect(() => {
    if (typeof forceOpen === "boolean") setOpenLocal(forceOpen);
  }, [forceOpen]);

  const hasCode = !!(block.details || block.result);
  const verb = TOOL_VERBS[block.tool] ?? block.tool;
  const tint = TOOL_TINTS[block.tool] ?? "text-[var(--color-muted-foreground)]";

  return (
    <div className="group">
      <button
        type="button"
        onClick={() => hasCode && setOpenLocal((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[13px]",
          hasCode
            ? "cursor-pointer hover:bg-[var(--color-muted)]/50"
            : "cursor-default"
        )}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 shrink-0 text-[var(--color-muted-foreground)]/60 transition-transform",
            open && "rotate-90",
            !hasCode && "opacity-0"
          )}
        />
        <span className="text-[var(--color-muted-foreground)]">{verb}</span>
        <span className={cn("font-mono text-[12px]", tint)}>
          {block.summary}
        </span>
      </button>
      {open && hasCode ? (
        <div className="mb-2 ml-5 mt-1 overflow-hidden rounded-md border border-[var(--color-border)]/60 bg-[var(--color-muted)]/30">
          {block.details ? (
            <pre className="overflow-x-auto whitespace-pre-wrap break-words p-2 font-mono text-[11px] leading-relaxed text-[var(--color-foreground)]">
              {block.details}
            </pre>
          ) : null}
          {block.result ? (
            <pre className="overflow-x-auto whitespace-pre-wrap break-words border-t border-[var(--color-border)]/60 p-2 font-mono text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
              {block.result}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
