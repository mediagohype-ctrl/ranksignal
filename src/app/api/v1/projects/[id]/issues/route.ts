// GET /api/v1/projects/{id}/issues?pillar=&impact=&cursor=&limit= — issues from the latest report, highest impact first.
import { apiRoute } from "@/lib/public-api/http";
import { decodeOffsetCursor, parseEnum, parseLimit } from "@/lib/public-api/params";
import { IMPACTS, PILLARS, listIssues } from "@/lib/public-api/service";

export const dynamic = "force-dynamic";

export const GET = apiRoute<{ id: string }>(async (_req, { principal, url }, { id }) => {
  const q = url.searchParams;
  const page = await listIssues(principal.organizationId, id, {
    pillar: parseEnum(q.get("pillar"), PILLARS, "pillar"),
    impact: parseEnum(q.get("impact"), IMPACTS, "impact"),
    offset: decodeOffsetCursor(q.get("cursor")),
    limit: parseLimit(q.get("limit"), 50, 100),
  });
  return { data: page.items, meta: { nextCursor: page.nextCursor, total: page.total, generatedAt: page.generatedAt } };
});
