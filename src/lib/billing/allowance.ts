// What a workspace may still use, in customer words: "AI answers left: 820 of 1,200 monthly + 400 extra".
// One AI answer = one customer question asked to one AI assistant. Credits stay internal (cost tracking).
//
//   used        = real answers collected this month by the whole account (simulated answers are free; websites
//                 deleted or replaced since still count — see below) + answers still expected by AI
//                 checks in progress (queued, running, or waiting until tomorrow for the daily budget), so two checks
//                 can't both be promised the same answers.
//   monthlyLeft = cap − used (never below 0). `used` is shown capped at `cap`.
//   extra.left  = extra AI answers from one-time top-up packs (src/lib/billing/topups.ts) still unused and unexpired.
//   left        = monthlyLeft + extra.left — what a check may use right now.
// Trial: the plan's 30 answers cover the whole trial (not per calendar month), so resetsAt is null; trial answers
// are used first, then extra answers.
//
// Extra answers are DATA, not a mutable counter: TopUpPack rows (answers, purchasedAt, expiresAt, status) plus a
// monthly settlement. Answers taken from packs in a month = max(0, answers collected that month − plan cap),
// allocated FIFO (oldest unexpired pack first; an answer can only come from a pack that was valid when it was
// collected). When a month closes, settleTopUps() stores each pack's consumed total (TopUpSettlement row per org +
// month, idempotent) so reads only have to work out the current month. Settlement runs lazily on read and from the
// scheduler. The plan cap used for a closed month is the plan at settlement time (settled within minutes of the
// month change by the scheduler); a month before the first paid subscription counts as trial.
//
// DELETING OR REPLACING A WEBSITE DOES NOT GIVE ANSWERS BACK (owner decision 2, 15 Nov 2026). Answers are counted
// per ACCOUNT per month. Observation rows are deleted together with their website (Project → VisibilityRun →
// Observation cascade; removing a tracked question deletes its observations too), so counting only those rows let a
// customer delete a website and get the month's answers again (225 → 300 in the audit). The usage ledger
// (UsageLedger, taskType "visibility_prompt", kind "actual", 1 credit per real answer, 0 for simulated ones) belongs
// to the organization and is NOT deleted with a website, so countRealAnswers() takes
//     max(observation rows still stored, answers the ledger recorded)
// for the same time window. max — not the ledger alone — because the ledger is written in small batches and can be
// a few answers behind while a check runs; and not a "deleted answers" counter written only at delete time, because
// that would cover just the delete button (not question removal, staff clean-ups, or a crash between two writes).
// keepAnswersOfDeletedProject() closes the last gap: answers a crashed check collected but never wrote to the
// ledger are written just before the website is deleted. Checks still in progress on the deleted website are
// deleted with it, so the answers they were holding are released; the ones already collected stay used.
import { db } from "@/lib/db";
import { getPlanWithAiLimits } from "./plans";
import { billingPeriod } from "./usage";

export interface ExtraAnswersPack {
  id: string;
  left: number;
  expiresAt: Date;
}

export interface AiAllowance {
  /** Plan answers used (capped at `cap`). */
  used: number;
  /** Plan answers per month (trial: for the whole trial). */
  cap: number;
  /** Everything usable now: plan answers left + extra answers left. */
  left: number;
  /** Plan answers left (never below 0). */
  monthlyLeft: number;
  /** Start of the next month (UTC) when the plan's answers reset; null on the free trial (no reset). */
  resetsAt: Date | null;
  /** Extra answers from top-up packs: total left, earliest expiry of a pack that still has answers, per pack. */
  extra: { left: number; expiresAt: Date | null; packs: ExtraAnswersPack[] };
}

/** Ledger task type of one AI answer (same value as VISIBILITY_TASK_TYPE in src/lib/visibility/job.ts). */
export const AI_ANSWER_TASK_TYPE = "visibility_prompt";
/** Ledger provider of the catch-up row written when a website is deleted (see keepAnswersOfDeletedProject). */
export const DELETED_WEBSITE_PROVIDER = "deleted_website";

/** Runs that still hold answers they are expected to collect. */
export const IN_FLIGHT_RUN_STATUSES = ["queued", "running"];

