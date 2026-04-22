"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookMarked,
  BookText,
  FileSearch,
  FlagTriangleRight,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { FlagBadge } from "@/components/flag-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatRelative } from "@/lib/utils";

export default function DashboardPage() {
  const statsQuery = useQuery({ queryKey: ["stats"], queryFn: api.stats });

  const stats = statsQuery.data;
  const loading = statsQuery.isLoading;

  const flagged =
    stats
      ? stats.by_flag.needs_review + stats.by_flag.disputed
      : 0;
  const approved = stats?.by_flag.approved ?? 0;
  const businessDefs = stats?.by_source_type.user_defined ?? 0;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-2">
        <Badge variant="secondary" className="w-fit">
          <Sparkles className="h-3 w-3" /> Demo build
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Your organisation's vocabulary, in one place.
        </h1>
        <p className="max-w-2xl text-[var(--color-muted-foreground)]">
          Browse industry definitions side-by-side with your in-house glossary,
          flag what needs review, and build a single source of truth for the
          terms that matter.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total terms"
          value={stats?.total_terms}
          hint={
            businessDefs
              ? `${businessDefs} with business definitions`
              : "ready to grow"
          }
          Icon={BookText}
          loading={loading}
          accent="from-indigo-500/20 to-indigo-500/0"
        />
        <StatCard
          title="Definitions"
          value={stats?.total_definitions}
          hint="across all sources"
          Icon={BookMarked}
          loading={loading}
          accent="from-emerald-500/20 to-emerald-500/0"
        />
        <StatCard
          title="Needs attention"
          value={flagged}
          hint={`${approved} approved · ${
            stats?.by_flag.disputed ?? 0
          } disputed`}
          Icon={FlagTriangleRight}
          loading={loading}
          accent="from-amber-500/20 to-amber-500/0"
        />
        <StatCard
          title="Sources"
          value={stats?.sources}
          hint="Online, in-house, AI, PDF"
          Icon={FileSearch}
          loading={loading}
          accent="from-purple-500/20 to-purple-500/0"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent activity</CardTitle>
            <Link
              href="/terms"
              className="inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : stats?.recent_terms?.length ? (
              <ul className="divide-y divide-[var(--color-border)]">
                {stats.recent_terms.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/terms/${t.id}`}
                      className="flex items-center justify-between gap-4 rounded-md px-2 py-3 transition-colors hover:bg-[var(--color-muted)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{t.term}</p>
                        <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                          {t.summary || t.category || "No summary"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <FlagBadge flag={t.flag} compact />
                        <span className="text-xs text-[var(--color-muted-foreground)]">
                          {formatRelative(t.updated_at)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Flag breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading || !stats ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </>
            ) : (
              (
                [
                  "approved",
                  "needs_review",
                  "disputed",
                  "archived",
                  "none",
                ] as const
              ).map((flag) => {
                const count = stats.by_flag[flag] ?? 0;
                const total = stats.total_terms || 1;
                return (
                  <div key={flag} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <FlagBadge flag={flag} />
                      <span className="tabular-nums text-[var(--color-muted-foreground)]">
                        {count}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / total) * 100}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="h-full rounded-full bg-[var(--color-primary)]"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  Icon,
  loading,
  accent,
}: {
  title: string;
  value?: number;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${accent}`}
      />
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-semibold tabular-nums"
          >
            {value ?? 0}
          </motion.div>
        )}
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{hint}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-[var(--color-muted-foreground)]">
      No terms yet. Add your first term from the toolbar above.
    </div>
  );
}
