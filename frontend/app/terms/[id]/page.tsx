import { TermDetailClient } from "./term-detail-client";

// Pre-render a range of IDs so static export + FastAPI SPA fallback can
// serve /terms/<id> directly. The page is purely client-rendered, so the
// same HTML shell works for any ID in range. New terms beyond this range
// still resolve via the SPA catchall → client fetch.
export function generateStaticParams() {
  return Array.from({ length: 500 }, (_, i) => ({ id: String(i + 1) }));
}

export const dynamicParams = false;

export default function Page() {
  return <TermDetailClient />;
}
