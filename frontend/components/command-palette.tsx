"use client";

import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
  BookText,
  Download,
  LayoutDashboard,
  Moon,
  Search,
  Sparkles,
  Sun,
  Tags,
  Upload,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const termsQuery = useQuery({
    queryKey: ["cmd-terms", query],
    queryFn: () => api.listTerms(query.trim() ? { q: query } : undefined),
    enabled: open,
    staleTime: 5_000,
  });

  const nav = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-24 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl"
          >
            <Command
              label="Command palette"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--color-muted-foreground)]"
            >
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3">
                <Search className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                <Command.Input
                  autoFocus
                  placeholder="Type a command or search a term…"
                  value={query}
                  onValueChange={setQuery}
                  className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted-foreground)]"
                />
                <kbd className="hidden rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)] md:inline">
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-[60vh] overflow-y-auto px-1 py-1">
                <Command.Empty className="px-4 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
                  No results.
                </Command.Empty>

                <Command.Group heading="Navigation">
                  <PaletteItem
                    onSelect={() => nav("/")}
                    icon={<LayoutDashboard className="h-4 w-4" />}
                    label="Dashboard"
                    shortcut="g d"
                  />
                  <PaletteItem
                    onSelect={() => nav("/terms")}
                    icon={<BookText className="h-4 w-4" />}
                    label="Terms"
                    shortcut="g t"
                  />
                  <PaletteItem
                    onSelect={() => nav("/tags")}
                    icon={<Tags className="h-4 w-4" />}
                    label="Tags"
                  />
                  <PaletteItem
                    onSelect={() => nav("/search")}
                    icon={<Search className="h-4 w-4" />}
                    label="Search"
                    shortcut="/"
                  />
                  <PaletteItem
                    onSelect={() => nav("/import")}
                    icon={<Upload className="h-4 w-4" />}
                    label="Import"
                  />
                  <PaletteItem
                    onSelect={() => {
                      setOpen(false);
                      window.location.href = api.exportUrl("csv");
                    }}
                    icon={<Download className="h-4 w-4" />}
                    label="Export CSV"
                  />
                </Command.Group>

                <Command.Group heading="Theme">
                  <PaletteItem
                    onSelect={() => {
                      setTheme("light");
                      setOpen(false);
                    }}
                    icon={<Sun className="h-4 w-4" />}
                    label="Light theme"
                  />
                  <PaletteItem
                    onSelect={() => {
                      setTheme("dark");
                      setOpen(false);
                    }}
                    icon={<Moon className="h-4 w-4" />}
                    label="Dark theme"
                  />
                </Command.Group>

                {(termsQuery.data?.length ?? 0) > 0 ? (
                  <Command.Group heading="Terms">
                    {(termsQuery.data || []).slice(0, 8).map((t) => (
                      <PaletteItem
                        key={t.id}
                        onSelect={() => nav(`/terms/${t.id}`)}
                        icon={<Sparkles className="h-4 w-4" />}
                        label={t.term}
                        hint={t.category || undefined}
                      />
                    ))}
                  </Command.Group>
                ) : null}
              </Command.List>
            </Command>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PaletteItem({
  onSelect,
  icon,
  label,
  hint,
  shortcut,
}: {
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  shortcut?: string;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-[var(--color-accent)] aria-selected:text-[var(--color-accent-foreground)]"
    >
      <span className="text-[var(--color-muted-foreground)]">{icon}</span>
      <span className="flex-1">{label}</span>
      {hint ? (
        <span className="text-xs text-[var(--color-muted-foreground)]">{hint}</span>
      ) : null}
      {shortcut ? (
        <kbd className="rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted-foreground)]">
          {shortcut}
        </kbd>
      ) : null}
    </Command.Item>
  );
}
