// Daily AI spend HARD cap (owner cost protection). Every outbound AI request reserves its estimated cost first:
//
//   const r = await reserveAiSpend(estimateMicros);   // throws AiBudgetError when it would not fit
//   try { ...call...; r.settle(actualMicros) } catch (e) { r.release(); throw e }
//
// A call is allowed only when spent + reserved + estimate ≤ cap, for ALL of
//   - the platform cap  AI_DAILY_BUDGET_USD (all organizations, UTC day),
//   - the workspace cap plan.aiDailyBudgetUsd (organization from the AI scope set by the job runner, see runWithAiScope),
//   - the workspace MONTHLY cap = a share of what it pays (src/lib/billing/ai-margin.ts; profit guard).
//     Month spent = ledger of earlier days this month (read once a day) + today's spend.
// spent = max(ledger, local):
//   ledger — sum(UsageLedger.costMicros) of today's "actual" rows (re-read at most every AI_BUDGET_RESERVE_REFRESH_MS
//            inside the reservation lock; other instances' spend shows up here).
//   local  — spend this process settled today (provider-reported cost of each response). Jobs write the ledger in
//            batches, so without this a large run could overshoot. max (not sum) never double counts.
// Reservations are serialized by an in-process mutex (check + add happen with no other reservation in between),
// and the ledger read FAILS CLOSED: if today's spend can't be read, the call is refused.
// When only in-flight reservations (not real spend) are in the way, the caller waits for them to settle.
// Staff are alerted at 80% and 100% of the platform cap (src/lib/alerts/staff.ts, once per day each).
import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@/lib/db";
import { JobError } from "@/lib/types";
import { sendStaffAlert } from "@/lib/alerts/staff";
import { getPlanWithAiLimits } from "./plans";
import { monthlyAiBudgetMicros, topUpAiBudgetMicros } from "./ai-margin";
import { topUpValueInrThisMonth } from "./allowance";

export const DEFAULT_AI_DAILY_BUDGET_USD = 5;
export const AI_BUDGET_CACHE_MS = 30_000;
/** Max age of the ledger figure a reservation may rely on. */
export const AI_BUDGET_RESERVE_REFRESH_MS = 5_000;
/** How long a reservation waits for in-flight calls to settle before giving up. */
export const AI_BUDGET_MAX_WAIT_MS = 3 * 60_000;
export const AI_BUDGET_ALERT_THRESHOLDS = [0.8, 1] as const;
export const AI_BUDGET_NOTIFICATION_TYPE = "ai_budget";
export const AI_BUDGET_NOTIFICATION_TITLE = "Daily AI budget reached";

export interface AiBudgetStatus {
  spentUsd: number;
  limitUsd: number;
  remainingUsd: number;
}

/**
 * Refused because a daily AI budget is used up (scope platform/workspace: errorClass "quota" — work should wait
 * until tomorrow, not fail) or because today's spend couldn't be read (scope unavailable: "transient").
 */
export class AiBudgetError extends JobError {
  readonly aiBudget = true;
  constructor(
    message: string,
    readonly scope: "platform" | "workspace" | "unavailable",
  ) {
    super(message, scope === "unavailable" ? "transient" : "quota");
  }
}

/** True for "daily budget used up" (platform or workspace) — the caller should continue tomorrow. */
export function isAiBudgetExhausted(err: unknown): boolean {
  const e = err as { aiBudget?: unknown; scope?: unknown } | null;
  return !!e && e.aiBudget === true && (e.scope === "platform" || e.scope === "workspace");
}

export interface AiSpendReservation {
  /** The call finished: release the hold and record what it really cost (micro-USD). Idempotent. */
  settle(actualMicros: number): void;
  /** The call didn't happen / failed without cost: release the hold. Idempotent. */
  release(): void;
}

interface OrgState {
  ledgerMicros: number;
  fetchedAt: number;
  localMicros: number;
  reservedMicros: number;
  capMicros: number | null;
  capFetchedAt: number;
  /** Monthly cap (micro-USD); null = none. */
  monthCapMicros: number | null;
  /** Ledger spend this month before today; refreshed once per UTC day. */
  monthPrevMicros: number;
  monthPrevDay: string;
}

interface BudgetState {
  day: string;
  ledgerMicros: number;
  fetchedAt: number;
  localMicros: number;
  reservedMicros: number;
  notifiedDay: string | null;
  inflight: Promise<number> | null;
  orgs: Map<string, OrgState>;
  alerted: Set<string>;
  lock: Promise<void>;
  waiters: (() => void)[];
}

