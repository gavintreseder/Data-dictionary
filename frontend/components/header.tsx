"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AddTermDialog } from "@/components/add-term-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";

export function Header() {
  const router = useRouter();
  const [q, setQ] = useState("");

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
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search terms, definitions, categories…"
          className="pl-9"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/terms"
          className="hidden text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] md:inline"
        >
          Browse
        </Link>
        <ThemeToggle />
        <AddTermDialog />
      </div>
    </header>
  );
}
