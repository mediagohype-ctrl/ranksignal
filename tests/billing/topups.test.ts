import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory DB for the monthly settlement (settleTopUps).
const state = vi.hoisted(() => ({
  packs: [] as Record<string, unknown>[],
  settlements: [] as Record<string, unknown>[],
  observations: [] as Date[],
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
import { TOPUP_FROM_PAISE, TOPUP_PACKS, answersLeftLabel, getTopUpPack, isTopUpPackId, pricePerAnswerPaise, topUpExpiry } from "@/lib/billing/topups";
import { settleTopUps } from "@/lib/billing/allowance";

describe("top-up packs (config)", () => {
  it("are the owner's packs, smallest first: 35 for ₹250, 100 for ₹699, 500 for ₹2,999, 2,000 for ₹9,999 (before GST, paise)", () => {
    expect(TOPUP_PACKS.map((p) => [p.answers, p.pricePaise])).toEqual([
      [35, 250_00],
      [100, 699_00],
      [500, 2_999_00],
      [2_000, 9_999_00],
    ]);
    expect(TOPUP_FROM_PAISE).toBe(250_00);
    expect(getTopUpPack("answers_35")?.answers).toBe(35);
    expect(isTopUpPackId("answers_1")).toBe(false);
  });

  // The plan must stay the better deal: a pack's price per answer may not be lower than Starter's.
  // OWNER-APPROVED EXCEPTIONS (2026-11-10): the 500 and 2,000 packs are a bulk discount below Starter's ≈ ₹6.66.
  // Adding a pack to this list is a pricing decision — confirm with the owner first.
  const BELOW_STARTER_APPROVED = new Set(["answers_500", "answers_2000"]);
  it("every other pack costs at least as much per answer as the Starter plan", () => {
    const starter = PLANS.starter;
    const starterPerAnswer = ((starter.priceInrMonthly ?? 0) * 100) / starter.aiAnswersPerMonth;
    for (const p of TOPUP_PACKS) {
      if (BELOW_STARTER_APPROVED.has(p.id)) continue;
      expect(pricePerAnswerPaise(p), p.id).toBeGreaterThanOrEqual(starterPerAnswer);
    }
  });
  it("the approved exceptions are still the cheapest-per-answer packs (bigger pack, lower price per answer)", () => {
    const per = TOPUP_PACKS.map(pricePerAnswerPaise);
    for (let i = 1; i < per.length; i++) expect(per[i]).toBeLessThan(per[i - 1]);
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
