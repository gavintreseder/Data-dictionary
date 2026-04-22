"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SourceBadge } from "@/components/source-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { Definition } from "@/lib/types";

function slugFromPath(): string | null {
  if (typeof window === "undefined") return null;
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] !== "t" || !parts[1]) return null;
  return decodeURIComponent(parts[1]);
}

export function TermSharePage() {
  // Don't trust Next's prerender param — always read directly from the URL
  // because the static export may serve a placeholder HTML for unknown slugs.
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    setSlug(slugFromPath());
  }, []);

  const query = useQuery({
    queryKey: ["share", slug],
    queryFn: () => api.getTermBySlug(slug!),
    enabled: !!slug,
  });

  if (!slug || query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-xl font-semibold">Term not found</h1>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          The term &quot;{slug}&quot; doesn't exist in this dictionary.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1 text-sm text-[var(--color-primary)]"
        >
          Back to home
        </Link>
      </div>
    );
  }

  const term = query.data;
  const grouped: Record<string, Definition[]> = {};
  for (const d of term.definitions) {
    (grouped[d.source.slug] ||= []).push(d);
  }

  return (
    <article className="mx-auto max-w-3xl space-y-8 py-8">
      <header className="space-y-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          <Sparkles className="h-3 w-3" /> Data Dictionary
        </Link>
        <h1 className="text-4xl font-semibold tracking-tight">{term.term}</h1>
        {term.category ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {term.category}
          </p>
        ) : null}
        {term.summary ? (
          <p className="max-w-2xl text-lg text-[var(--color-muted-foreground)]">
            {term.summary}
          </p>
        ) : null}
        {term.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {term.tags.map((t) => (
              <span
                key={t.id}
                className="rounded-full border bg-[var(--color-muted)] px-2 py-0.5 text-[11px]"
              >
                {t.name}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Definitions
        </h2>
        {term.definitions.length === 0 ? (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            No definitions have been added yet.
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped).map(([slug, defs]) => (
              <Card key={slug}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle>
                    <SourceBadge source={defs[0].source} />
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
                <CardContent className="space-y-2">
                  {defs.map((d) => (
                    <p key={d.id} className="text-sm leading-relaxed">
                      {d.text}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t pt-6 text-xs text-[var(--color-muted-foreground)]">
        Shared from the Data Dictionary demo ·{" "}
        <Link href="/" className="underline-offset-2 hover:underline">
          open the full app
        </Link>
      </footer>
    </article>
  );
}