export function utcMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextUtcMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** Answers an in-progress run still expects (expected − collected − failed, never below 0). */
export function outstandingAnswers(r: { sampleSize: number; collected: number; failed: number }): number {
  return Math.max(0, r.sampleSize - r.collected - r.failed);
}

// ---------------------------------------------------------------------------------------------------- packs (pure)

/** A top-up pack as the allowance math sees it. */
export interface TopUpPackState {
  id: string;
  answers: number;
  /** Answers settled as used in closed months. */
  consumed: number;
  /** Unused answers taken back by a refund (never more than were unused at that time). */
  revokedAnswers: number;
  purchasedAt: Date;
  expiresAt: Date;
  /** paid | refunded */
  status: string;
}

/** Answers a pack can still give, before this (unsettled) period's use. */
export function packUnsettledLeft(p: Pick<TopUpPackState, "answers" | "consumed" | "revokedAnswers">): number {
  return Math.max(0, Math.floor(p.answers) - Math.max(0, p.revokedAnswers) - Math.max(0, p.consumed));
}

const byOldest = (a: TopUpPackState, b: TopUpPackState) =>
  a.expiresAt.getTime() - b.expiresAt.getTime() || a.purchasedAt.getTime() - b.purchasedAt.getTime() || a.id.localeCompare(b.id);

/**
 * Allocates `overflow` answers (used beyond the plan in the period [windowStart, until)) to packs, oldest first.
 * A pack that expired inside the window can only take answers collected before it expired:
 * `overflowBefore[packId]` = overflow answers that had been collected by that pack's expiry (omit for packs that
 * stay valid to `until`). Pure.
 */
export function allocateOverflow(
  packs: TopUpPackState[],
  overflow: number,
  o: { windowStart: Date; until: Date; overflowBefore?: Record<string, number> },
): { byPack: Record<string, number>; allocated: number; unallocated: number } {
  const total = Math.max(0, Math.floor(overflow));
  const byPack: Record<string, number> = {};
  let allocated = 0;
  const eligible = packs
    .filter((p) => p.purchasedAt.getTime() < o.until.getTime() && p.expiresAt.getTime() > o.windowStart.getTime())
    .sort(byOldest);
  for (const p of eligible) {
    if (allocated >= total) break;
    const expiredInside = p.expiresAt.getTime() <= o.until.getTime();
    const reach = expiredInside ? Math.min(total, Math.max(0, Math.floor(o.overflowBefore?.[p.id] ?? total))) : total;
    const take = Math.min(packUnsettledLeft(p), Math.max(0, reach - allocated));
    if (take > 0) {
      byPack[p.id] = take;
      allocated += take;
    }
  }
  return { byPack, allocated, unallocated: total - allocated };
}

/** Answers already settled from packs (trial: the trial cap counts across months, so earlier overflow is offset). */
export function settledConsumed(packs: Pick<TopUpPackState, "consumed">[]): number {
  return packs.reduce((a, p) => a + Math.max(0, p.consumed), 0);
}

/** Pure allowance math (exported for tests). */
export function computeAiAllowance(o: {
  cap: number;
  collected: number;
  inFlight: { sampleSize: number; collected: number; failed: number }[];
  trial: boolean;
  now?: Date;
  /** Top-up packs (paid and refunded) that may cover this period. */
  packs?: TopUpPackState[];
  /** Overflow answers collected before each pack that expired earlier in this period (see allocateOverflow). */
  overflowBefore?: Record<string, number>;
}): AiAllowance {
  const now = o.now ?? new Date();
  const cap = Math.max(0, Math.floor(o.cap));
  const pending = o.inFlight.reduce((a, r) => a + outstandingAnswers(r), 0);
  const used = Math.max(0, o.collected) + pending;
  const packs = o.packs ?? [];
  // Trial answers are counted since signup, so earlier months' overflow (already settled from packs) is removed.
  const base = cap + (o.trial ? settledConsumed(packs) : 0);
  const overflow = Math.max(0, used - base);
  const { byPack } = allocateOverflow(packs, overflow, { windowStart: utcMonthStart(now), until: now, overflowBefore: o.overflowBefore });
  const extraPacks: ExtraAnswersPack[] = packs
    .filter((p) => p.status === "paid" && p.expiresAt.getTime() > now.getTime() && p.purchasedAt.getTime() <= now.getTime())
    .sort(byOldest)
    .map((p) => ({ id: p.id, left: Math.max(0, packUnsettledLeft(p) - (byPack[p.id] ?? 0)), expiresAt: p.expiresAt }));
  const extraLeft = extraPacks.reduce((a, p) => a + p.left, 0);
  const monthlyLeft = Math.max(0, cap - used);
  return {
    // Shown as "used of cap": never more than the cap (extra answers are shown separately).
    used: Math.min(used, cap),
    cap,
    left: monthlyLeft + extraLeft,
    monthlyLeft,
    resetsAt: o.trial ? null : nextUtcMonthStart(now),
    extra: { left: extraLeft, expiresAt: extraPacks.find((p) => p.left > 0)?.expiresAt ?? null, packs: extraPacks },
  };
}

