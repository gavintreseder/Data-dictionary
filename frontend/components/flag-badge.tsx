import { Archive, CheckCircle2, CircleAlert, CircleDashed, Flag } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import type { FlagStatus } from "@/lib/types";

interface FlagMeta {
  label: string;
  dot: string;
  ring: string;
  text: string;
  Icon: ComponentType<{ className?: string }>;
}

const META: Record<FlagStatus, FlagMeta> = {
  none: {
    label: "Unflagged",
    dot: "bg-neutral-400",
    ring: "ring-neutral-300/30",
    text: "text-[var(--color-muted-foreground)]",
    Icon: CircleDashed,
  },
  needs_review: {
    label: "Needs review",
    dot: "bg-amber-500",
    ring: "ring-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    Icon: Flag,
  },
  approved: {
    label: "Approved",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
  disputed: {
    label: "Disputed",
    dot: "bg-rose-500",
    ring: "ring-rose-500/20",
    text: "text-rose-700 dark:text-rose-300",
    Icon: CircleAlert,
  },
  archived: {
    label: "Archived",
    dot: "bg-slate-500",
    ring: "ring-slate-500/20",
    text: "text-slate-600 dark:text-slate-300",
    Icon: Archive,
  },
};

export function FlagBadge({
  flag,
  className,
  compact = false,
}: {
  flag: FlagStatus;
  className?: string;
  compact?: boolean;
}) {
  const meta = META[flag];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ring-2",
        meta.ring,
        meta.text,
        "border-[var(--color-border)]",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {compact ? null : meta.label}
    </span>
  );
}

export const FLAG_LABELS = Object.fromEntries(
  (Object.keys(META) as FlagStatus[]).map((k) => [k, META[k].label])
) as Record<FlagStatus, string>;
