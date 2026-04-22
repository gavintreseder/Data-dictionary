import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Header } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { Providers } from "@/components/providers";
import { SidebarNav } from "@/components/sidebar-nav";

import "./globals.css";

export const metadata: Metadata = {
  title: "Data Dictionary",
  description:
    "Browse, flag and define the terms that matter across your business.",
};

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
                Data Dictionary · demo build · Phase 1
              </footer>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
