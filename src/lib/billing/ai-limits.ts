// Per-plan AI limits (AI answers per month) + scan rate limits. Cost protection on top of internal credits and
// the daily AI budget (ai-budget.ts). Customer copy talks about "AI answers" only — never credits.
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/dashboard/format";
import { getAiAllowance, utcMonthStart, type AiAllowance } from "./allowance";
import { answersPerCheck, getEngineLimit, getPlanWithAiLimits, questionsPerCheck } from "./plans";

export { utcMonthStart };
export const CRAWL_MIN_INTERVAL_MS = 10 * 60 * 1000;

export interface VisibilityRunAllowance {
  /** AI answers used (or held by checks in progress) this month. */
  used: number;
  /** AI answers per month on the plan. */
  limit: number;
  /** AI answers left (plan answers left + extra answers from top-up packs). */
  remaining: number;
  /** Plan answers left this month. */
  monthlyLeft: number;
  /** Extra answers left from top-up packs. */
  extraLeft: number;
  maxPromptsPerRun: number;
  /** AI answers a full check uses on this plan. */
  answersPerCheck: number;
  period: string;
  resetsAt: Date | null;
}

export async function getVisibilityRunAllowance(orgId: string, now = new Date()): Promise<VisibilityRunAllowance> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true } });
  const planId = org?.planId ?? "trial";
  const a = await getAiAllowance(orgId, { now });
  return {
    used: a.used,
    limit: a.cap,
    remaining: a.left,
    monthlyLeft: a.monthlyLeft,
    extraLeft: a.extra.left,
    maxPromptsPerRun: questionsPerCheck(planId),
    answersPerCheck: answersPerCheck(planId),
    period: now.toISOString().slice(0, 7),
    resetsAt: a.resetsAt,
  };
}

/** Plain sentence for "no AI answers left", with the reset date (or the upgrade path on the trial). */
export function aiLimitMessage(a: Pick<AiAllowance, "cap" | "resetsAt">): string {
  const n = a.cap.toLocaleString("en-IN");
  // Only shown when plan answers AND any extra answers are used up (left counts both).
  return a.resetsAt
    ? `You've used all ${n} AI answers in your plan this month. They reset on ${fmtDate(a.resetsAt)}. Buy extra answers or upgrade if you need more before then.`
    : `You've used the ${n} AI answers in your free trial. Choose a plan, or buy extra answers, to keep checking what AI says about you.`;
}

/** HttpError 402 "plan_limit" when this month's AI answers are used up. */
export async function assertVisibilityRunAllowed(orgId: string, now = new Date()): Promise<VisibilityRunAllowance> {
  const a = await getVisibilityRunAllowance(orgId, now);
  if (a.remaining <= 0) {
    throw new HttpError(402, "plan_limit", aiLimitMessage({ cap: a.limit, resetsAt: a.resetsAt }), {
      limit: a.limit,
      used: a.used,
      resetsAt: a.resetsAt?.toISOString() ?? null,
      upgradeUrl: "/app/settings?tab=billing",
    });
  }
  return a;
}

/**
 * Max tracked prompts a single visibility run may ask (plan.maxPromptsPerRun, never above maxTrackedPrompts).
 * The visibility job should use this as the `take` for its prompt query.
 */
export async function getRunPromptCap(orgId: string): Promise<number> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true } });
  const plan = getPlanWithAiLimits(org?.planId ?? "trial");
  return Math.min(plan.maxPromptsPerRun, plan.maxTrackedPrompts);
}

/** AI assistants one check asks for this organization (plan, or every engine for done-for-you clients). */
export async function getOrgEngineLimit(orgId: string): Promise<number> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true, serviceTier: true } });
  return getEngineLimit(org?.planId ?? "trial", org?.serviceTier);
}

/**
 * Fit one AI check into the answers left: keep every engine and drop questions first (so engines stay
 * comparable); with fewer answers left than engines, ask one question on as many engines as fit. Pure.
 */
export function sizeRunToAllowance(left: number, questions: number, engines: number): { questions: number; engines: number } {
  const l = Math.max(0, Math.floor(left));
  if (l === 0 || questions <= 0 || engines <= 0) return { questions: 0, engines: 0 };
  if (questions * engines <= l) return { questions, engines };
  const q = Math.floor(l / engines);
  return q >= 1 ? { questions: q, engines } : { questions: 1, engines: Math.min(engines, l) };
}

