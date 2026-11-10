import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  ledgerMicros: 0,
  aggregateCalls: 0,
  existingNotification: false,
  created: [] as { type: string; title: string; userId: string }[],
  staff: [
    { userId: "u_staff", organizationId: "org_a" },
    { userId: "u_staff", organizationId: "org_b" },
  ],
}));

vi.mock("@/lib/db", () => ({
  db: {
    usageLedger: {
      aggregate: vi.fn(async () => {
        state.aggregateCalls++;
        return { _sum: { costMicros: state.ledgerMicros } };
      }),
    },
    notification: {
      findFirst: vi.fn(async () => (state.existingNotification ? { id: "n1" } : null)),
      createMany: vi.fn(async ({ data }: { data: { type: string; title: string; userId: string }[] }) => {
        state.created.push(...data);
        return { count: data.length };
      }),
    },
    membership: { findMany: vi.fn(async () => state.staff) },
  },
}));

const alerts = vi.hoisted(() => [] as { kind: string; key: string }[]);
vi.mock("@/lib/alerts/staff", () => ({
  sendStaffAlert: vi.fn(async (a: { kind: string; key: string }) => {
    alerts.push(a);
    return { status: "sent" };
  }),
}));

import {
  __aiBudgetReservedMicros,
  __resetAiBudgetForTests,
  __setAiBudgetOrgCapQueryForTests,
  __setAiBudgetMonthQueriesForTests,
  AiBudgetError,
  fitsBudget,
  isAiBudgetExhausted,
  reserveAiSpend,
  runWithAiScope,
  __setAiBudgetLedgerQueryForTests,
  AI_BUDGET_CACHE_MS,
  assertAiBudget,
  getAiBudgetStatus,
  getAiDailyBudgetUsd,
  noteAiSpend,
  utcDayStart,
} from "@/lib/billing/ai-budget";
import { openRouterChat } from "@/lib/providers/openrouter-client";
import { monthlyAiBudgetInr, monthlyAiBudgetMicros } from "@/lib/billing/ai-margin";
import { JobError } from "@/lib/types";

const T0 = new Date("2026-10-28T10:00:00Z");
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  __resetAiBudgetForTests();
  __setAiBudgetLedgerQueryForTests("db");
  state.ledgerMicros = 0;
  state.aggregateCalls = 0;
  state.existingNotification = false;
  state.created = [];
  alerts.length = 0;
  __setAiBudgetOrgCapQueryForTests(async () => null);
  __setAiBudgetMonthQueriesForTests(async () => null, async () => 0);
  delete process.env.AI_DAILY_BUDGET_USD;
  delete process.env.AI_COST_SHARE;
  delete process.env.ADMIN_USD_INR_RATE;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENROUTER_API_KEY;
});

describe("budget config", () => {
  it("defaults to $5 and parses AI_DAILY_BUDGET_USD", () => {
    expect(getAiDailyBudgetUsd()).toBe(5);
    process.env.AI_DAILY_BUDGET_USD = "12.5";
    expect(getAiDailyBudgetUsd()).toBe(12.5);
    process.env.AI_DAILY_BUDGET_USD = "0";
    expect(getAiDailyBudgetUsd()).toBe(0);
    process.env.AI_DAILY_BUDGET_USD = "lots";
    expect(getAiDailyBudgetUsd()).toBe(5);
  });
  it("UTC day start", () => {
    expect(utcDayStart(new Date("2026-10-28T23:59:00+05:30")).toISOString()).toBe("2026-10-28T00:00:00.000Z");
  });
});

describe("budget math", () => {
  it("reports spent / limit / remaining from the ledger", async () => {
    state.ledgerMicros = 1_250_000;
    expect(await getAiBudgetStatus(T0)).toEqual({ spentUsd: 1.25, limitUsd: 5, remainingUsd: 3.75 });
  });
  it("uses max(ledger, local) so in-flight spend counts without double counting", async () => {
    state.ledgerMicros = 1_000_000;
    noteAiSpend(3_000_000, T0);
    expect((await getAiBudgetStatus(T0)).spentUsd).toBe(3);
    noteAiSpend(-5, T0); // ignored
    noteAiSpend(Number.NaN, T0); // ignored
    expect((await getAiBudgetStatus(T0)).spentUsd).toBe(3);
  });
  it("allows below the limit and throws JobError(quota) at the limit", async () => {
    state.ledgerMicros = 4_999_999;
    await expect(assertAiBudget(T0)).resolves.toBeUndefined();
    __resetAiBudgetForTests();
    state.ledgerMicros = 5_000_000;
    const err = await assertAiBudget(T0).catch((e) => e);
    expect(err).toBeInstanceOf(JobError);
    expect((err as JobError).errorClass).toBe("quota");
  });
  it("local counters reset on a new UTC day", async () => {
    noteAiSpend(6_000_000, T0);
    await expect(assertAiBudget(T0)).rejects.toBeInstanceOf(JobError);
    await expect(assertAiBudget(new Date("2026-10-29T00:00:01Z"))).resolves.toBeUndefined();
  });
});

