import { readFileSync } from "fs";
import { join } from "path";

import { TermSharePage } from "./term-share-client";

// Pre-render the share URL for every seeded slug. New terms created at
// runtime won't be in this list — the FastAPI catchall falls back to one
// of the prerendered pages and the client reads the slug from the URL.
export function generateStaticParams() {
  try {
    const seed = JSON.parse(
      readFileSync(
        join(process.cwd(), "..", "backend", "app", "seed", "sample_terms.json"),
        "utf8"
      )
    );
    const slugs: string[] = [];
    for (const t of seed.terms || []) {
      const slug = String(t.term || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      if (slug) slugs.push(slug);
    }
    if (!slugs.length) return [{ slug: "term" }];
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [{ slug: "term" }];
  }
}

export const dynamicParams = false;

export default function Page() {
  return <TermSharePage />;
}
