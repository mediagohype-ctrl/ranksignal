import { z } from "zod";
import { db } from "@/lib/db";
import { handler, HttpError, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { assertPromptLimit } from "@/lib/billing/usage";
import { PROMPT_INTENTS } from "@/lib/prompts/research";
import { bumpPromptSetVersion } from "@/lib/prompts/service";

type Ctx = { params: Promise<{ id: string; promptId: string }> };

const patchSchema = z
  .object({
    text: z.string().trim().min(3).max(500).optional(),
    intent: z.enum(PROMPT_INTENTS).optional(),
    topic: z.string().trim().max(120).nullable().optional(),
    locale: z.string().trim().min(2).max(10).optional(),
    priority: z.number().int().min(1).max(3).optional(),
    active: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "No fields to update");

async function loadPrompt(orgId: string, projectId: string, promptId: string) {
  const prompt = await db.trackedPrompt.findFirst({ where: { id: promptId, organizationId: orgId, projectId } });
  if (!prompt) throw new HttpError(404, "not_found", "Prompt not found");
  return prompt;
}

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id, promptId } = await params;
  const project = await requireProject(s, id);
  const prompt = await loadPrompt(s.organizationId, project.id, promptId);
  const body = await parseBody(req, patchSchema);

  if (body.active === true && !prompt.active) await assertPromptLimit(s.organizationId, project.id, 1);
  const textChanged = body.text !== undefined && body.text !== prompt.text;
  const localeChanged = body.locale !== undefined && body.locale !== prompt.locale;

  await db.trackedPrompt.update({ where: { id: prompt.id }, data: body });
  // Changing what is asked is a measurement discontinuity: bump the project's prompt-set version.
  const promptSetVersion = textChanged || localeChanged ? await bumpPromptSetVersion(s.organizationId, project.id) : prompt.promptSetVersion;
  const item = await db.trackedPrompt.findUniqueOrThrow({ where: { id: prompt.id } });
  return json({ item, promptSetVersion, discontinuity: textChanged || localeChanged });
});

/** Soft delete (deactivate) so historical observations stay intact. `?hard=true` (admin) removes it with its history. */
export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const hard = new URL(req.url).searchParams.get("hard") === "true";
  const s = await requireSession(hard ? "admin" : "member");
  const { id, promptId } = await params;
  const project = await requireProject(s, id);
  const prompt = await loadPrompt(s.organizationId, project.id, promptId);
  if (hard) {
    await db.trackedPrompt.delete({ where: { id: prompt.id } });
    return json({ ok: true, deleted: true });
  }
  const item = await db.trackedPrompt.update({ where: { id: prompt.id }, data: { active: false } });
  return json({ item, deleted: false });
});
