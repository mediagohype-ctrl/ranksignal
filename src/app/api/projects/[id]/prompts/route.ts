import { z } from "zod";
import { db } from "@/lib/db";
import { handler, HttpError, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { assertPromptLimit } from "@/lib/billing/usage";
import { dedupePrompts, PROMPT_INTENTS, researchPrompts } from "@/lib/prompts/research";
import { currentPromptSetVersion, defaultLocale, researchProfileFromProject } from "@/lib/prompts/service";

type Ctx = { params: Promise<{ id: string }> };

const promptItem = z.object({
  text: z.string().trim().min(3).max(500),
  intent: z.enum(PROMPT_INTENTS).optional(),
  topic: z.string().trim().max(120).nullish(),
  locale: z.string().trim().min(2).max(10).optional(),
  priority: z.number().int().min(1).max(3).optional(),
});

const bodySchema = z.union([
  z.object({ prompts: z.array(promptItem).min(1).max(200) }),
  z.object({ generate: z.literal(true), save: z.boolean().optional(), max: z.number().int().min(1).max(50).optional() }),
]);

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const activeParam = url.searchParams.get("active");
  const take = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));
  const rows = await db.trackedPrompt.findMany({
    where: {
      organizationId: s.organizationId,
      projectId: project.id,
      ...(activeParam === null ? {} : { active: activeParam !== "false" }),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, take);
  return json({
    items,
    nextCursor: rows.length > take ? items[items.length - 1].id : undefined,
    promptSetVersion: await currentPromptSetVersion(s.organizationId, project.id),
  });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id } = await params;
  const project = await requireProject(s, id);
  const body = await parseBody(req, bodySchema);

  const existing = await db.trackedPrompt.findMany({
    where: { organizationId: s.organizationId, projectId: project.id, active: true },
    select: { text: true },
  });
  const existingTexts = existing.map((e) => e.text);
  const locale = defaultLocale(project);

  let toSave: { text: string; intent: string; topic: string | null; locale: string; priority?: number }[];
  if ("generate" in body) {
    const { candidates, source, costMicros } = await researchPrompts(researchProfileFromProject(project), {
      max: body.max ?? 25,
      existing: existingTexts,
    });
    if (!body.save) return json({ items: candidates, source, costMicros, saved: false });
    toSave = candidates.map((c) => ({ text: c.text, intent: c.intent, topic: c.topic, locale: c.locale }));
  } else {
    toSave = dedupePrompts(body.prompts, existingTexts).map((p) => ({
      text: p.text,
      intent: p.intent ?? "informational",
      topic: p.topic ?? null,
      locale: p.locale ?? locale,
      priority: p.priority,
    }));
  }
  if (toSave.length === 0) throw new HttpError(409, "duplicate", "All prompts duplicate existing tracked prompts");
  await assertPromptLimit(s.organizationId, project.id, toSave.length);

  const version = await currentPromptSetVersion(s.organizationId, project.id);
  const created = await db.$transaction(
    toSave.map((p) =>
      db.trackedPrompt.create({
        data: { organizationId: s.organizationId, projectId: project.id, promptSetVersion: version, ...p },
      }),
    ),
  );
  return json({ items: created, saved: true, skippedDuplicates: ("prompts" in body ? body.prompts.length : created.length) - created.length }, { status: 201 });
});
