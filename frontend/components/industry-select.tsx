"use client";

import { Select } from "@/components/ui/select";
import type { IndustryContext } from "@/lib/types";

export const INDUSTRY_LABELS: Record<IndustryContext, string> = {
  generic: "General",
  finance: "Finance",
  healthcare: "Healthcare",
  engineering: "Engineering",
  legal: "Legal",
  public_sector: "Public sector",
};

export function IndustrySelect({
  value,
  onChange,
  className,
  id,
}: {
  value: IndustryContext;
  onChange: (v: IndustryContext) => void;
  className?: string;
  id?: string;
}) {
  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as IndustryContext)}
      className={className}
      aria-label="Industry context"
    >
      {(Object.keys(INDUSTRY_LABELS) as IndustryContext[]).map((k) => (
        <option key={k} value={k}>
          {INDUSTRY_LABELS[k]}
        </option>
      ))}
    </Select>
  );
}