// ---------------------------------------------------------------------------------------------------- DB

const PACK_SELECT = {
  id: true,
  answers: true,
  consumed: true,
  revokedAnswers: true,
  purchasedAt: true,
  expiresAt: true,
  status: true,
  settledThrough: true,
} as const;

type PackRow = TopUpPackState & { settledThrough: Date };

/** A pack still has closed months whose use isn't stored yet. */
export function needsSettlement(p: Pick<PackRow, "settledThrough" | "expiresAt">, monthStart: Date): boolean {
  return p.settledThrough.getTime() < monthStart.getTime() && p.expiresAt.getTime() > p.settledThrough.getTime();
}

async function loadPacks(orgId: string, expiringAfter: Date | null): Promise<PackRow[]> {
  return db.topUpPack.findMany({
    where: { organizationId: orgId, ...(expiringAfter ? { expiresAt: { gt: expiringAfter } } : {}) },
    select: PACK_SELECT,
  });
}

type CountClient = Pick<typeof db, "observation" | "usageLedger">;

/**
 * Real (not simulated) AI answers the account collected in a time window — immune to website / question deletion:
 * max(observation rows still stored, answers recorded in the usage ledger). See the note at the top of this file.
 */
export async function countRealAnswers(client: CountClient, orgId: string, createdAt: { gte: Date; lt?: Date }): Promise<number> {
  const [stored, ledger] = await Promise.all([
    client.observation.count({ where: { organizationId: orgId, simulated: false, createdAt } }),
    client.usageLedger.aggregate({
      where: { organizationId: orgId, taskType: AI_ANSWER_TASK_TYPE, kind: "actual", createdAt },
      _sum: { credits: true },
    }),
  ]);
  return Math.max(stored, ledger._sum.credits ?? 0);
}

/**
 * Call just BEFORE a website (project) is deleted or replaced. Normally the ledger already holds every answer of
 * the website; if a check crashed before writing its last batch, this writes the difference so those answers stay
 * counted after the rows are gone. Checks that are running right now are skipped — they write their own remaining
 * usage when they stop. Returns the answers added to the ledger (0 almost always).
 */
export async function keepAnswersOfDeletedProject(orgId: string, projectId: string, now = new Date()): Promise<number> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true, createdAt: true } });
  if (!org) return 0;
  const since = org.planId === "trial" ? org.createdAt : utcMonthStart(now);
  const runs = await db.visibilityRun.findMany({
    where: { organizationId: orgId, projectId, status: { not: "running" } },
    select: { id: true },
  });
  if (runs.length === 0) return 0;
  const runIds = runs.map((r) => r.id);
  const [stored, ledger] = await Promise.all([
    db.observation.count({ where: { organizationId: orgId, simulated: false, createdAt: { gte: since }, visibilityRunId: { in: runIds } } }),
    db.usageLedger.aggregate({
      where: { organizationId: orgId, taskType: AI_ANSWER_TASK_TYPE, kind: "actual", createdAt: { gte: since }, runId: { in: runIds } },
      _sum: { credits: true },
    }),
  ]);
  const missing = stored - (ledger._sum.credits ?? 0);
  if (missing <= 0) return 0;
  await db.usageLedger.create({
    data: {
      organizationId: orgId,
      projectId,
      provider: DELETED_WEBSITE_PROVIDER,
      taskType: AI_ANSWER_TASK_TYPE,
      kind: "actual",
      credits: missing,
      costMicros: 0,
      billingPeriod: billingPeriod(now),
    },
  });
  return missing;
}

