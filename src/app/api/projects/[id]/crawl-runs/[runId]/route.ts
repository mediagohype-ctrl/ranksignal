import { db } from "@/lib/db";
import { handler, HttpError, json, requireProject, requireSession } from "@/lib/api";
import type { ExtractedPage } from "@/lib/types";

type Ctx = { params: Promise<{ id: string; runId: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const { id, runId } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const run = await db.crawlRun.findFirst({ where: { id: runId, organizationId: s.organizationId, projectId: project.id } });
  if (!run) throw new HttpError(404, "not_found", "Crawl run not found");

  const rows = await db.crawlPage.findMany({
    where: { crawlRunId: run.id, organizationId: s.organizationId },
    orderBy: { crawledAt: "asc" },
    take: 500,
  });
  const byStatus: Record<string, number> = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0, error: 0 };
  const pages = rows.map((r) => {
    const x = (r.extracted as ExtractedPage | null) ?? null;
    const bucket = r.statusCode === null ? "error" : `${Math.floor(r.statusCode / 100)}xx`;
    byStatus[bucket] = (byStatus[bucket] ?? 0) + 1;
    return {
      id: r.id,
      url: r.url,
      finalUrl: r.finalUrl,
      statusCode: r.statusCode,
      contentType: r.contentType,
      responseBytes: r.responseBytes,
      redirects: Array.isArray(r.redirectChain) ? r.redirectChain.length : 0,
      title: x?.title ?? null,
      wordCount: x?.wordCount ?? null,
      schemaTypes: x?.schemaTypes ?? [],
      error: r.error,
      crawledAt: r.crawledAt,
    };
  });
  const findingCounts = await db.auditFinding.groupBy({
    by: ["severity"],
    where: { organizationId: s.organizationId, projectId: project.id, status: "open" },
    _count: { _all: true },
  });
  return json({
    item: {
      ...run,
      summary: {
        pages: rows.length,
        byStatus,
        openFindingsBySeverity: Object.fromEntries(findingCounts.map((f) => [f.severity, f._count._all])),
      },
      pages,
    },
  });
});
