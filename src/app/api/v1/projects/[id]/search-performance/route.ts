// GET /api/v1/projects/{id}/search-performance?from=&to= — stored Search Console / GA4 numbers vs the previous period.
// Defaults to the last 28 complete days (UTC). gsc / ga4 are null when not connected.
import { apiRoute } from "@/lib/public-api/http";
import { parseDateRange } from "@/lib/public-api/params";
import { getSearchPerformance } from "@/lib/public-api/service";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(async (_req, { principal, url }, { id }) => {
  const { from, to } = parseDateRange(url.searchParams, 28);
  return { data: await getSearchPerformance(principal.organizationId, id, from, to) };
});