// globalThis so route bundles and the in-process worker share one cache/counter/lock.
const g = globalThis as unknown as { __aiBudget?: BudgetState; __aiScope?: AsyncLocalStorage<AiScope> };
const state: BudgetState = (g.__aiBudget ??= {} as BudgetState);
state.day ??= "";
state.ledgerMicros ??= 0;
state.fetchedAt ??= 0;
state.localMicros ??= 0;
state.reservedMicros ??= 0;
state.notifiedDay ??= null;
state.inflight ??= null;
state.orgs ??= new Map();
state.alerted ??= new Set();
state.lock ??= Promise.resolve();
state.waiters ??= [];

// ---------- AI scope: which organization the current async work is for ----------

export interface AiScope {
  organizationId?: string;
}
const scopeStore = (g.__aiScope ??= new AsyncLocalStorage<AiScope>());

/** Run `fn` with AI calls attributed to this organization (workspace daily budget). The job runner wraps handlers. */
export function runWithAiScope<T>(scope: AiScope, fn: () => T): T {
  return scopeStore.run(scope, fn);
}

export function currentAiScope(): AiScope | undefined {
  return scopeStore.getStore();
}

// ---------- config + day helpers ----------

export function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function utcDayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function utcMonthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function nextUtcDayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

/** AI_DAILY_BUDGET_USD (default 5). "0" blocks all AI calls; invalid values fall back to the default. */
export function getAiDailyBudgetUsd(): number {
  const raw = process.env.AI_DAILY_BUDGET_USD?.trim();
  if (!raw) return DEFAULT_AI_DAILY_BUDGET_USD;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_AI_DAILY_BUDGET_USD;
}

const usdToMicros = (usd: number) => Math.round(usd * 1_000_000);

function rollDay(now: Date) {
  const day = utcDayKey(now);
  if (state.day !== day) {
    state.day = day;
    state.ledgerMicros = 0;
    state.fetchedAt = 0;
    state.localMicros = 0;
    state.reservedMicros = 0;
    state.inflight = null;
    state.orgs.clear();
  }
}

function orgState(orgId: string): OrgState {
  let s = state.orgs.get(orgId);
  if (!s)
    state.orgs.set(
      orgId,
      (s = { ledgerMicros: 0, fetchedAt: 0, localMicros: 0, reservedMicros: 0, capMicros: null, capFetchedAt: 0, monthCapMicros: null, monthPrevMicros: 0, monthPrevDay: "" }),
    );
  return s;
}

// ---------- DB reads (test seams) ----------

async function queryLedgerMicros(since: Date, orgId?: string): Promise<number> {
  const agg = await db.usageLedger.aggregate({
    where: { kind: "actual", createdAt: { gte: since }, ...(orgId ? { organizationId: orgId } : {}) },
    _sum: { costMicros: true },
  });
  return agg._sum.costMicros ?? 0;
}
async function queryOrgCapMicros(orgId: string): Promise<number | null> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true } });
  return usdToMicros(getPlanWithAiLimits(org?.planId ?? "trial").aiDailyBudgetUsd);
}
async function queryOrgMonthCapMicros(orgId: string): Promise<number | null> {
  const org = await db.organization.findUnique({ where: { id: orgId }, select: { planId: true, serviceTier: true } });
  // Bought AI answers (top-up packs) raise the cap by the same share of what was paid for them.
  const topUp = await topUpValueInrThisMonth(orgId).catch(() => 0);
  return monthlyAiBudgetMicros(org?.planId ?? "trial", org?.serviceTier) + topUpAiBudgetMicros(topUp);
}
async function queryLedgerRangeMicros(since: Date, until: Date, orgId: string): Promise<number> {
  const agg = await db.usageLedger.aggregate({
    where: { kind: "actual", organizationId: orgId, createdAt: { gte: since, lt: until } },
    _sum: { costMicros: true },
  });
  return agg._sum.costMicros ?? 0;
}
// Under vitest nothing is queried unless a test opts in (unmocked test files must not reach a real DB).
let ledgerQuery: (since: Date, orgId?: string) => Promise<number> = process.env.VITEST ? async () => 0 : queryLedgerMicros;
let orgCapQuery: (orgId: string) => Promise<number | null> = process.env.VITEST ? async () => null : queryOrgCapMicros;
let orgMonthCapQuery: (orgId: string) => Promise<number | null> = process.env.VITEST ? async () => null : queryOrgMonthCapMicros;
let ledgerRangeQuery: (since: Date, until: Date, orgId: string) => Promise<number> = process.env.VITEST ? async () => 0 : queryLedgerRangeMicros;

