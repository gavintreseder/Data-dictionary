"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AddTermDialog } from "@/components/add-term-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function Header() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const qc = useQueryClient();

  const reset = useMutation({
    mutationFn: api.demoReset,
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success("Demo data reset — seeded 25 terms.");
    },
    onError: (err: Error) => toast.error(err.message || "Reset failed"),
  });

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-background)]/80 px-4 backdrop-blur">
      <form
        className="relative w-full max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (!q.trim()) return;
          router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
        <Input
          data-global-search
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search terms, definitions, categories…  ( / )"
          className="pl-9"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)] md:inline">
          ⌘K
        </kbd>
      </form>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/terms"
          className="hidden text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] md:inline"
        >
          Browse
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Reset demo data"
          title="Reset demo data"
          disabled={reset.isPending}
          onClick={() => {
            if (confirm("Reset all demo data? This removes custom terms and re-seeds.")) {
              reset.mutate();
            }
          }}
        >
          <RefreshCcw
            className={`h-4 w-4 ${reset.isPending ? "animate-spin" : ""}`}
          />
        </Button>
        <ThemeToggle />
        <AddTermDialog />
      </div>
    </header>
  );
}
