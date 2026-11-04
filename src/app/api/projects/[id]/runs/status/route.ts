// Lightweight status of the latest website check and AI check for a project — polled by RunWatcher
// (src/components/app/run-watcher.tsx) to show a toast when a run finishes. Tenant-scoped, read-only.
import { db } from "@/lib/db";
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { runStatusPayload } from "@/lib/dashboard/run-status";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const where = { organizationId: s.organizationId, projectId: project.id };

  const [crawl, vis] = await Promise.all([
    db.crawlRun.findFirst({ where, orderBy: { createdAt: "desc" }, select: { id: true, status: true, finishedAt: true } }),
    db.visibilityRun.findFirst({ where, orderBy: { createdAt: "desc" }, select: { id: true, status: true, finishedAt: true, collected: true, metrics: true } }),
  ]);
  // The score comes from the snapshot written when the run finished (the same number Home, Report and History show).
  const snap = crawl
    ? await db.reportSnapshot.findFirst({
        where: { ...where, crawlRunId: crawl.id },
        orderBy: { createdAt: "desc" },
        select: { overallScore: true },
      })
    : null;
  return json(runStatusPayload(crawl, snap, vis), { headers: { "Cache-Control": "no-store" } });
});
