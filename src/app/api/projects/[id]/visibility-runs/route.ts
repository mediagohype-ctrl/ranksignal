import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler, HttpError, json, requireProject, requireSession } from "@/lib/api";
import { enqueue } from "@/lib/jobs/queue";
import { currentPromptSetVersion } from "@/lib/prompts/service";

type Ctx = { params: Promise<{ id: string }> };

const ACTIVE_STATUSES = ["queued", "running"];
const createSchema = z.object({ providers: z.array(z.enum(["openai", "gemini", "perplexity", "dataforseo", "simulated"])).max(5).optional() });

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const take = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const rows = await db.visibilityRun.findMany({
    where: { organizationId: s.organizationId, projectId: project.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, take);
  return json({ items, nextCursor: rows.length > take ? items[items.length - 1].id : undefined });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id } = await params;
  const project = await requireProject(s, id);
  let raw: unknown = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new HttpError(400, "invalid_json", "Request body must be JSON");
    }
  }
  const body = createSchema.parse(raw);

  const active = await db.visibilityRun.findFirst({
    where: { organizationId: s.organizationId, projectId: project.id, status: { in: ACTIVE_STATUSES } },
  });
  if (active) throw new HttpError(409, "run_in_progress", "A visibility run is already in progress for this project", { runId: active.id });

  const promptCount = await db.trackedPrompt.count({ where: { organizationId: s.organizationId, projectId: project.id, active: true } });
  if (promptCount === 0) throw new HttpError(400, "no_prompts", "Add at least one tracked prompt before running a visibility scan");

  const run = await db.visibilityRun.create({
    data: {
      organizationId: s.organizationId,
      projectId: project.id,
      status: "queued",
      promptSetVersion: await currentPromptSetVersion(s.organizationId, project.id),
      providers: body.providers ? (body.providers as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
  const wf = await enqueue({
    kind: "visibility",
    organizationId: s.organizationId,
    projectId: project.id,
    input: { visibilityRunId: run.id, requestedBy: s.userId },
    idempotencyKey: `visibility:${run.id}`,
  });
  const item = await db.visibilityRun.update({ where: { id: run.id }, data: { workflowRunId: wf.id } });
  return json({ item }, { status: 201 });
});
