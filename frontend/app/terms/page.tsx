"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { FlagBadge, FLAG_LABELS } from "@/components/flag-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { FlagStatus } from "@/lib/types";

export default function TermsIndexPage() {
  const [q, setQ] = useState("");
  const [flag, setFlag] = useState<FlagStatus | "">("");
  const [category, setCategory] = useState("");

  const termsQuery = useQuery({
    queryKey: ["terms", { q, flag, category }],
    queryFn: () =>
      api.listTerms({
        q: q.trim() || undefined,
        flag: (flag || undefined) as FlagStatus | undefined,
        category: category || undefined,
      }),
  });

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const t of termsQuery.data || []) {
      if (t.category) set.add(t.category);
    }
    return Array.from(set).sort();
  }, [termsQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Terms</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          The full glossary. Filter by flag or category, or type to narrow down.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
            <Input
              placeholder="Filter by term or summary…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={flag}
            onChange={(e) => setFlag(e.target.value as FlagStatus | "")}
            className="md:w-48"
          >
            <option value="">All flags</option>
            {(
              ["none", "needs_review", "approved", "disputed", "archived"] as const
            ).map((f) => (
              <option key={f} value={f}>
                {FLAG_LABELS[f]}
              </option>
            ))}
          </Select>
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="md:w-56"
          >
            <option value="">All categories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Term</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Definitions</th>
                  <th className="px-4 py-3 font-medium">Flag</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {termsQuery.isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-[var(--color-border)]/70">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-4" /></td>
                    </tr>
                  ))
                ) : (termsQuery.data?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
                      No terms match the current filters.
                    </td>
                  </tr>
                ) : (
                  termsQuery.data!.map((t) => (
                    <tr
                      key={t.id}
                      className="group border-b border-[var(--color-border)]/70 transition-colors last:border-b-0 hover:bg-[var(--color-muted)]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/terms/${t.id}`}
                          className="font-medium text-[var(--color-foreground)] hover:underline"
                        >
                          {t.term}
                        </Link>
                        {t.summary ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-muted-foreground)]">
                            {t.summary}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                        {t.category || "—"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-[var(--color-muted-foreground)]">
                        {t.definition_count}
                      </td>
                      <td className="px-4 py-3">
                        <FlagBadge flag={t.flag} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/terms/${t.id}`}
                          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
