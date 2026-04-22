"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export interface TourStep {
  target: string; // CSS selector (e.g. '[data-tour="dashboard-stats"]')
  title: string;
  body: string;
}

const STORAGE_KEY = "datadict.tour.completed.v1";

export function Tour({ steps }: { steps: TourStep[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const already = localStorage.getItem(STORAGE_KEY);
    if (!already) {
      // wait a tick for layout
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  const measure = useCallback(() => {
    if (!open) return;
    const step = steps[index];
    if (!step) return;
    const el = document.querySelector<HTMLElement>(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    setRect(el.getBoundingClientRect());
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [open, index, steps]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure]);

  const close = useCallback((persist = true) => {
    setOpen(false);
    if (persist && typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
  }, []);

  const next = () => {
    if (index + 1 >= steps.length) {
      close();
      return;
    }
    setIndex((i) => i + 1);
  };

  if (!open || !steps.length) return null;
  const step = steps[index];

  const padding = 8;
  const tooltipTop = rect
    ? Math.min(window.innerHeight - 220, rect.bottom + padding)
    : 100;
  const tooltipLeft = rect
    ? Math.min(window.innerWidth - 360, Math.max(16, rect.left))
    : 100;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Spotlight overlay — four divs to cut out the rect */}
          {rect ? (
            <>
              <div
                className="absolute inset-x-0 top-0 bg-black/55"
                style={{ height: Math.max(0, rect.top - padding) }}
              />
              <div
                className="absolute inset-x-0 bottom-0 bg-black/55"
                style={{ top: rect.bottom + padding }}
              />
              <div
                className="absolute left-0 bg-black/55"
                style={{
                  top: rect.top - padding,
                  height: rect.height + padding * 2,
                  width: Math.max(0, rect.left - padding),
                }}
              />
              <div
                className="absolute right-0 bg-black/55"
                style={{
                  top: rect.top - padding,
                  height: rect.height + padding * 2,
                  width: Math.max(
                    0,
                    window.innerWidth - rect.right - padding
                  ),
                }}
              />
              <div
                className="pointer-events-none absolute rounded-lg ring-2 ring-[var(--color-primary)]"
                style={{
                  left: rect.left - padding,
                  top: rect.top - padding,
                  width: rect.width + padding * 2,
                  height: rect.height + padding * 2,
                }}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-black/55" />
          )}

          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute w-[340px] rounded-xl border bg-[var(--color-card)] p-4 shadow-xl"
            style={{ top: tooltipTop, left: tooltipLeft }}
          >
            <button
              onClick={() => close()}
              aria-label="Skip tour"
              className="absolute right-2 top-2 rounded-md p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Step {index + 1} of {steps.length}
            </p>
            <h3 className="mt-1 text-sm font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              {step.body}
            </p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={() => close()}
                className="text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              >
                Skip
              </button>
              <Button size="sm" onClick={next}>
                {index + 1 === steps.length ? "Done" : "Next"}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function ResetTourButton({ className }: { className?: string }) {
  return (
    <button
      className={className}
      onClick={() => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } finally {
          location.reload();
        }
      }}
    >
      Replay tour
    </button>
  );
}
