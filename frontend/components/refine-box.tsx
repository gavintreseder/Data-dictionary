"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Info, Sparkles, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { IndustrySelect } from "@/components/industry-select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { IndustryContext, RefineResponse } from "@/lib/types";

export function RefineBox({
  termId,
  initialIndustry,
}: {
  termId: number;
  initialIndustry: IndustryContext;
}) {
  const [prompt, setPrompt] = useState("");
  const [industry, setIndustry] = useState<IndustryContext>(initialIndustry);
  const [latest, setLatest] = useState<RefineResponse | null>(null);

  const sysQuery = useQuery({
    queryKey: ["system"],
    queryFn: api.system,
    staleTime: 60_000,
  });

  const qc = useQueryClient();

  const refine = useMutation({
    mutationFn: (apply: boolean) =>
      api.refine(termId, {
        prompt: prompt.trim() || null,
        industry_context: industry,
        apply,
      }),
    onSuccess: (data, apply) => {
      setLatest(data);
      if (apply) {
        qc.invalidateQueries({ queryKey: ["term", termId] });
        qc.invalidateQueries({ queryKey: ["stats"] });
        toast.success("Consolidated definition saved to the term.");
      } else {
        toast.success(
          data.model === "heuristic"
            ? "Generated a consensus definition."
            : "Consolidated via LLM."
        );
      }
    },
    onError: (err: Error) => toast.error(err.message || "Refine failed"),
  });

  const llmOn = sysQuery.data?.llm.enabled ?? false;

  return (
    <div className="rounded-xl border border-dashed p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-amber-400/80 to-purple-500/80 text-white">
            <Wand2 className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold">Refine with AI</h3>
          {!llmOn && sysQuery.data ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[11px] text-[var(--color-muted-foreground)]"
              title="Heuristic mode. Configure OLLAMA_URL or HF_API_TOKEN to enable LLM."
            >
              <Info className="h-3 w-3" />
              heuristic mode
            </span>
          ) : null}
        </div>
        <IndustrySelect
          value={industry}
          onChange={setIndustry}
          className="h-8 w-40 text-xs"
        />
      </div>

      <Textarea
        placeholder="Optional prompt — e.g. 'emphasise measurability' or 'align with the ISO 31000 definition'"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
      />

      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={refine.isPending}
          onClick={() => refine.mutate(false)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {refine.isPending ? "Refining…" : "Preview"}
        </Button>
        <Button
          size="sm"
          disabled={refine.isPending}
          onClick={() => refine.mutate(true)}
        >
          Save as consolidated
        </Button>
      </div>

      <AnimatePresence>
        {latest ? (
          <motion.div
            key={latest.refinement_id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-lg border bg-[var(--color-muted)]/40 p-3"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <ConfidenceBadge confidence={latest.confidence} />
              <span className="text-[11px] text-[var(--color-muted-foreground)]">
                {latest.model}
              </span>
              <div className="ml-auto flex flex-wrap gap-1">
                {latest.sources_used.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-0.5 text-[10px] text-[var(--color-muted-foreground)]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm leading-relaxed">{latest.text}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
