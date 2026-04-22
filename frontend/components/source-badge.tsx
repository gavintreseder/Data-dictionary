import { BookMarked, FileText, Globe, Sparkles, Users } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import type { Source } from "@/lib/types";

interface Style {
  bg: string;
  text: string;
  border: string;
  Icon: ComponentType<{ className?: string }>;
}

const STYLES: Record<string, Style> = {
  "merriam-webster": {
    bg: "bg-blue-500/10",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
    Icon: BookMarked,
  },
  "free-dictionary": {
    bg: "bg-emerald-500/10",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
    Icon: Globe,
  },
  business: {
    bg: "bg-purple-500/10",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
    Icon: Users,
  },
  llm: {
    bg: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30",
    Icon: Sparkles,
  },
  pdf: {
    bg: "bg-rose-500/10",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-500/30",
    Icon: FileText,
  },
};

const DEFAULT_STYLE: Style = {
  bg: "bg-neutral-500/10",
  text: "text-neutral-700 dark:text-neutral-300",
  border: "border-neutral-500/30",
  Icon: Globe,
};

export function SourceBadge({
  source,
  className,
}: {
  source: Source;
  className?: string;
}) {
  const style = STYLES[source.slug] || DEFAULT_STYLE;
  const { Icon } = style;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        style.bg,
        style.text,
        style.border,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {source.name}
    </span>
  );
}
