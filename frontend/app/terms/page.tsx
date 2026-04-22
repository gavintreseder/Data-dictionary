"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookText,
  FlagTriangleRight,
  Search as SearchIcon,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AddTermDialog } from "@/components/add-term-dialog";
import { EmptyState } from "@/components/empty-state";
import { FlagBadge, FLAG_LABELS } from "@/components/flag-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { FlagStatus, Term } from "@/lib/types";

export default function TermsIndexPage() {
  const [q, setQ] = useState("");
  const [flag, setFlag] = useState<FlagStatus | "">("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const qc = useQueryClient();

  const termsQuery = useQuery({
    queryKey: ["terms", { q, flag, category, tag }],
    queryFn: () =>
      api.listTerms({
        q: q.trim() || undefined,
        flag: (flag || undefined) as FlagStatus | undefined,
        category: category || undefined,
        tag: tag || undefined,
      }),
  });

  const tagsQuery = useQuery({ queryKey: ["tag-counts"], queryFn: api.tagCounts });

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const t of termsQuery.data || []) {
      if (t.category) set.add(t.category);
    }
    return Array.from(set).sort();
  }, [termsQuery.data]);

  const toggleOne = (id: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (terms: Term[]) => {
    if (selected.size === terms.length) setSelected(new Set());
    else setSelected(new Set(terms.map((t) => t.id)));
  };

  const bulkFlag = useMutation({
    mutationFn: async (next: FlagStatus) => {
      await Promise.all(
        Array.from(selected).map((id) => api.updateFlag(id, next))
      );
      return next;
    },
    onSuccess: (flag) => {
      toast.success(`Flagged ${selected.size} term(s) as ${FLAG_LABELS[flag]}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["terms"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      await Promise.all(Array.from(selected).map((id) => api.deleteTerm(id)));
    },
    onSuccess: () => {
      toast.success(`Deleted ${selected.size} term(s)`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["terms"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const data = termsQuery.data || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Terms</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            The full glossary. Filter, select many, bulk-flag, or delete.
          </p>
        </div>
        <AddTermDialog />
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
            className="md:w-44"
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
            className="md:w-48"
          >
            <option value="">All categories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="md:w-44"
          >
            <option value="">All tags</option>
            {(tagsQuery.data || []).map((t) => (
              <option key={t.id} value={t.slug}>
                {t.name} ({t.count})
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {selected.size > 0 ? (
        <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-[var(--color-card)] px-4 py-2 shadow-sm">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              onChange={(e) => {
                const v = e.target.value as FlagStatus | "";
                if (v) bulkFlag.mutate(v);
                e.currentTarget.value = "";
              }}
              className="h-8 w-40 text-xs"
              defaultValue=""
            >
              <option value="" disabled>
                <FlagTriangleRight className="h-3 w-3" /> Bulk set flag…
              </option>
              {(
                ["approved", "needs_review", "disputed", "archived", "none"] as const
              ).map((f) => (
                <option key={f} value={f}>
                  {FLAG_LABELS[f]}
                </option>
              ))}
            </Select>
            <Button
              variant="destructive"
              size="sm"
              disabled={bulkDelete.isPending}
              onClick={() => {
                if (
                  confirm(
                    `Delete ${selected.size} term(s)? This cannot be undone.`
                  )
                ) {
                  bulkDelete.mutate();
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        data.length > 0 && selected.size === data.length
                      }
                      onChange={() => toggleAll(data)}
                      aria-label="Select all"
                      className="h-3.5 w-3.5"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Term</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Tags</th>
                  <th className="px-4 py-3 font-medium">Definitions</th>
                  <th className="px-4 py-3 font-medium">Flag</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {termsQuery.isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr
                      key={i}
                      className="border-b border-[var(--color-border)]/70"
                    >
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3" />
                    </tr>
                  ))
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6">
                      <EmptyState
                        icon={BookText}
                        title="No terms match your filters"
                        description="Try clearing a filter, or add a new term."
                        actions={<AddTermDialog />}
                      />
                    </td>
                  </tr>
                ) : (
                  data.map((t) => (
                    <tr
                      key={t.id}
                      className="group border-b border-[var(--color-border)]/70 transition-colors last:border-b-0 hover:bg-[var(--color-muted)]"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(t.id)}
                          onChange={() => toggleOne(t.id)}
                          aria-label={`Select ${t.term}`}
                          className="h-3.5 w-3.5"
                        />
                      </td>
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
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {t.tags.slice(0, 3).map((tg) => (
                            <span
                              key={tg.id}
                              className="rounded-full border bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px]"
                            >
                              {tg.name}
                            </span>
                          ))}
                          {t.tags.length > 3 ? (
                            <span className="text-[10px] text-[var(--color-muted-foreground)]">
                              +{t.tags.length - 3}
                            </span>
                          ) : null}
                        </div>
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