/** Overflow answers collected before each pack that expired between windowStart and `until`. */
async function overflowBeforeExpiries(
  client: CountClient,
  orgId: string,
  packs: TopUpPackState[],
  o: { since: Date; windowStart: Date; until: Date; base: number },
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const expiring = packs.filter((p) => p.expiresAt > o.windowStart && p.expiresAt <= o.until);
  for (const p of expiring) {
    const n = await countRealAnswers(client, orgId, { gte: o.since, lt: p.expiresAt });
    out[p.id] = Math.max(0, n - o.base);
  }
  return out;
}

/** Whether a closed month [monthStart, monthEnd) counts as trial: org on trial, or no paid subscription before it ended. */
function trialForMonth(planId: string, firstPaidAt: Date | null, monthEnd: Date): boolean {
  if (planId === "trial") return true;
  return firstPaidAt !== null && firstPaidAt.getTime() >= monthEnd.getTime();
}

/**
 * Stores how many extra answers each pack gave in every closed month not settled yet (oldest month first).
 * Idempotent: one TopUpSettlement row per organization + month (checked under a per-organization advisory lock).
 * Returns the number of months settled by this call.
 */
export async function settleTopUps(orgId: string, now = new Date()): Promise<number> {
  const monthStart = utcMonthStart(now);
  const due = (await loadPacks(orgId, null)).filter((p) => needsSettlement(p, monthStart));
  if (due.length === 0) return 0;
  const [org, firstPaid] = await Promise.all([
    db.organization.findUnique({ where: { id: orgId }, select: { planId: true, createdAt: true } }),
    db.subscription.findFirst({
      where: { organizationId: orgId, providerSubscriptionId: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  if (!org) return 0;
  let month = utcMonthStart(new Date(Math.min(...due.map((p) => p.settledThrough.getTime()))));
  let settled = 0;
  while (month.getTime() < monthStart.getTime()) {
    const m = month;
    const mEnd = nextUtcMonthStart(m);
    const period = billingPeriod(m);
    const did = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`topup:${orgId}`}))`;
      const done = await tx.topUpSettlement.findUnique({ where: { organizationId_month: { organizationId: orgId, month: period } }, select: { id: true } });
      if (!done) {
        const packs = await tx.topUpPack.findMany({ where: { organizationId: orgId }, select: PACK_SELECT });
        const trial = trialForMonth(org.planId, firstPaid?.createdAt ?? null, mEnd);
        const cap = Math.max(0, getPlanWithAiLimits(trial ? "trial" : org.planId).aiAnswersPerMonth);
        const since = trial ? org.createdAt : m;
        const base = cap + (trial ? settledConsumed(packs) : 0);
        const collected = await countRealAnswers(tx, orgId, { gte: since, lt: mEnd });
        const overflow = Math.max(0, collected - base);
        const overflowBefore = overflow > 0 ? await overflowBeforeExpiries(tx, orgId, packs, { since, windowStart: m, until: mEnd, base }) : {};
        const alloc = allocateOverflow(packs, overflow, { windowStart: m, until: mEnd, overflowBefore });
        await tx.topUpSettlement.create({
          data: {
            organizationId: orgId,
            month: period,
            planId: trial ? "trial" : org.planId,
            cap,
            collected,
            overflow,
            allocated: alloc.allocated,
            allocations: alloc.byPack,
          },
        });
        for (const [id, n] of Object.entries(alloc.byPack)) {
          await tx.topUpPack.update({ where: { id }, data: { consumed: { increment: n } } });
        }
      }
      await tx.topUpPack.updateMany({ where: { organizationId: orgId, settledThrough: { lt: mEnd } }, data: { settledThrough: mEnd } });
      return !done;
    });
    if (did) settled++;
    month = mEnd;
  }
  return settled;
}

/** Scheduler step: settle every organization with packs that have unsettled closed months. Returns orgs settled. */
export async function settleAllTopUps(now = new Date()): Promise<number> {
  const monthStart = utcMonthStart(now);
  const rows = await db.topUpPack.findMany({
    where: { settledThrough: { lt: monthStart }, expiresAt: { gt: new Date(monthStart.getTime() - 400 * 24 * 60 * 60 * 1000) } },
    select: { organizationId: true },
    distinct: ["organizationId"],
    take: 200,
  });
  let n = 0;
  for (const r of rows) {
    try {
      if ((await settleTopUps(r.organizationId, now)) > 0) n++;
    } catch (e) {
      console.error(`[topups] settle failed for org ${r.organizationId}:`, e instanceof Error ? e.message : e);
    }
  }
  return n;
}

/**
 * AI answers used / left for an organization. `excludeRunId` leaves one run's outstanding answers out (the
 * visibility job uses it to size its own run).
 */
export async function getAiAllowance(orgId: string, o: { now?: Date; excludeRunId?: string } = {}): Promise<AiAllowance> {
  const now = o.now ?? new Date();
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true, createdAt: true } });
  const planId = org?.planId ?? "trial";
  const plan = getPlanWithAiLimits(planId);
  const trial = planId === "trial";
  // Trial answers count from signup; paid plans per calendar month (UTC), matching billingPeriod().
  const monthStart = utcMonthStart(now);
  const since = trial ? (org?.createdAt ?? monthStart) : monthStart;
  // Trial needs every pack (earlier months' settled use offsets the since-signup count); paid: packs valid this month.
  const packsAfter = trial ? null : monthStart;
  let packs = await loadPacks(orgId, packsAfter);
  if (packs.some((p) => needsSettlement(p, monthStart))) {
    try {
      await settleTopUps(orgId, now);
    } catch (e) {
      console.warn("[topups] lazy settle failed", (e as Error)?.name);
    }
    packs = await loadPacks(orgId, packsAfter);
  }
  const [collected, inFlight, overflowBefore] = await Promise.all([
    countRealAnswers(db, orgId, { gte: since }),
    db.visibilityRun.findMany({
      where: {
        organizationId: orgId,
        status: { in: IN_FLIGHT_RUN_STATUSES },
        createdAt: { gte: since },
        ...(o.excludeRunId ? { NOT: { id: o.excludeRunId } } : {}),
      },
      select: { sampleSize: true, collected: true, failed: true },
    }),
    packs.length
      ? overflowBeforeExpiries(db, orgId, packs, {
          since,
          windowStart: monthStart,
          until: now,
          base: plan.aiAnswersPerMonth + (trial ? settledConsumed(packs) : 0),
        })
      : Promise.resolve({}),
  ]);
  return computeAiAllowance({ cap: plan.aiAnswersPerMonth, collected, inFlight, trial, now, packs, overflowBefore });
}

/**
 * Value (INR, before GST) of the extra answers a workspace can still use this month — added to the monthly AI spend
 * cap (src/lib/billing/ai-budget.ts) so bought answers aren't blocked by the plan-price-based profit guard.
 */
export async function topUpValueInrThisMonth(orgId: string, now = new Date()): Promise<number> {
  const monthStart = utcMonthStart(now);
  const packs = await db.topUpPack.findMany({
    where: { organizationId: orgId, status: "paid", expiresAt: { gt: monthStart }, purchasedAt: { lt: nextUtcMonthStart(now) } },
    select: { answers: true, consumed: true, revokedAnswers: true, basePaise: true },
  });
  let paise = 0;
  for (const p of packs) if (p.answers > 0) paise += (packUnsettledLeft(p) * p.basePaise) / p.answers;
  return Math.round(paise) / 100;
}

export interface WebsiteCheckAllowance {
  /** False when this month's internal usage can't cover another full website check. */
  allowed: boolean;
  resetsAt: Date;
}

/**
 * Whether a website check can start this month. Website checks hold one internal credit per page (up to the
 * plan's pages per check), so block the button when the rest of the month can't cover a full check.
 */
export async function getWebsiteCheckAllowance(orgId: string, now = new Date()): Promise<WebsiteCheckAllowance> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true } });
  const plan = getPlanWithAiLimits(org?.planId ?? "trial");
  const rows = await db.usageLedger.groupBy({
    by: ["kind"],
    where: { organizationId: orgId, billingPeriod: billingPeriod(now) },
    _sum: { credits: true },
  });
  const sum = (k: string) => rows.find((r) => r.kind === k)?._sum.credits ?? 0;
  const used = sum("actual") + Math.max(0, sum("reservation") - sum("release"));
  return { allowed: plan.monthlyCredits - used >= plan.maxPagesPerCrawl, resetsAt: nextUtcMonthStart(now) };
}