/** Test seam: "db" uses the (mocked) Prisma client; a function replaces the ledger query. */
export function __setAiBudgetLedgerQueryForTests(q: "db" | ((since: Date, orgId?: string) => Promise<number>)) {
  ledgerQuery = q === "db" ? queryLedgerMicros : q;
}
/** Test seam: workspace cap lookup (micro-USD, null = no workspace cap). */
export function __setAiBudgetOrgCapQueryForTests(q: "db" | ((orgId: string) => Promise<number | null>)) {
  orgCapQuery = q === "db" ? queryOrgCapMicros : q;
}

/** Test seam: monthly workspace cap (micro-USD, null = none) and the earlier-days-this-month ledger read. */
export function __setAiBudgetMonthQueriesForTests(
  cap: "db" | ((orgId: string) => Promise<number | null>),
  range: "db" | ((since: Date, until: Date, orgId: string) => Promise<number>),
) {
  orgMonthCapQuery = cap === "db" ? queryOrgMonthCapMicros : cap;
  ledgerRangeQuery = range === "db" ? queryLedgerRangeMicros : range;
}

/** Cached platform ledger read for status display (fails open to the last value: display only). */
async function ledgerMicrosCached(now: Date): Promise<number> {
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
      console.warn("[ai-budget] spend query failed", (err as Error)?.name);
    } finally {
      state.inflight = null;
    }
    return state.ledgerMicros;
  })();
  return state.inflight;
}

/** Fresh platform ledger read for a reservation. Throws AiBudgetError("unavailable") — fail closed. */
async function ledgerMicrosFresh(now: Date): Promise<number> {
  if (state.fetchedAt && Date.now() - state.fetchedAt < AI_BUDGET_RESERVE_REFRESH_MS) return state.ledgerMicros;
  try {
    const micros = await ledgerQuery(utcDayStart(now));
    state.ledgerMicros = micros;
    state.fetchedAt = Date.now();
    return micros;
  } catch (err) {
    console.warn("[ai-budget] spend query failed; refusing AI call", (err as Error)?.name);
    throw new AiBudgetError("We couldn't check today's AI spend, so the AI call was not made. It will be retried.", "unavailable");
  }
}

async function orgLedgerFresh(orgId: string, s: OrgState, now: Date): Promise<void> {
  try {
    if (!s.capFetchedAt || Date.now() - s.capFetchedAt >= AI_BUDGET_CACHE_MS) {
      s.capMicros = await orgCapQuery(orgId);
      s.monthCapMicros = await orgMonthCapQuery(orgId);
      s.capFetchedAt = Date.now();
    }
    if (s.capMicros === null && s.monthCapMicros === null) return;
    if (s.monthCapMicros !== null && s.monthPrevDay !== state.day) {
      const dayStart = utcDayStart(now);
      const monthStart = utcMonthStart(now);
      s.monthPrevMicros = monthStart < dayStart ? await ledgerRangeQuery(monthStart, dayStart, orgId) : 0;
      s.monthPrevDay = state.day;
    }
    if (!s.fetchedAt || Date.now() - s.fetchedAt >= AI_BUDGET_RESERVE_REFRESH_MS) {
      s.ledgerMicros = await ledgerQuery(utcDayStart(now), orgId);
      s.fetchedAt = Date.now();
    }
  } catch (err) {
    console.warn("[ai-budget] workspace spend query failed; refusing AI call", (err as Error)?.name);
    throw new AiBudgetError("We couldn't check today's AI spend, so the AI call was not made. It will be retried.", "unavailable");
  }
}

// ---------- mutex + waiting ----------

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = state.lock.then(fn, fn);
  state.lock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Resolves when some reservation settles/releases (or after `ms`). */
function nextChange(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      resolve();
    }
    state.waiters.push(done);
  });
}
function wakeWaiters() {
  const w = state.waiters.splice(0);
  for (const f of w) f();
}

// ---------- spend accounting ----------

function platformSpent(): number {
  return Math.max(state.ledgerMicros, state.localMicros);
}

