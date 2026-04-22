import type { Metadata } from "next";
import type { ReactNode } from "react";

import { CommandPalette } from "@/components/command-palette";
import { Header } from "@/components/header";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { PageTransition } from "@/components/page-transition";
import { Providers } from "@/components/providers";
import { SidebarNav } from "@/components/sidebar-nav";
import { Tour, type TourStep } from "@/components/tour";

import "./globals.css";

export const metadata: Metadata = {
  title: "Data Dictionary",
  description:
    "Browse, flag and define the terms that matter across your business.",
};

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="dashboard-stats"]',
    title: "Your dictionary at a glance",
    body: "Total terms, definitions, flags and sources — animated, live, and backed by real data.",
  },
  {
    target: '[data-tour="recent-activity"]',
    title: "Track what's changing",
    body: "Every flag change, definition added, refinement and import is captured in the audit log.",
  },
  {
    target: '[data-tour="terms-link"]',
    title: "Browse the full glossary",
    body: "Filter by flag, category or tag. Click any term to see multi-source definitions.",
  },
  {
    target: '[data-tour="import-link"]',
    title: "Bring in your own",
    body: "Drop in a CSV, JSON file or even a policy PDF to extract defined terms automatically.",
  },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <div className="flex min-h-screen">
            <SidebarNav />
            <div className="relative flex min-h-screen flex-1 flex-col">
              <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-40" />
              <Header />
              <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
                <PageTransition>{children}</PageTransition>
              </main>
              <footer className="border-t px-4 py-3 text-xs text-[var(--color-muted-foreground)] md:px-8">
                Data Dictionary · demo build · v0.2
              </footer>
            </div>
          </div>
          <CommandPalette />
          <KeyboardShortcuts />
          <Tour steps={TOUR_STEPS} />
        </Providers>
      </body>
    </html>
  );
}
