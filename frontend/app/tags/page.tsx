"use client";

import { useQuery } from "@tanstack/react-query";
import { Tags as TagsIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

export default function TagsPage() {
  const q = useQuery({ queryKey: ["tag-counts"], queryFn: api.tagCounts });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Click any tag to filter the glossary by that tag.
        </p>
      </div>

      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (q.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={TagsIcon}
          title="No tags yet"
          description="Add tags from any term's detail page to start organising your glossary."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {q.data!.map((t) => (
            <Link
              key={t.id}
              href={`/terms?tag=${encodeURIComponent(t.slug)}`}
              className="group"
            >
              <Card className="h-full transition-colors hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-muted)]/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <TagsIcon className="h-3.5 w-3.5 opacity-60" />
                      {t.name}
                    </span>
                    <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[10px] tabular-nums text-[var(--color-muted-foreground)]">
                      {t.count}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs text-[var(--color-muted-foreground)]">
                  {t.count === 0
                    ? "No terms yet"
                    : `${t.count} term${t.count === 1 ? "" : "s"} tagged`}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
