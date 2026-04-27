"use client";

import {
  BookText,
  Command as CmdIcon,
  Download,
  LayoutDashboard,
  Menu,
  Search,
  Sparkles,
  Tags,
  Telescope,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard, tour: "dashboard-link" },
  { href: "/terms", label: "Terms", Icon: BookText, tour: "terms-link" },
  { href: "/tags", label: "Tags", Icon: Tags },
  { href: "/search", label: "Search", Icon: Search },
  { href: "/import", label: "Import", Icon: Upload, tour: "import-link" },
  { href: "/behind-the-scenes", label: "Behind the scenes", Icon: Telescope },
];

export function SidebarNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle navigation"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="mb-6 flex items-center gap-2 px-2 pt-1">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-purple-500 text-[var(--color-primary-foreground)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Data Dictionary</span>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              Demo build · v0.2
            </span>
          </div>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map(({ href, label, Icon, tour }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              data-tour={tour}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(href)
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <a
            href={api.exportUrl("csv")}
            className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        </nav>

        <div className="mt-8 space-y-3 rounded-xl border border-dashed p-3 text-xs text-[var(--color-muted-foreground)]">
          <div className="flex items-center gap-2 text-[var(--color-foreground)]">
            <CmdIcon className="h-3.5 w-3.5" />
            <span className="font-medium">Tips</span>
          </div>
          <ul className="space-y-1">
            <li>
              <kbd className="rounded border px-1 py-0.5 text-[10px]">⌘K</kbd>{" "}
              opens the command palette
            </li>
            <li>
              <kbd className="rounded border px-1 py-0.5 text-[10px]">/</kbd>{" "}
              focuses search
            </li>
            <li>
              <kbd className="rounded border px-1 py-0.5 text-[10px]">g d</kbd>{" "}
              /{" "}
              <kbd className="rounded border px-1 py-0.5 text-[10px]">g t</kbd>{" "}
              jumps between pages
            </li>
          </ul>
        </div>
      </aside>
    </>
  );
}