function addLocalSpend(costMicros: number, orgId: string | undefined, now: Date) {
  if (!Number.isFinite(costMicros) || costMicros <= 0) return;
  rollDay(now);
  const c = Math.round(costMicros);
  state.localMicros += c;
  if (orgId) orgState(orgId).localMicros += c;
  maybeAlert(now);
}

/** Record provider-reported spend that was not reserved (micro-USD). Prefer reserveAiSpend(...).settle(). */
export function noteAiSpend(costMicros: number, now = new Date()): void {
  addLocalSpend(costMicros, currentAiScope()?.organizationId, now);
}

type Verdict = { ok: true } | { ok: false; scope: "platform" | "workspace"; waitable: boolean; month?: boolean };

/** Pure fit check (exported for tests): may a call of `estimate` start given spent/reserved/cap (micro-USD)? */
export function fitsBudget(spent: number, reserved: number, estimate: number, cap: number): { ok: boolean; waitable: boolean } {
  if (spent >= cap) return { ok: false, waitable: false };
  if (spent + reserved + estimate <= cap && (estimate > 0 || spent + reserved < cap)) return { ok: true, waitable: false };
  // Real spend alone leaves room: only in-flight holds are in the way, so it may fit once they settle.
  return { ok: false, waitable: reserved > 0 && spent + estimate <= cap };
}

function check(estimate: number, org: OrgState | null): Verdict {
  const p = fitsBudget(platformSpent(), state.reservedMicros, estimate, usdToMicros(getAiDailyBudgetUsd()));
  if (!p.ok) return { ok: false, scope: "platform", waitable: p.waitable };
  if (org && org.capMicros !== null) {
    const o = fitsBudget(Math.max(org.ledgerMicros, org.localMicros), org.reservedMicros, estimate, org.capMicros);
    if (!o.ok) return { ok: false, scope: "workspace", waitable: o.waitable };
  }
  if (org && org.monthCapMicros !== null) {
    const today = Math.max(org.ledgerMicros, org.localMicros);
    const m = fitsBudget(org.monthPrevMicros + today, org.reservedMicros, estimate, org.monthCapMicros);
    if (!m.ok) return { ok: false, scope: "workspace", waitable: m.waitable, month: true };
  }
  return { ok: true };
}

/**
 * Reserve `estimateMicros` of today's AI budget before making a call. Throws AiBudgetError:
 *   scope "platform" / "workspace" (errorClass quota) — the daily cap is reached; continue tomorrow;
 *   scope "unavailable" (transient) — today's spend couldn't be read (fail closed).
 * The organization defaults to the current AI scope (runWithAiScope).
 */
export async function reserveAiSpend(
  estimateMicros: number,
  o: { organizationId?: string; now?: () => Date; maxWaitMs?: number } = {},
): Promise<AiSpendReservation> {
  const est = Math.max(0, Math.round(Number.isFinite(estimateMicros) ? estimateMicros : 0));
  const orgId = o.organizationId ?? currentAiScope()?.organizationId;
  const clock = o.now ?? (() => new Date());
  const deadline = Date.now() + (o.maxWaitMs ?? AI_BUDGET_MAX_WAIT_MS);
  for (;;) {
    const verdict = await withLock(async () => {
      const now = clock();
      rollDay(now);
      await ledgerMicrosFresh(now);
      maybeAlert(now); // other instances' spend can cross 80% too
      const org = orgId ? orgState(orgId) : null;
      if (org && orgId) await orgLedgerFresh(orgId, org, now);
      const v = check(est, org);
      if (v.ok) {
        // Same tick as the check (no await in between): the hold is atomic with respect to other reservations.
        state.reservedMicros += est;
        if (org) org.reservedMicros += est;
        return { v, day: state.day, now };
      }
      return { v, day: state.day, now };
    });
    if (verdict.v.ok) return makeReservation(est, orgId, verdict.day, clock);
    const v = verdict.v;
    if (v.waitable && Date.now() < deadline) {
      await nextChange(Math.min(5_000, Math.max(1, deadline - Date.now())));
      continue;
    }
    if (v.scope === "platform") onPlatformCapReached(verdict.now);
    throw new AiBudgetError(
      v.scope === "platform"
        ? "Today's AI budget is used up. The rest of the AI check will run tomorrow."
        : v.month
          ? "This workspace's AI budget for this month is used up. AI checks continue next month."
          : "This workspace's AI budget for today is used up. The rest of the AI check will run tomorrow.",
      v.scope,
    );
  }
}

