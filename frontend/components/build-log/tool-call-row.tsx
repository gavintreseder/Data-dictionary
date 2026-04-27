"use client";

import { ChevronRight, Wrench } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { ToolCall } from "@/lib/build-log";

const TOOL_ACCENTS: Record<string, string> = {
  Bash: "text-emerald-500",
  Edit: "text-blue-500",
  Write: "text-purple-500",
  Read: "text-sky-500",
  Agent: "text-amber-500",
  WebFetch: "text-rose-500",
};

export function ToolCallRow({
  call,
  defaultOpen = false,
  forceOpen,
}: {
  call: ToolCall;
  defaultOpen?: boolean;
  forceOpen?: boolean | null;
}) {
  const [openLocal, setOpenLocal] = useState(defaultOpen);
  const open = forceOpen ?? openLocal;
  const hasDetails = !!(call.details || call.result);
  const accent =
    Object.entries(TOOL_ACCENTS).find(([k]) =>
      call.tool.toLowerCase().includes(k.toLowerCase())
    )?.[1] ?? "text-[var(--color-muted-foreground)]";

  return (
    <li className="group">
      <button
        type="button"
        onClick={() => hasDetails && setOpenLocal((o) => !o)}
        className={cn(
          "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
          hasDetails
            ? "cursor-pointer hover:bg-[var(--color-muted)]"
            : "cursor-default"
        )}
        aria-expanded={open}
      >
        {hasDetails ? (
          <ChevronRight
            className={cn(
              "mt-0.5 h-3 w-3 shrink-0 text-[var(--color-muted-foreground)] transition-transform",
              open && "rotate-90"
            )}
          />
        ) : (
          <span className="w-3" />
        )}
        <Wrench className={cn("mt-0.5 h-3 w-3 shrink-0", accent)} />
        <span className="flex-1 leading-snug">
          <span className={cn("font-mono font-medium", accent)}>{call.tool}</span>{" "}
          <span className="text-[var(--color-muted-foreground)]">·</span>{" "}
          <span>{call.summary}</span>
        </span>
      </button>
      {open && hasDetails ? (
        <div className="ml-5 mt-1 rounded-md border border-[var(--color-border)]/60 bg-[var(--color-muted)]/30 p-2 text-[11px] leading-relaxed text-[var(--color-muted-foreground)]">
          {call.details ? (
            <pre className="whitespace-pre-wrap break-words font-mono">
              {call.details}
            </pre>
          ) : null}
          {call.result ? (
            <pre className="mt-2 whitespace-pre-wrap break-words border-t border-[var(--color-border)]/60 pt-2 font-mono">
              {call.result}
            </pre>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
