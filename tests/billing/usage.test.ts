import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { organizationId: string; kind: string; taskType: string; credits: number; billingPeriod: string; provider: string };

const state = vi.hoisted(() => ({
  ledger: [] as Row[],
  org: { planId: "starter", status: "active" } as { planId: string; status: string } | null,
  notifications: [] as { title: string; type: string }[],
  projects: 0,
  prompts: 0,
}));

vi.mock("@/lib/db", () => {
  const db = {
    organization: { findUnique: vi.fn(async () => state.org) },
    usageLedger: {
      groupBy: vi.fn(async ({ where }: { where: { organizationId: string; billingPeriod: string } }) => {
        const groups = new Map<string, { kind: string; taskType: string; _sum: { credits: number } }>();
        for (const r of state.ledger) {
          if (r.organizationId !== where.organizationId || r.billingPeriod !== where.billingPeriod) continue;
          const k = `${r.kind}|${r.taskType}`;
          const g = groups.get(k) ?? { kind: r.kind, taskType: r.taskType, _sum: { credits: 0 } };
          g._sum.credits += r.credits;
          groups.set(k, g);
        }
        return [...groups.values()];
      }),
      create: vi.fn(async ({ data }: { data: Row }) => {
        state.ledger.push(data);
        return data;
      }),
    },
    notification: { create: vi.fn(async ({ data }: { data: { title: string; type: string } }) => state.notifications.push(data)) },
    subscription: { findMany: vi.fn(async () => []) },
    project: { count: vi.fn(async () => state.projects) },
    trackedPrompt: { count: vi.fn(async () => state.prompts) },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
  };
  return { db };
});

import {
  assertProjectLimit,
  assertPromptLimit,
  billingPeriod,
  getUsageSummary,
  recordUsage,
  releaseReservation,
  reserveCredits,
} from "@/lib/billing/usage";
import { PLANS, getPlan } from "@/lib/billing/plans";
import { JobError } from "@/lib/types";
import { HttpError } from "@/lib/api";

const ORG = "org_1";
const base = { provider: "openai", taskType: "visibility_prompt" };

beforeEach(() => {
  state.ledger = [];
  state.org = { planId: "starter", status: "active" };
  state.notifications = [];
  state.projects = 0;
  state.prompts = 0;
});

describe("billingPeriod", () => {
  it("formats YYYY-MM in UTC", () => {
    expect(billingPeriod(new Date("2026-03-31T23:30:00Z"))).toBe("2026-03");
    expect(billingPeriod(new Date("2026-12-01T00:00:00Z"))).toBe("2026-12");
  });
});

describe("plans", () => {
  it("falls back to trial for unknown plan ids", () => {
    expect(getPlan("nope")).toBe(PLANS.trial);
  });
  it("trial mirrors starter structural limits", () => {
    expect(PLANS.trial.maxProjects).toBe(PLANS.starter.maxProjects);
    expect(PLANS.trial.maxTrackedPrompts).toBe(PLANS.starter.maxTrackedPrompts);
  });
});

describe("usage ledger math", () => {
  it("used = sum(actual); reserved = sum(reservation) - sum(release)", async () => {
    await reserveCredits(ORG, { ...base, credits: 100 });
    await recordUsage(ORG, { ...base, credits: 60, costMicros: 1234 });
    await recordUsage(ORG, { provider: "crawler", taskType: "crawl_page", credits: 15, costMicros: 0 });
    await releaseReservation(ORG, { ...base, credits: 40 });
    const s = await getUsageSummary(ORG);
    expect(s.used).toBe(75);
    expect(s.reserved).toBe(60);
    expect(s.limit).toBe(PLANS.starter.monthlyCredits);
    expect(s.byTaskType).toEqual({ visibility_prompt: 60, crawl_page: 15 });
    expect(s.period).toBe(billingPeriod());
  });

  it("allows reserving exactly up to the limit, rejects one more with quota JobError", async () => {
    const limit = PLANS.starter.monthlyCredits;
    await recordUsage(ORG, { ...base, credits: limit - 100, costMicros: 0 });
    await reserveCredits(ORG, { ...base, credits: 50 });
    await reserveCredits(ORG, { ...base, credits: 50 }); // used + reserved == limit
    const err = await reserveCredits(ORG, { ...base, credits: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(JobError);
    expect((err as JobError).errorClass).toBe("quota");
  });

  it("released reservations free capacity again", async () => {
    const limit = PLANS.starter.monthlyCredits;
    await reserveCredits(ORG, { ...base, credits: limit });
    await expect(reserveCredits(ORG, { ...base, credits: 1 })).rejects.toBeInstanceOf(JobError);
    await releaseReservation(ORG, { ...base, credits: limit });
    await expect(reserveCredits(ORG, { ...base, credits: 1 })).resolves.toBeUndefined();
  });

  it("ignores ledger rows from other periods", async () => {
    state.ledger.push({ organizationId: ORG, kind: "actual", taskType: "x", credits: 999_999, billingPeriod: "2000-01", provider: "p" });
    await expect(reserveCredits(ORG, { ...base, credits: 10 })).resolves.toBeUndefined();
  });

  it("blocks suspended organizations", async () => {
    state.org = { planId: "agency", status: "suspended" };
    await expect(reserveCredits(ORG, { ...base, credits: 1 })).rejects.toMatchObject({ errorClass: "quota" });
  });

  it("emits threshold notifications at 80% and 100% exactly once each", async () => {
    const limit = PLANS.starter.monthlyCredits;
    await recordUsage(ORG, { ...base, credits: Math.floor(limit * 0.5), costMicros: 0 });
    expect(state.notifications).toHaveLength(0);
    await recordUsage(ORG, { ...base, credits: Math.ceil(limit * 0.3), costMicros: 0 });
    expect(state.notifications).toHaveLength(1);
    await recordUsage(ORG, { ...base, credits: 1, costMicros: 0 });
    expect(state.notifications).toHaveLength(1);
    await recordUsage(ORG, { ...base, credits: limit, costMicros: 0 });
    expect(state.notifications).toHaveLength(2);
    expect(state.notifications.every((n) => n.type === "usage_threshold")).toBe(true);
  });
});

describe("plan limit guards", () => {
  it("assertProjectLimit throws 402 plan_limit at the cap", async () => {
    state.projects = PLANS.starter.maxProjects;
    const err = await assertProjectLimit(ORG).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 402, code: "plan_limit" });
    state.projects = PLANS.starter.maxProjects - 1;
    await expect(assertProjectLimit(ORG)).resolves.toBeUndefined();
  });

  it("assertPromptLimit accounts for the number being added", async () => {
    state.prompts = PLANS.starter.maxTrackedPrompts - 5;
    await expect(assertPromptLimit(ORG, "p1", 5)).resolves.toBeUndefined();
    await expect(assertPromptLimit(ORG, "p1", 6)).rejects.toMatchObject({ status: 402, code: "plan_limit" });
  });
});
