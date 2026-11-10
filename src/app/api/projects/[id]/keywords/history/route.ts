// GET /api/projects/[id]/keywords/history?query=...&days=90&granularity=day|week — one keyword's average position,
// clicks and impressions over time (stored Search Console rows). Viewer+; tenant-scoped.
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { cleanQuery, gscKeywordStatus, keywordHistory } from "@/lib/keywords/data";
import { parseRangeDays } from "@/lib/keywords/limits";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const sp = new URL(req.url).searchParams;
  const query = cleanQuery(sp.get("query"));
  const days = parseRangeDays(sp.get("days") ?? "90");
  const granularity = sp.get("granularity") === "week" ? "week" : "day";
  const status = await gscKeywordStatus(s.organizationId, project.id);
  const h = await keywordHistory(s.organizationId, project.id, query, days, granularity, status.lastDataDate);
  return json({ query, granularity, ...h });
});
