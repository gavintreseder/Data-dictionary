"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

function isTypingTarget(target: EventTarget | null) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (target.isContentEditable) return true;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const lastKeyRef = useRef<string | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>(
          "[data-global-search]"
        );
        el?.focus();
        return;
      }

      const now = Date.now();
      const within = now - lastKeyTimeRef.current < 1200;
      const prev = within ? lastKeyRef.current : null;

      if (prev === "g") {
        if (e.key === "d") {
          e.preventDefault();
          router.push("/");
          lastKeyRef.current = null;
          return;
        }
        if (e.key === "t") {
          e.preventDefault();
          router.push("/terms");
          lastKeyRef.current = null;
          return;
        }
        if (e.key === "s") {
          e.preventDefault();
          router.push("/search");
          lastKeyRef.current = null;
          return;
        }
        if (e.key === "i") {
          e.preventDefault();
          router.push("/import");
          lastKeyRef.current = null;
          return;
        }
      }

      lastKeyRef.current = e.key === "g" ? "g" : null;
      lastKeyTimeRef.current = now;
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
