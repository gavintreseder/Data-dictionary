"use client";

import {
  Archive,
  CheckCircle2,
  CircleAlert,
  FileText,
  Flag,
  Plus,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  Wand2,
} from "lucide-react";
import type { ComponentType } from "react";

import type { AuditEvent, AuditKind } from "@/lib/types";
import { cn, formatRelative } from "@/lib/utils";

const ICONS: Record<AuditKind, ComponentType<{ className?: string }>> = {
  created: Plus,
  updated: CheckCircle2,
  flag_changed: Flag,
  definition_added: Sparkles,
  definition_removed: Trash2,
  refined: Wand2,
  tagged: TagIcon,
  imported: FileText,
};

const COLORS: Record<AuditKind, string> = {
  created: "text-emerald-500",
  updated: "text-blue-500",
  flag_changed: "text-amber-500",
  definition_added: "text-purple-500",
  definition_removed: "text-rose-500",
  refined: "text-amber-500",
  tagged: "text-sky-500",
  imported: "text-emerald-500",
};

export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-xs text-[var(--color-muted-foreground)]">
        No activity yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-3 pl-6">
      <span className="absolute left-2 top-2 bottom-2 w-px bg-[var(--color-border)]" />
      {events.map((e) => {
        const Icon = ICONS[e.kind] || CircleAlert;
        return (
          <li key={e.id} className="relative">
            <span
              className={cn(
                "absolute -left-4 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-[var(--color-background)]",
                COLORS[e.kind]
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm">{e.summary}</p>
              <p className="text-[11px] text-[var(--color-muted-foreground)]">
                {formatRelative(e.created_at)} · {e.kind.replace("_", " ")}
              </p>
            </div>
          </li>
        );
      })}
      <Archive className="hidden" />
    </ol>
  );
}
