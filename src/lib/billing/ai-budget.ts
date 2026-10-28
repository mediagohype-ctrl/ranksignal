// Global daily AI spend guard (owner cost protection). Every outbound AI request must call assertAiBudget() first.
//
// Spend for today (UTC) = max(ledger, local):
//   ledger — sum(UsageLedger.costMicros) of today's "actual" rows across ALL organizations (cached ~30s in memory so
//            this is not one query per AI call).
//   local  — spend this process has observed today via noteAiSpend() (provider-reported cost of each response).
//            Jobs only write the ledger when a run finishes, so without this a single large run could overshoot.
// Taking the max (not the sum) never double counts once the ledger catches up. Single instance, so local is accurate.
import { db } from "@/lib/db";
import { JobError } from "@/lib/types";

export const DEFAULT_AI_DAILY_BUDGET_USD = 5;
export const AI_BUDGET_CACHE_MS = 30_000;
export const AI_BUDGET_NOTIFICATION_TYPE = "ai_budget";
export const AI_BUDGET_NOTIFICATION_TITLE = "Daily AI budget reached";

export interface AiBudgetStatus {
  spentUsd: number;
  limitUsd: number;
  remainingUsd: number;
}

interface BudgetState {
  day: string;
  ledgerMicros: number;
  fetchedAt: number;
  localMicros: number;
  notifiedDay: string | null;
  inflight: Promise<number> | null;
}

// globalThis so route bundles and the in-process worker share one cache/counter.
const g = globalThis as unknown as { __aiBudget?: BudgetState };
const state = (g.__aiBudget ??= { day: "", ledgerMicros: 0, fetchedAt: 0, localMicros: 0, notifiedDay: null, inflight: null });

export function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function utcDayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** AI_DAILY_BUDGET_USD (default 5). "0" blocks all AI calls; invalid values fall back to the default. */
export function getAiDailyBudgetUsd(): number {
  const raw = process.env.AI_DAILY_BUDGET_USD?.trim();
  if (!raw) return DEFAULT_AI_DAILY_BUDGET_USD;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_AI_DAILY_BUDGET_USD;
}

function rollDay(now: Date) {
  const day = utcDayKey(now);
  if (state.day !== day) {
    state.day = day;
    state.ledgerMicros = 0;
    state.fetchedAt = 0;
    state.localMicros = 0;
    state.inflight = null;
  }
}

async function queryLedgerMicros(since: Date): Promise<number> {
  const agg = await db.usageLedger.aggregate({ where: { kind: "actual", createdAt: { gte: since } }, _sum: { costMicros: true } });
  return agg._sum.costMicros ?? 0;
}
// Under vitest the ledger is never queried unless a test opts in (unmocked test files must not reach a real DB).
let ledgerQuery: (since: Date) => Promise<number> = process.env.VITEST ? async () => 0 : queryLedgerMicros;

/** Test seam: "db" uses the (mocked) Prisma client; a function replaces the ledger query. */
export function __setAiBudgetLedgerQueryForTests(q: "db" | ((since: Date) => Promise<number>)) {
  ledgerQuery = q === "db" ? queryLedgerMicros : q;
}

async function ledgerMicrosToday(now: Date): Promise<number> {
  if (state.fetchedAt && now.getTime() - state.fetchedAt < AI_BUDGET_CACHE_MS) return state.ledgerMicros;
  if (state.inflight) return state.inflight;
  const day = state.day;
  state.inflight = (async () => {
    try {
      const micros = await ledgerQuery(utcDayStart(now));
      if (state.day === day) {
        state.ledgerMicros = micros;
        state.fetchedAt = Date.now();
      }
    } catch (err) {
      // Fail open on a DB hiccup (the local counter still applies); retry on the next call.
      console.warn("[ai-budget] spend query failed", (err as Error)?.name);
    } finally {
      state.inflight = null;
    }
    return state.ledgerMicros;
  })();
  return state.inflight;
}

/** Record provider-reported spend for an AI response (micro-USD). Call after every successful AI request. */
export function noteAiSpend(costMicros: number, now = new Date()): void {
  if (!Number.isFinite(costMicros) || costMicros <= 0) return;
  rollDay(now);
  state.localMicros += Math.round(costMicros);
}

async function spentMicrosToday(now: Date): Promise<number> {
  rollDay(now);
  const ledger = await ledgerMicrosToday(now);
  return Math.max(ledger, state.localMicros);
}

function toStatus(spentMicros: number): AiBudgetStatus {
  const limitUsd = getAiDailyBudgetUsd();
  const round = (n: number) => Math.round(n * 10_000) / 10_000;
  return {
    spentUsd: round(spentMicros / 1_000_000),
    limitUsd,
    remainingUsd: Math.max(0, round((limitUsd * 1_000_000 - spentMicros) / 1_000_000)),
  };
}

export async function getAiBudgetStatus(now = new Date()): Promise<AiBudgetStatus> {
  return toStatus(await spentMicrosToday(now));
}

/** Throws JobError(quota) when today's (UTC) total AI spend across all organizations ≥ AI_DAILY_BUDGET_USD. */
export async function assertAiBudget(now = new Date()): Promise<void> {
  const spentMicros = await spentMicrosToday(now);
  if (spentMicros < Math.round(getAiDailyBudgetUsd() * 1_000_000)) return;
  const s = toStatus(spentMicros);
  void notifyBudgetReached(now, s).catch((err) => {
    state.notifiedDay = null; // retry on a later call
    console.warn("[ai-budget] notify failed", (err as Error)?.name);
  });
  throw new JobError(
    `Daily AI budget reached ($${s.spentUsd.toFixed(2)} of $${s.limitUsd.toFixed(2)} today, UTC). AI checks resume tomorrow.`,
    "quota",
  );
}

/** One staff notification per UTC day (deduped in memory and via a Notification lookup for today). */
async function notifyBudgetReached(now: Date, s: AiBudgetStatus): Promise<void> {
  const day = utcDayKey(now);
  if (state.notifiedDay === day) return;
  state.notifiedDay = day;
  const already = await db.notification.findFirst({
    where: { type: AI_BUDGET_NOTIFICATION_TYPE, createdAt: { gte: utcDayStart(now) } },
    select: { id: true },
  });
  if (already) return;
  const staff = await db.membership.findMany({
    where: { status: "active", user: { isStaff: true } },
    select: { userId: true, organizationId: true },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<string>();
  const rows = staff.filter((m) => (seen.has(m.userId) ? false : (seen.add(m.userId), true)));
  if (rows.length === 0) {
    console.warn("[ai-budget] daily AI budget reached; no staff user to notify");
    return;
  }
  await db.notification.createMany({
    data: rows.map((m) => ({
      organizationId: m.organizationId,
      userId: m.userId,
      type: AI_BUDGET_NOTIFICATION_TYPE,
      title: AI_BUDGET_NOTIFICATION_TITLE,
      body: `AI spend today is $${s.spentUsd.toFixed(2)} of the $${s.limitUsd.toFixed(2)} daily budget (AI_DAILY_BUDGET_USD). New AI calls are paused until 00:00 UTC.`,
      link: "/admin",
    })),
  });
}

/** Test seam: reset the in-memory cache/counters. */
export function __resetAiBudgetForTests() {
  state.day = "";
  state.ledgerMicros = 0;
  state.fetchedAt = 0;
  state.localMicros = 0;
  state.notifiedDay = null;
  state.inflight = null;
}
