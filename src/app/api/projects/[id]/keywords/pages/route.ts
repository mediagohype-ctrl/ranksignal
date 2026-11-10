// GET /api/projects/[id]/keywords/pages?days=28 — which page ranks for which searches. Asks Search Console live
// (query x page, one API call, cached 10 minutes) because the daily sync stores queries and pages separately.
// Viewer+; tenant-scoped; Google errors become friendly, token-free messages.
import { HttpError, handler, json, requireProject, requireSession } from "@/lib/api";
import { toHttpError } from "@/lib/google/route-helpers";
import { isGoogleConfigured, NOT_CONFIGURED_MESSAGE } from "@/lib/google/config";
import { periodsFor } from "@/lib/keywords/analyze";
import { gscKeywordStatus, keywordsByPage } from "@/lib/keywords/data";
import { parseRangeDays } from "@/lib/keywords/limits";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  if (!isGoogleConfigured()) throw new HttpError(501, "google_not_configured", NOT_CONFIGURED_MESSAGE);
  const days = parseRangeDays(new URL(req.url).searchParams.get("days"));
  const status = await gscKeywordStatus(s.organizationId, project.id);
  const to = status.lastDataDate ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const periods = periodsFor(to, days);
  try {
    const r = await keywordsByPage(s.organizationId, project.id, periods);
    return json({ periods, ...r });
  } catch (e) {
    throw toHttpError(e);
  }
});
