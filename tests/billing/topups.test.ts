import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory DB for the monthly settlement (settleTopUps).
const state = vi.hoisted(() => ({
  packs: [] as Record<string, unknown>[],
  settlements: [] as Record<string, unknown>[],
  observations: [] as Date[],
  ledgerAnswers: [] as Date[],
  org: { planId: "starter", createdAt: new Date("2026-08-01T00:00:00Z") },
  firstPaid: { createdAt: new Date("2026-08-02T00:00:00Z") } as { createdAt: Date } | null,
}));

vi.mock("@/lib/db", () => {
  const inRange = (d: Date, w: { gte?: Date; lt?: Date }) => (!w.gte || d >= w.gte) && (!w.lt || d < w.lt);
  const db = {
    organization: { findUnique: vi.fn(async () => state.org) },
    subscription: { findFirst: vi.fn(async () => state.firstPaid) },
    observation: {
      count: vi.fn(async ({ where }: { where: { createdAt: { gte?: Date; lt?: Date } } }) => state.observations.filter((d) => inRange(d, where.createdAt)).length),
    },
    usageLedger: {
      aggregate: vi.fn(async ({ where }: { where: { createdAt: { gte?: Date; lt?: Date } } }) => ({ _sum: { credits: state.ledgerAnswers.filter((d) => inRange(d, where.createdAt)).length } })),
    },
    topUpPack: {
      findMany: vi.fn(async () => state.packs.map((p) => ({ ...p }))),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { consumed: { increment: number } } }) => {
        const p = state.packs.find((x) => x.id === where.id)!;
        p.consumed = (p.consumed as number) + data.consumed.increment;
        return p;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { settledThrough: { lt: Date } }; data: { settledThrough: Date } }) => {
        for (const p of state.packs) if ((p.settledThrough as Date) < where.settledThrough.lt) p.settledThrough = data.settledThrough;
        return { count: 1 };
      }),
    },
    topUpSettlement: {
      findUnique: vi.fn(async ({ where }: { where: { organizationId_month: { month: string } } }) => state.settlements.find((s) => s.month === where.organizationId_month.month) ?? null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.settlements.push(data);
        return data;
      }),
    },
    $executeRaw: vi.fn(async () => 1),
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
  };
  return { db };
});

import { PLANS } from "@/lib/billing/plans";
import {
  LEGACY_TOPUP_PACKS,
  TOPUP_FROM_PAISE,
  TOPUP_PACKS,
  answersLeftLabel,
  fullChecksIn,
  getTopUpPack,
  isTopUpPackId,
  packLabelFor,
  pricePerAnswerPaise,
  topUpExpiry,
} from "@/lib/billing/topups";
import { answersPerCheck } from "@/lib/billing/plans";
import { aiCostShare, topUpAiBudgetMicros } from "@/lib/billing/ai-margin";
import { settleTopUps } from "@/lib/billing/allowance";

describe("top-up packs (config)", () => {
  it("are sold in whole AI checks (app audit Fix 28): 1 check (75 answers) ₹499, 4 checks (300 answers) ₹1,699 (before GST, paise)", () => {
    expect(answersPerCheck("starter")).toBe(75);
    expect(TOPUP_PACKS.map((p) => [p.id, p.answers, p.pricePaise])).toEqual([
      ["checks_1", 75, 499_00],
      ["checks_4", 300, 1_699_00],
    ]);
    expect(TOPUP_PACKS.map((p) => p.name)).toEqual(["1 extra AI check (75 answers)", "4 extra AI checks (300 answers)"]);
    for (const p of TOPUP_PACKS) expect(p.answers % answersPerCheck("starter"), p.id).toBe(0);
    expect(TOPUP_FROM_PAISE).toBe(499_00);
    expect(isTopUpPackId("answers_1")).toBe(false);
  });

  it("old packs (35 / 100 / 500 / 2,000 answers) are no longer sold but still known for history and invoices", () => {
    expect(LEGACY_TOPUP_PACKS.map((p) => [p.id, p.answers, p.pricePaise])).toEqual([
      ["answers_35", 35, 250_00],
      ["answers_100", 100, 699_00],
      ["answers_500", 500, 2_999_00],
      ["answers_2000", 2_000, 9_999_00],
    ]);
    for (const p of LEGACY_TOPUP_PACKS) {
      expect(isTopUpPackId(p.id)).toBe(true);
      expect(getTopUpPack(p.id)?.answers).toBe(p.answers);
      expect(TOPUP_PACKS).not.toContain(p);
    }
  });

  // Price floor (owner pricing decision, audit prices): the 1-check pack is priced like the plan (₹6.65 vs ₹6.66 per
  // answer), the 4-check pack is the bulk discount (₹5.66) — never below ₹5.50, above the old 2,000 pack's ₹5.00.
  it("price per answer: the 1-check pack is priced like the plan, the 4-check pack is the bulk discount", () => {
    const starter = PLANS.starter;
    const starterPerAnswer = ((starter.priceInrMonthly ?? 0) * 100) / starter.aiAnswersPerMonth;
    const [one, four] = TOPUP_PACKS.map(pricePerAnswerPaise);
    expect(one).toBeGreaterThanOrEqual(starterPerAnswer - 1.5);
    expect(four).toBeLessThan(one);
    for (const p of TOPUP_PACKS) expect(pricePerAnswerPaise(p), p.id).toBeGreaterThanOrEqual(550);
  });

  it("profit guard: the AI spend a pack unlocks is AI_COST_SHARE of its price, at least ₹1.50 per answer", () => {
    for (const p of TOPUP_PACKS) {
      const inr = p.pricePaise / 100;
      expect(topUpAiBudgetMicros(inr), p.id).toBeGreaterThan(0);
      expect((inr * aiCostShare()) / p.answers, p.id).toBeGreaterThanOrEqual(1.5);
    }
  });

  it("names packs in checks first, answers second, for the workspace's plan", () => {
    expect(packLabelFor(75, 75)).toBe("1 extra AI check (75 answers)");
    expect(packLabelFor(300, 75)).toBe("4 extra AI checks (300 answers)");
    expect(packLabelFor(35, 75)).toBe("35 extra AI answers");
    expect(packLabelFor(2_000, 75)).toBe("2,000 extra AI answers");
    expect(packLabelFor(75, 200)).toBe("75 extra AI answers");
    expect(fullChecksIn(225, 75)).toBe(3);
    expect(fullChecksIn(74, 75)).toBe(0);
    expect(fullChecksIn(100, 0)).toBe(0);
  });

  it("is valid for 12 months from purchase (month-end safe)", () => {
    expect(topUpExpiry(new Date("2026-11-10T08:30:00Z")).toISOString()).toBe("2027-11-10T08:30:00.000Z");
    expect(topUpExpiry(new Date("2028-02-29T00:00:00Z")).toISOString()).toBe("2029-02-28T00:00:00.000Z");
  });

  it("labels what is left in customer words", () => {
    expect(answersLeftLabel({ monthlyLeft: 820, cap: 1_200, extraLeft: 400 })).toBe("820 of 1,200 monthly + 400 extra");
    expect(answersLeftLabel({ monthlyLeft: 820, cap: 1_200, extraLeft: 0 })).toBe("820 of 1,200");
  });
});

