import { z } from "zod";
import { handler, json, requireProject, requireSession } from "@/lib/api";
import { enqueue } from "@/lib/jobs/queue";
import { writeAuditLog } from "@/lib/audit-log";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  crawlRunId: z.string().max(64).optional(),
  visibilityRunId: z.string().max(64).optional(),
}).default({});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  const project = await requireProject(s, id);
  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = bodySchema.parse(raw ?? {});
  // One analysis per project per minute (double-click / retry protection).
  const bucket = Math.floor(Date.now() / 60_000);
  const run = await enqueue({
    kind: "analyze",
    organizationId: s.organizationId,
    projectId: project.id,
    input: { trigger: "manual", ...body },
    idempotencyKey: `analyze:${project.id}:${bucket}`,
  });
  await writeAuditLog({ organizationId: s.organizationId, actorId: s.userId, action: "analyze.requested", resourceType: "project", resourceId: project.id, after: { workflowRunId: run.id } });
  return json({ item: { workflowRunId: run.id, state: run.state } }, { status: 202 });
});
