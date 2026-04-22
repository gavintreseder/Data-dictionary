"use client";

import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { FlagBadge } from "@/components/flag-badge";
import { SourceBadge } from "@/components/source-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

function SearchContent() {
  const search = useSearchParams();
  const initial = search.get("q") || "";
  const [q, setQ] = useState(initial);

  useEffect(() => {
    setQ(initial);
  }, [initial]);

  const query = useQuery({
    queryKey: ["search", q],
    queryFn: () => api.search(q),
    enabled: q.trim().length >= 2,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Look across every term, category and definition at once.
        </p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
        <Input
          autoFocus
          placeholder="Type a word… (min 2 chars)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {q.trim().length < 2 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          Start typing to search across the glossary and every definition.
        </p>
      ) : query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : query.data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Terms ({query.data.terms.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {query.data.terms.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">
                  No matching terms.
                </p>
              ) : (
                <ul className="divide-y">
                  {query.data.terms.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/terms/${t.id}`}
                        className="flex items-center justify-between gap-3 rounded-md px-2 py-3 transition-colors hover:bg-[var(--color-muted)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {t.term}
                          </p>
                          {t.summary ? (
                            <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                              {t.summary}
                            </p>
                          ) : null}
                        </div>
                        <FlagBadge flag={t.flag} compact />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Definitions ({query.data.definitions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {query.data.definitions.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">
                  No matching definitions.
                </p>
              ) : (
                <ul className="space-y-3">
                  {query.data.definitions.map((d) => (
                    <li
                      key={d.id}
                      className="rounded-lg border border-[var(--color-border)]/70 bg-[var(--color-muted)]/30 p-3"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <SourceBadge source={d.source} />
                        <Link
                          href={`/terms/${d.term_id}`}
                          className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                        >
                          view term →
                        </Link>
                      </div>
                      <p className="text-sm">{d.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-full" />}>
      <SearchContent />
    </Suspense>
  );
}
