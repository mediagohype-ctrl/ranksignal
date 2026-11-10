// GET /api/projects/[id]/keywords/opportunities?days=28 — almost page 1, low CTR for position, losing ground and new
// keywords, each with a plain-English next step. Viewer+; tenant-scoped.
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { findOpportunities } from "@/lib/keywords/analyze";
import { gscKeywordStatus, keywordDataset } from "@/lib/keywords/data";
import { parseRangeDays } from "@/lib/keywords/limits";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const days = parseRangeDays(new URL(req.url).searchParams.get("days"));
  const status = await gscKeywordStatus(s.organizationId, project.id);
  const data = await keywordDataset(s.organizationId, project.id, days, status.lastDataDate);
  return json({
    periods: data.periods,
    hasPreviousData: data.hasPreviousData,
    groups: findOpportunities(data.stats, { days, hasPreviousData: data.hasPreviousData }),
  });
});