function makeReservation(est: number, orgId: string | undefined, day: string, clock: () => Date): AiSpendReservation {
  let done = false;
  const unhold = () => {
    if (state.day === day) {
      state.reservedMicros = Math.max(0, state.reservedMicros - est);
      if (orgId) {
        const s = state.orgs.get(orgId);
        if (s) s.reservedMicros = Math.max(0, s.reservedMicros - est);
      }
    }
  };
  return {
    settle(actualMicros: number) {
      if (done) return;
      done = true;
      unhold();
      addLocalSpend(actualMicros, orgId, clock());
      wakeWaiters();
    },
    release() {
      if (done) return;
      done = true;
      unhold();
      wakeWaiters();
    },
  };
}

/**
 * Reserve, run, settle. `costOf` returns the real cost of a successful result (undefined → the estimate is
 * recorded). Failed calls release the hold.
 */
export async function withAiSpend<T>(estimateMicros: number, call: () => Promise<T>, costOf: (result: T) => number | undefined): Promise<T> {
  const r = await reserveAiSpend(estimateMicros);
  let result: T;
  try {
    result = await call();
  } catch (err) {
    r.release();
    throw err;
  }
  const actual = costOf(result);
  r.settle(actual === undefined ? estimateMicros : actual);
  return result;
}

// ---------- status ----------

async function spentMicrosToday(now: Date): Promise<number> {
  rollDay(now);
  const ledger = await ledgerMicrosCached(now);
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

/**
 * Throws JobError(quota) when today's (UTC) total AI spend + in-flight holds reach AI_DAILY_BUDGET_USD.
 * Kept for callers that can't estimate; prefer reserveAiSpend().
 */
export async function assertAiBudget(now = new Date()): Promise<void> {
  const spentMicros = await spentMicrosToday(now);
  if (spentMicros + state.reservedMicros < usdToMicros(getAiDailyBudgetUsd())) return;
  onPlatformCapReached(now);
  const s = toStatus(spentMicros);
  throw new AiBudgetError(
    `Daily AI budget reached ($${s.spentUsd.toFixed(2)} of $${s.limitUsd.toFixed(2)} today, UTC). AI checks resume tomorrow.`,
    "platform",
  );
}

// ---------- staff alerts ----------

function maybeAlert(now: Date) {
  const cap = usdToMicros(getAiDailyBudgetUsd());
  if (cap <= 0) return;
  const spent = platformSpent();
  for (const t of AI_BUDGET_ALERT_THRESHOLDS) if (spent >= cap * t) alertOnce(t, now, spent);
}

function onPlatformCapReached(now: Date) {
  alertOnce(1, now, platformSpent());
  void notifyBudgetReached(now, toStatus(platformSpent())).catch((err) => {
    state.notifiedDay = null; // retry on a later call
    console.warn("[ai-budget] notify failed", (err as Error)?.name);
  });
}

function alertOnce(threshold: number, now: Date, spentMicros: number) {
  const day = utcDayKey(now);
  const pct = Math.round(threshold * 100);
  const memo = `${day}:${pct}`;
  if (state.alerted.has(memo)) return;
  state.alerted.add(memo);
  const s = toStatus(spentMicros);
  void sendStaffAlert({
    kind: `ai_budget_${pct}`,
    key: day,
    subject: pct >= 100 ? `AI budget reached for ${day} (UTC)` : `AI spend at ${pct}% of today's budget`,
    text:
      pct >= 100
        ? `AI spend today is $${s.spentUsd.toFixed(2)} of the $${s.limitUsd.toFixed(2)} daily budget (AI_DAILY_BUDGET_USD). New AI calls are paused until 00:00 UTC; customers' remaining AI checks are queued for tomorrow.`
        : `AI spend today is $${s.spentUsd.toFixed(2)} of the $${s.limitUsd.toFixed(2)} daily budget (AI_DAILY_BUDGET_USD) — ${pct}%. At 100% new AI calls pause until 00:00 UTC.`,
  }).catch(() => undefined);
}

/** One in-app staff notification per UTC day (deduped in memory and via a Notification lookup for today). */
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
  state.reservedMicros = 0;
  state.notifiedDay = null;
  state.inflight = null;
  state.orgs.clear();
  state.alerted.clear();
  state.lock = Promise.resolve();
  wakeWaiters();
}

/** Test seam: current in-flight hold (micro-USD). */
export function __aiBudgetReservedMicros(): number {
  return state.reservedMicros;
}
