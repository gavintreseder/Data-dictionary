"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Sparkles,
  Tag,
  Trash2,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AuditTimeline } from "@/components/audit-timeline";
import { FlagBadge, FLAG_LABELS } from "@/components/flag-badge";
import { INDUSTRY_LABELS, IndustrySelect } from "@/components/industry-select";
import { RefineBox } from "@/components/refine-box";
import { SourceBadge } from "@/components/source-badge";
import { TagEditor } from "@/components/tag-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Definition, FlagStatus, IndustryContext } from "@/lib/types";
import { formatRelative } from "@/lib/utils";

export function TermDetailClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const id = Number(params?.id);
  const termQuery = useQuery({
    queryKey: ["term", id],
    queryFn: () => api.getTerm(id),
    enabled: !Number.isNaN(id) && id > 0,
  });

  const auditQuery = useQuery({
    queryKey: ["term-audit", id],
    queryFn: () => api.termAudit(id),
    enabled: !Number.isNaN(id) && id > 0,
  });

  const [copied, setCopied] = useState(false);

  const lookup = useMutation({
    mutationFn: async () => {
      if (!termQuery.data) return null;
      return api.lookup(termQuery.data.term);
    },
    onSuccess: (result) => {
      if (!result) return;
      if (result.definitions_added === 0) {
        toast.info(
          "No new definitions found — the configured sources returned nothing new."
        );
      } else {
        toast.success(
          `Added ${result.definitions_added} new definition${
            result.definitions_added === 1 ? "" : "s"
          }.`
        );
      }
      qc.invalidateQueries({ queryKey: ["term", id] });
      qc.invalidateQueries({ queryKey: ["term-audit", id] });
      qc.invalidateQueries({ queryKey: ["terms"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const flagMutation = useMutation({
    mutationFn: (flag: FlagStatus) => api.updateFlag(id, flag),
    onMutate: async (flag) => {
      await qc.cancelQueries({ queryKey: ["term", id] });
      const previous = qc.getQueryData<any>(["term", id]);
      if (previous) {
        qc.setQueryData(["term", id], { ...previous, flag });
      }
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["term", id], ctx.previous);
      toast.error(err.message || "Could not update flag");
    },
    onSuccess: () => {
      toast.success("Flag updated");
      qc.invalidateQueries({ queryKey: ["term-audit", id] });
      qc.invalidateQueries({ queryKey: ["terms"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const industryMutation = useMutation({
    mutationFn: (industry_context: IndustryContext) =>
      api.updateTerm(id, { industry_context }),
    onSuccess: () => {
      toast.success("Industry context updated");
      qc.invalidateQueries({ queryKey: ["term", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTerm(id),
    onSuccess: () => {
      toast.success("Term deleted");
      qc.invalidateQueries({ queryKey: ["terms"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      router.push("/terms");
    },
  });

  const deleteDef = useMutation({
    mutationFn: (defId: number) => api.deleteDefinition(id, defId),
    onSuccess: () => {
      toast.success("Definition removed");
      qc.invalidateQueries({ queryKey: ["term", id] });
      qc.invalidateQueries({ queryKey: ["term-audit", id] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (termQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (termQuery.isError || !termQuery.data) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Link
          href="/terms"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="h-3 w-3" /> Back to terms
        </Link>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm">Term not found.</p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              It may have been deleted, or this ID doesn't exist yet.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const term = termQuery.data;

  const grouped: Record<string, Definition[]> = {};
  for (const d of term.definitions) {
    (grouped[d.source.slug] ||= []).push(d);
  }

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/t/${term.slug}`
      : `/t/${term.slug}`;

  return (
    <div className="space-y-6">
      <Link
        href="/terms"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="h-3 w-3" /> All terms
      </Link>

      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {term.term}
            </h1>
            <FlagBadge flag={term.flag} />
          </div>
          {term.category ? (
            <p className="inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)]">
              <Tag className="h-3 w-3" /> {term.category}
            </p>
          ) : null}
          {term.summary ? (
            <p className="max-w-2xl text-[var(--color-muted-foreground)]">
              {term.summary}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={term.flag}
            onChange={(e) => flagMutation.mutate(e.target.value as FlagStatus)}
            className="w-44"
            aria-label="Flag status"
          >
            {(
              ["none", "needs_review", "approved", "disputed", "archived"] as const
            ).map((f) => (
              <option key={f} value={f}>
                {FLAG_LABELS[f]}
              </option>
            ))}
          </Select>

          <IndustrySelect
            value={term.industry_context}
            onChange={(v) => industryMutation.mutate(v)}
            className="w-40"
          />

          <Button
            variant="outline"
            onClick={() => lookup.mutate()}
            disabled={lookup.isPending}
          >
            <Download className="h-4 w-4" />
            {lookup.isPending ? "Looking up…" : "Lookup"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Copy share link"
            title="Copy share link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                toast.success("Share link copied");
                setTimeout(() => setCopied(false), 1500);
              } catch {
                toast.error("Copy failed");
              }
            }}
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete term"
            onClick={() => {
              if (confirm(`Delete "${term.term}"? This cannot be undone.`)) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4 text-[var(--color-destructive)]" />
          </Button>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-lg font-medium">
              Definitions{" "}
              <span className="text-sm text-[var(--color-muted-foreground)]">
                ({term.definitions.length})
              </span>
            </h2>

            {term.definitions.length === 0 ? (
              <Card>
                <CardContent className="space-y-2 p-6 text-center">
                  <Sparkles className="mx-auto h-6 w-6 text-[var(--color-muted-foreground)]" />
                  <p className="text-sm">No definitions yet.</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    Try the <strong>Lookup</strong> button to fetch definitions
                    from Free Dictionary, Wiktionary, Wikipedia and the Standards corpus.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {Object.entries(grouped).map(([slug, defs]) => (
                  <Card key={slug}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <SourceBadge source={defs[0].source} />
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          {defs.length} definition
                          {defs.length === 1 ? "" : "s"}
                        </span>
                        {defs.some((d) => d.is_consolidated) ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                            <Wand2 className="h-3 w-3" />
                            consolidated
                          </span>
                        ) : null}
                      </CardTitle>
                      {defs[0].source.homepage ? (
                        <a
                          href={defs[0].source.homepage}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                        >
                          {new URL(defs[0].source.homepage).host}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {defs.map((d) => (
                        <div
                          key={d.id}
                          className="group rounded-lg border border-[var(--color-border)]/70 bg-[var(--color-muted)]/30 p-3"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="text-sm">{d.text}</p>
                            <div className="flex shrink-0 items-center gap-2">
                              {d.part_of_speech ? (
                                <span className="rounded-md bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                                  {d.part_of_speech}
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm("Remove this definition?")) {
                                    deleteDef.mutate(d.id);
                                  }
                                }}
                                aria-label="Remove definition"
                                className="text-[var(--color-muted-foreground)] opacity-0 transition-opacity hover:text-[var(--color-destructive)] group-hover:opacity-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          {d.example ? (
                            <p className="mt-2 text-xs italic text-[var(--color-muted-foreground)]">
                              &ldquo;{d.example}&rdquo;
                            </p>
                          ) : null}
                          <div className="mt-2 flex items-center justify-between">
                            <p className="text-[10px] text-[var(--color-muted-foreground)]">
                              Added {formatRelative(d.created_at)}
                            </p>
                            {d.external_ref ? (
                              <a
                                href={d.external_ref.startsWith("http") ? d.external_ref : undefined}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                              >
                                ref
                              </a>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <RefineBox
            termId={term.id}
            initialIndustry={term.industry_context}
          />
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <TagEditor termId={term.id} tags={term.tags} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-[var(--color-muted-foreground)]">
              <p>
                <strong className="text-[var(--color-foreground)]">
                  Industry:
                </strong>{" "}
                {INDUSTRY_LABELS[term.industry_context]}
              </p>
              <p>
                <strong className="text-[var(--color-foreground)]">Slug:</strong>{" "}
                <code className="rounded bg-[var(--color-muted)] px-1">
                  {term.slug}
                </code>
              </p>
              <p>
                <strong className="text-[var(--color-foreground)]">
                  Share link:
                </strong>{" "}
                <button
                  className="inline-flex items-center gap-1 rounded bg-[var(--color-muted)] px-1 text-[var(--color-foreground)] hover:opacity-80"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast.success("Share link copied");
                    } catch {
                      toast.error("Copy failed");
                    }
                  }}
                >
                  <Copy className="h-3 w-3" /> /t/{term.slug}
                </button>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {auditQuery.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <AuditTimeline events={auditQuery.data || []} />
              )}
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}
