import { db } from "@/lib/db";
import { handler, HttpError, json, requireProject, requireSession } from "@/lib/api";
import { RECOMMENDATION_RULE } from "@/lib/visibility/parse";
import { FORMULA_VERSION, INDEX_WEIGHTS } from "@/lib/visibility/metrics";

type Ctx = { params: Promise<{ id: string; runId: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("viewer");
  const { id, runId } = await params;
  const project = await requireProject(s, id);
  const run = await db.visibilityRun.findFirst({ where: { id: runId, organizationId: s.organizationId, projectId: project.id } });
  if (!run) throw new HttpError(404, "not_found", "Visibility run not found");

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const provider = url.searchParams.get("provider") ?? undefined;
  const rows = await db.observation.findMany({
    where: { organizationId: s.organizationId, visibilityRunId: run.id, ...(provider ? { provider } : {}) },
    include: { prompt: { select: { id: true, text: true, intent: true, topic: true, locale: true } } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, take);
  return json({
    item: run,
    observations: { items, nextCursor: rows.length > take ? items[items.length - 1].id : undefined },
    methodology: { formulaVersion: FORMULA_VERSION, weights: INDEX_WEIGHTS, recommendationRule: RECOMMENDATION_RULE },
  });
});
