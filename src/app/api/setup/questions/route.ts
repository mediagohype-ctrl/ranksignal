// POST /api/setup/questions {facts, competitors} — the customer questions for setup screen 4. The count follows the
// plan's questions-per-check cap (10–25), and never exceeds the organization's remaining tracked-question room.
import { z } from "zod";
import { db } from "@/lib/db";
import { handler, HttpError, json, parseBody, requireSession } from "@/lib/api";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getPlanWithAiLimits } from "@/lib/billing/plans";
import { setupQuestionCount } from "@/lib/setup/facts";
import { suggestQuestions } from "@/lib/setup/suggest";
import { competitorBody, factsBody, SETUP_RATE } from "../schemas";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ facts: factsBody, competitors: z.array(competitorBody).max(20).default([]) });

export const POST = handler(async (req: Request) => {
  const s = await requireSession("member");
  if (!checkRateLimit(`setup:${s.userId}`, SETUP_RATE.limit, SETUP_RATE.windowMs).allowed) {
    throw new HttpError(429, "rate_limited", "Too many tries in a short time. Wait a few minutes, then try again.");
  }
  const { facts, competitors } = await parseBody(req, bodySchema);
  const [org, active] = await Promise.all([
    db.organization.findUnique({ where: { id: s.organizationId }, select: { planId: true } }),
    db.trackedPrompt.count({ where: { organizationId: s.organizationId, active: true } }),
  ]);
  const plan = getPlanWithAiLimits(org?.planId ?? "trial");
  const room = Math.max(0, plan.maxTrackedPrompts - active);
  const count = Math.min(setupQuestionCount(plan.maxPromptsPerRun), room);
  if (count === 0) {
    throw new HttpError(402, "plan_limit", `Your ${plan.name} plan's customer questions are all in use. Upgrade, or remove some questions from another website.`);
  }
  const { items, source } = await suggestQuestions(facts, competitors, count);
  return json({ items: items.map((q) => ({ text: q.text, intent: q.intent, topic: q.topic, locale: q.locale })), source, max: count });
});
