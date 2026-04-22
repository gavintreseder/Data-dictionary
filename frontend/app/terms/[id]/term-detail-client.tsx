"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { FlagBadge, FLAG_LABELS } from "@/components/flag-badge";
import { SourceBadge } from "@/components/source-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Definition, FlagStatus } from "@/lib/types";
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

  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  const lookup = useMutation({
    mutationFn: async () => {
      if (!termQuery.data) return null;
      return api.lookup(termQuery.data.term);
    },
    onSuccess: (result) => {
      if (!result) return;
      setLookupMessage(
        result.definitions_added === 0
          ? "No new definitions found (try another word)."
          : `Added ${result.definitions_added} new definition${
              result.definitions_added === 1 ? "" : "s"
            }.`
      );
      qc.invalidateQueries({ queryKey: ["term", id] });
      qc.invalidateQueries({ queryKey: ["terms"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err: Error) => setLookupMessage(err.message),
  });

  const flagMutation = useMutation({
    mutationFn: (flag: FlagStatus) => api.updateFlag(id, flag),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["term", id] });
      qc.invalidateQueries({ queryKey: ["terms"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteTerm(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["terms"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      router.push("/terms");
    },
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
            onChange={(e) =>
              flagMutation.mutate(e.target.value as FlagStatus)
            }
            className="w-48"
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

      {lookupMessage ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg border bg-[var(--color-muted)] px-3 py-2 text-sm"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {lookupMessage}
          <button
            className="ml-auto text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            onClick={() => setLookupMessage(null)}
          >
            dismiss
          </button>
        </motion.div>
      ) : null}

      <section className="space-y-4">
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
                from the Free Dictionary API.
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
                      {defs.length} definition{defs.length === 1 ? "" : "s"}
                    </span>
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
                      className="rounded-lg border border-[var(--color-border)]/70 bg-[var(--color-muted)]/30 p-3"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-sm">{d.text}</p>
                        {d.part_of_speech ? (
                          <span className="shrink-0 rounded-md bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                            {d.part_of_speech}
                          </span>
                        ) : null}
                      </div>
                      {d.example ? (
                        <p className="mt-2 text-xs italic text-[var(--color-muted-foreground)]">
                          &ldquo;{d.example}&rdquo;
                        </p>
                      ) : null}
                      <p className="mt-2 text-[10px] text-[var(--color-muted-foreground)]">
                        Added {formatRelative(d.created_at)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