describe("cache", () => {
  it("queries the ledger at most once per cache window", async () => {
    await getAiBudgetStatus(T0);
    await getAiBudgetStatus(new Date(T0.getTime() + 1000));
    await Promise.all([assertAiBudget(T0), assertAiBudget(T0), assertAiBudget(T0)]);
    expect(state.aggregateCalls).toBe(1);
  });
  it("refreshes after the window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    await getAiBudgetStatus(T0);
    state.ledgerMicros = 9_000_000;
    vi.setSystemTime(new Date(T0.getTime() + AI_BUDGET_CACHE_MS + 1));
    const s = await getAiBudgetStatus(new Date(T0.getTime() + AI_BUDGET_CACHE_MS + 1));
    vi.useRealTimers();
    expect(state.aggregateCalls).toBe(2);
    expect(s.spentUsd).toBe(9);
  });
});

describe("staff notification", () => {
  it("notifies each staff user once per day", async () => {
    state.ledgerMicros = 7_000_000;
    await assertAiBudget(T0).catch(() => undefined);
    await flush();
    await assertAiBudget(T0).catch(() => undefined);
    await flush();
    expect(state.created).toHaveLength(1);
    expect(state.created[0]).toMatchObject({ type: "ai_budget", title: "Daily AI budget reached", userId: "u_staff" });
  });
  it("does not notify again when today's notification already exists (e.g. after restart)", async () => {
    state.ledgerMicros = 7_000_000;
    state.existingNotification = true;
    await assertAiBudget(T0).catch(() => undefined);
    await flush();
    expect(state.created).toHaveLength(0);
  });
});

describe("openRouterChat chokepoint", () => {
  it("refuses before calling the provider once the budget is spent", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    state.ledgerMicros = 5_000_000;
    const err = await openRouterChat({ model: "x", messages: [] }, 1000).catch((e) => e);
    expect((err as JobError).errorClass).toBe("quota");
    expect(f).not.toHaveBeenCalled();
  });
  it("records reported cost as local spend", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ choices: [], usage: { cost: 0.5 } }), { status: 200 })),
    );
    await openRouterChat({ model: "x", messages: [] }, 1000);
    expect((await getAiBudgetStatus()).spentUsd).toBe(0.5);
  });
});