/** What the next AI check of a website will really ask and use — shown in the "Check AI" confirmation. */
export interface AiCheckEstimate {
  /** AI answers this check will use (questions × AI tools, fitted into the answers left). 0 = free sample answers. */
  answers: number;
  questions: number;
  engines: number;
  /** AI answers left right now (plan + extra). */
  left: number;
  /** What a full check would ask / use if enough answers were left. */
  fullQuestions: number;
  fullAnswers: number;
  /** True when fewer answers are left than a full check needs, so fewer questions will be asked. */
  partial: boolean;
  /** False on the free trial (its answers don't reset monthly). */
  monthly: boolean;
}

/** Pure: size the next check exactly like the visibility job does (sizeRunToAllowance). */
export function estimateAiCheck(o: { left: number; activeQuestions: number; questionsPerCheck: number; engines: number; monthly?: boolean }): AiCheckEstimate {
  const left = Math.max(0, Math.floor(o.left));
  const fullQuestions = Math.max(0, Math.min(o.activeQuestions, o.questionsPerCheck));
  const engines = Math.max(0, o.engines);
  const fit = sizeRunToAllowance(left, fullQuestions, engines);
  return {
    answers: fit.questions * fit.engines,
    questions: fit.questions,
    engines: fit.engines,
    left,
    fullQuestions,
    fullAnswers: fullQuestions * engines,
    partial: fit.questions * fit.engines < fullQuestions * engines,
    monthly: o.monthly !== false,
  };
}

const num = (x: number) => x.toLocaleString("en-IN");
const many = (x: number, one: string) => `${num(x)} ${x === 1 ? one : `${one}s`}`;

/**
 * The sentence shown before an AI check starts, with the real numbers:
 * "This uses 75 of your 225 AI answers left this month. Continue?" Null when the check is free (sample answers)
 * or can't start (the button is already disabled then). Pure.
 */
export function aiCheckConfirmText(e: AiCheckEstimate): string | null {
  if (e.answers <= 0) return null;
  const when = e.monthly ? " this month" : " in your free trial";
  const uses = `This uses ${num(e.answers)} of your ${many(e.left, "AI answer")} left${when}.`;
  if (!e.partial) return `${uses} Continue?`;
  return (
    `You have ${many(e.left, "AI answer")} left${when} — not enough for a full check (${num(e.fullAnswers)}). ` +
    `We'll ask ${num(e.questions)} of your ${many(e.fullQuestions, "question")} on ${many(e.engines, "AI tool")}. ${uses} Continue?`
  );
}

/** Estimate for one website: its active questions, the plan's questions per check and the AI tools a check will ask. */
export async function getAiCheckEstimate(orgId: string, projectId: string, now = new Date()): Promise<AiCheckEstimate> {
  const [allowance, activeQuestions, limit] = await Promise.all([
    getVisibilityRunAllowance(orgId, now),
    db.trackedPrompt.count({ where: { organizationId: orgId, projectId, active: true } }),
    getOrgEngineLimit(orgId),
  ]);
  let engines = limit;
  try {
    const { getConfiguredRealProviders } = await import("@/lib/providers/visibility/registry");
    engines = Math.min(limit, (await getConfiguredRealProviders()).length); // 0 = only sample answers, which are free
  } catch {
    // Registry unavailable: assume every AI tool the plan includes.
  }
  return estimateAiCheck({
    left: allowance.remaining,
    activeQuestions,
    questionsPerCheck: allowance.maxPromptsPerRun,
    engines,
    monthly: allowance.resetsAt !== null,
  });
}

/**
 * Seconds until a new crawl may start for this project (0 = allowed). One crawl per CRAWL_MIN_INTERVAL_MS;
 * crawls that failed without reading any page don't count (so a fixed URL can be retried at once).
 */
export async function crawlRetryAfterSec(orgId: string, projectId: string, now = new Date()): Promise<number> {
  const last = await db.crawlRun.findFirst({
    where: {
      organizationId: orgId,
      projectId,
      createdAt: { gt: new Date(now.getTime() - CRAWL_MIN_INTERVAL_MS) },
      NOT: { status: { in: ["failed", "cancelled"] }, pagesCrawled: 0 },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!last) return 0;
  return Math.max(1, Math.ceil((last.createdAt.getTime() + CRAWL_MIN_INTERVAL_MS - now.getTime()) / 1000));
}
