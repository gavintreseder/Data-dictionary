import { Gauge } from "lucide-react";

import { cn } from "@/lib/utils";

export function ConfidenceBadge({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const pct = Math.round(confidence * 100);
  const level =
    confidence >= 0.75 ? "high" : confidence >= 0.5 ? "med" : "low";
  const styles: Record<string, string> = {
    high: "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    med: "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30",
    low: "text-rose-700 dark:text-rose-300 bg-rose-500/10 border-rose-500/30",
  };
  return (
    <span
      title={`Confidence ${pct}%`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        styles[level],
        className
      )}
    >
      <Gauge className="h-3 w-3" />
      {pct}% confidence
    </span>
  );
}
