import { db } from "@/lib/db";
import { handler, HttpError, json, requireProject, requireSession } from "@/lib/api";
import { enqueue } from "@/lib/jobs/queue";
import { assertOrgActive } from "@/lib/billing/access";
import { crawlRetryAfterSec } from "@/lib/billing/ai-limits";

type Ctx = { params: Promise<{ id: string }> };

const ACTIVE_STATUSES = ["queued", "running", "retry_scheduled"];
const STALE_AFTER_MS = 2 * 60 * 60 * 1000; // a run stuck this long no longer blocks new crawls

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  await assertOrgActive(s.organizationId);

  const active = await db.crawlRun.findFirst({
    where: {
      organizationId: s.organizationId,
      projectId: project.id,
      status: { in: ACTIVE_STATUSES },
      createdAt: { gt: new Date(Date.now() - STALE_AFTER_MS) },
    },
    select: { id: true, status: true },
  });
  if (active) throw new HttpError(409, "crawl_in_progress", "A crawl is already queued or running for this project", { crawlRunId: active.id });

  // One crawl per project every 10 minutes.
  const retryAfterSec = await crawlRetryAfterSec(s.organizationId, project.id);
  if (retryAfterSec > 0) {
    const mins = Math.ceil(retryAfterSec / 60);
    return json(
      {
        error: {
          code: "crawl_rate_limited",
          message: `This site was scanned a moment ago. You can start another scan in about ${mins} minute${mins === 1 ? "" : "s"}.`,
          details: { retryAfterSec },
        },
      },
      { status: 409, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  const run = await db.crawlRun.create({ data: { organizationId: s.organizationId, projectId: project.id, status: "queued" } });
  const wf = await enqueue({
    kind: "crawl",
    organizationId: s.organizationId,
    projectId: project.id,
    input: { crawlRunId: run.id },
    idempotencyKey: `crawl:${run.id}`,
    maxAttempts: 3,
  });
  const item = await db.crawlRun.update({ where: { id: run.id }, data: { workflowRunId: wf.id } });
  return json({ item }, { status: 201 });
});

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const project = await requireProject(s, id);
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 20, 1), 100);
  const cursor = sp.get("cursor");

  const rows = await db.crawlRun.findMany({
    where: { organizationId: s.organizationId, projectId: project.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return json({ items, nextCursor: hasMore ? items[items.length - 1].id : undefined });
});