describe("reservations: hard cap", () => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("fit rule: spent + reserved + estimate ≤ cap; waitable only when in-flight holds are in the way", () => {
    expect(fitsBudget(0, 0, 100, 100)).toEqual({ ok: true, waitable: false });
    expect(fitsBudget(50, 40, 20, 100)).toEqual({ ok: false, waitable: true });
    expect(fitsBudget(90, 0, 20, 100)).toEqual({ ok: false, waitable: false });
    expect(fitsBudget(100, 0, 0, 100)).toEqual({ ok: false, waitable: false });
  });

  it("50 concurrent calls with a slow ledger read: exactly as many as fit get through, never above the cap", async () => {
    process.env.AI_DAILY_BUDGET_USD = "1"; // 1,000,000 micro-USD
    __setAiBudgetLedgerQueryForTests(async () => {
      await sleep(Math.random() * 3);
      return 0;
    });
    const results = await Promise.allSettled(Array.from({ length: 50 }, () => reserveAiSpend(30_000, { maxWaitMs: 0 })));
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(33);
    expect(__aiBudgetReservedMicros()).toBe(33 * 30_000);
    for (const r of results) if (r.status === "rejected") expect(isAiBudgetExhausted(r.reason)).toBe(true);
  });

  it("workers that reserve → call → settle concurrently never spend more than the cap", async () => {
    process.env.AI_DAILY_BUDGET_USD = "0.5";
    __setAiBudgetLedgerQueryForTests(async () => 0);
    let spent = 0;
    let maxCommitted = 0;
    const worker = async () => {
      for (;;) {
        let hold;
        try {
          hold = await reserveAiSpend(40_000, { maxWaitMs: 200 });
        } catch (e) {
          expect(e).toBeInstanceOf(AiBudgetError);
          return;
        }
        maxCommitted = Math.max(maxCommitted, spent + __aiBudgetReservedMicros());
        await sleep(Math.random() * 4);
        const actual = 25_000 + Math.floor(Math.random() * 15_000); // real cost ≤ estimate
        spent += actual;
        hold.settle(actual);
      }
    };
    await Promise.all(Array.from({ length: 12 }, worker));
    expect(spent).toBeLessThanOrEqual(500_000);
    expect(maxCommitted).toBeLessThanOrEqual(500_000);
    expect((await getAiBudgetStatus()).spentUsd).toBeLessThanOrEqual(0.5);
  });

  it("waits for in-flight holds to settle instead of refusing", async () => {
    process.env.AI_DAILY_BUDGET_USD = "1";
    __setAiBudgetLedgerQueryForTests(async () => 0);
    const first = await reserveAiSpend(600_000);
    const second = reserveAiSpend(600_000, { maxWaitMs: 5_000 });
    await sleep(5);
    first.release(); // the first call failed: no spend
    await expect(second).resolves.toBeDefined();
  });

  it("fails CLOSED when today's spend can't be read", async () => {
    __setAiBudgetLedgerQueryForTests(async () => {
      throw new Error("db down");
    });
    const err = await reserveAiSpend(1_000).catch((e) => e);
    expect(err).toBeInstanceOf(AiBudgetError);
    expect((err as AiBudgetError).scope).toBe("unavailable");
    expect((err as AiBudgetError).errorClass).toBe("transient");
    expect(isAiBudgetExhausted(err)).toBe(false);
  });

  it("per-workspace daily cap, with the organization taken from the AI scope", async () => {
    __setAiBudgetLedgerQueryForTests(async () => 0);
    __setAiBudgetOrgCapQueryForTests(async (orgId) => (orgId === "org_a" ? 100_000 : null));
    await runWithAiScope({ organizationId: "org_a" }, () => reserveAiSpend(60_000));
    const err = await runWithAiScope({ organizationId: "org_a" }, () => reserveAiSpend(60_000, { maxWaitMs: 0 })).catch((e) => e);
    expect((err as AiBudgetError).scope).toBe("workspace");
    expect(isAiBudgetExhausted(err)).toBe(true);
    await expect(reserveAiSpend(60_000, { organizationId: "org_b" })).resolves.toBeDefined();
  });

  it("per-workspace MONTHLY cap counts earlier days this month plus today", async () => {
    __setAiBudgetLedgerQueryForTests(async () => 0);
    let rangeArgs: [Date, Date] | null = null;
    __setAiBudgetMonthQueriesForTests(
      async (orgId) => (orgId === "org_a" ? 1_000_000 : null),
      async (since, until) => {
        rangeArgs = [since, until];
        return 900_000; // already spent on earlier days this month
      },
    );
    (await reserveAiSpend(60_000, { organizationId: "org_a" })).settle(60_000);
    const err = await reserveAiSpend(60_000, { organizationId: "org_a", maxWaitMs: 0 }).catch((e) => e);
    expect(err).toBeInstanceOf(AiBudgetError);
    expect((err as AiBudgetError).scope).toBe("workspace");
    expect((err as Error).message).toMatch(/this month/);
    expect(isAiBudgetExhausted(err)).toBe(true);
    // Earlier days = from the 1st of the month up to today (UTC).
    expect(rangeArgs![0].getUTCDate()).toBe(1);
    expect(rangeArgs![1].getTime()).toBe(utcDayStart(new Date()).getTime());
    // Other workspaces are not affected.
    await expect(reserveAiSpend(60_000, { organizationId: "org_b" })).resolves.toBeDefined();
  });

  it("alerts staff once at 80% and once at 100% of the platform cap", async () => {
    process.env.AI_DAILY_BUDGET_USD = "1";
    __setAiBudgetLedgerQueryForTests(async () => 0);
    (await reserveAiSpend(500_000)).settle(500_000);
    expect(alerts).toHaveLength(0);
    (await reserveAiSpend(350_000)).settle(350_000);
    (await reserveAiSpend(10_000)).settle(10_000);
    expect(alerts.map((a) => a.kind)).toEqual(["ai_budget_80"]);
    await reserveAiSpend(500_000, { maxWaitMs: 0 }).catch(() => undefined);
    await reserveAiSpend(500_000, { maxWaitMs: 0 }).catch(() => undefined);
    expect(alerts.map((a) => a.kind)).toEqual(["ai_budget_80", "ai_budget_100"]);
  });
});

describe("profit guard: monthly AI budget is a share of the price", () => {
  it("is 30% of the plan price by default", () => {
    expect(monthlyAiBudgetInr("starter")).toBe(600); // ₹1,999 × 30% (Starter dropped from ₹2,999 to ₹1,999)
    expect(monthlyAiBudgetInr("growth")).toBe(2400);
    expect(monthlyAiBudgetInr("agency")).toBe(6000);
  });

  it("adds the done-for-you tier price and gives the free trial a small fixed budget", () => {
    expect(monthlyAiBudgetInr("agency", "fix")).toBe(Math.round((19_999 + 19_999) * 0.3));
    expect(monthlyAiBudgetInr("trial")).toBe(150);
  });

  it("follows AI_COST_SHARE and converts to micro-USD at the configured rate", () => {
    process.env.AI_COST_SHARE = "0.2";
    process.env.ADMIN_USD_INR_RATE = "100";
    expect(monthlyAiBudgetInr("starter")).toBe(400); // ₹1,999 × 20%
    expect(monthlyAiBudgetMicros("starter")).toBe(4_000_000); // ₹400 / 100 = $4
    process.env.AI_COST_SHARE = "5"; // invalid → default 30%
    expect(monthlyAiBudgetInr("starter")).toBe(600);
  });
});
