// GET /api/v1/projects/{id}/looker?from=&to= — flat daily rows for Looker Studio (integrations/looker-studio).
// Defaults to the last 90 complete days (UTC); at most 366 days.
import { apiRoute } from "@/lib/public-api/http";
import { LOOKER_FIELDS } from "@/lib/public-api/looker";
import { parseDateRange } from "@/lib/public-api/params";
import { getLookerRows } from "@/lib/public-api/service";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(async (_req, { principal, url }, { id }) => {
  const { from, to } = parseDateRange(url.searchParams, 90);
  const rows = await getLookerRows(principal.organizationId, id, from, to);
  return { data: rows, meta: { from, to, fields: LOOKER_FIELDS } };
});
