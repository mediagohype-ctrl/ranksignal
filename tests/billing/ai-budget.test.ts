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

import {
  __resetAiBudgetForTests,
  __setAiBudgetLedgerQueryForTests,
  AI_BUDGET_CACHE_MS,
  assertAiBudget,
  getAiBudgetStatus,
  getAiDailyBudgetUsd,
  noteAiSpend,
  utcDayStart,
} from "@/lib/billing/ai-budget";
import { openRouterChat } from "@/lib/providers/openrouter-client";
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
  delete process.env.AI_DAILY_BUDGET_USD;
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