describe("monthly settlement (settleTopUps)", () => {
  const oct = (day: number) => new Date(Date.UTC(2026, 9, day, 12));
  beforeEach(() => {
    state.settlements = [];
    state.org = { planId: "starter", createdAt: new Date("2026-08-01T00:00:00Z") };
    state.firstPaid = { createdAt: new Date("2026-08-02T00:00:00Z") };
    state.packs = [
      { id: "a", answers: 100, consumed: 0, revokedAnswers: 0, status: "paid", purchasedAt: oct(5), expiresAt: new Date("2027-10-05T12:00:00Z"), settledThrough: new Date("2026-10-01T00:00:00Z") },
      { id: "b", answers: 500, consumed: 0, revokedAnswers: 0, status: "paid", purchasedAt: oct(20), expiresAt: new Date("2027-10-20T12:00:00Z"), settledThrough: new Date("2026-10-01T00:00:00Z") },
    ];
    // October: 300 plan answers + 150 more → 100 from pack a, 50 from pack b.
    state.observations = Array.from({ length: 450 }, (_, i) => oct(1 + (i % 28)));
  });

  it("stores each pack's use for the closed month, oldest pack first", async () => {
    expect(await settleTopUps("org_1", new Date("2026-11-03T00:00:00Z"))).toBe(1);
    expect(state.packs.map((p) => [p.id, p.consumed, (p.settledThrough as Date).toISOString()])).toEqual([
      ["a", 100, "2026-11-01T00:00:00.000Z"],
      ["b", 50, "2026-11-01T00:00:00.000Z"],
    ]);
    expect(state.settlements).toEqual([expect.objectContaining({ month: "2026-10", cap: 300, collected: 450, overflow: 150, allocated: 150, allocations: { a: 100, b: 50 } })]);
  });

  it("is idempotent: running it again (or after a settlement row exists) changes nothing", async () => {
    await settleTopUps("org_1", new Date("2026-11-03T00:00:00Z"));
    expect(await settleTopUps("org_1", new Date("2026-11-04T00:00:00Z"))).toBe(0);
    // Even if a pack's marker were stale, the existing month row stops a second allocation.
    state.packs[0].settledThrough = new Date("2026-10-01T00:00:00Z");
    expect(await settleTopUps("org_1", new Date("2026-11-04T00:00:00Z"))).toBe(0);
    expect(state.packs.map((p) => p.consumed)).toEqual([100, 50]);
  });

  it("a month before the first paid subscription is settled as trial (trial cap since signup)", async () => {
    state.org = { planId: "starter", createdAt: new Date("2026-10-01T00:00:00Z") };
    state.firstPaid = { createdAt: new Date("2026-11-02T00:00:00Z") };
    state.observations = Array.from({ length: 70 }, (_, i) => oct(1 + (i % 28))); // 30 trial + 40 extra
    await settleTopUps("org_1", new Date("2026-11-03T00:00:00Z"));
    expect(state.settlements[0]).toMatchObject({ planId: "trial", cap: 30, overflow: 40 });
    expect(state.packs.map((p) => p.consumed)).toEqual([40, 0]);
  });
});
