import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  org: null as null | { planId: string; status: string; createdAt: Date },
  subs: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/db", () => ({
  db: {
    organization: { findUnique: vi.fn(async () => state.org) },
    subscription: { findMany: vi.fn(async () => state.subs) },
  },
}));

import { assertOrgActive, evaluateAccess, getOrgAccess, PAST_DUE_GRACE_DAYS } from "@/lib/billing/access";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { HttpError } from "@/lib/api";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-28T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const ahead = (days: number) => new Date(NOW.getTime() + days * DAY);

beforeEach(() => {
  state.org = null;
  state.subs = [];
});

describe("trial", () => {
  it("active until Subscription.trialEndsAt", () => {
    const org = { planId: "trial", status: "active", createdAt: ago(30) };
    const sub = { planId: "trial", status: "trialing", trialEndsAt: ahead(2) };
    expect(evaluateAccess(org, [sub], NOW)).toMatchObject({ active: true, trialEndsAt: ahead(2) });
    expect(evaluateAccess(org, [{ ...sub, trialEndsAt: ago(0.001) }], NOW)).toMatchObject({ active: false, reason: "trial_expired" });
  });
  it("falls back to createdAt + TRIAL_DAYS when there is no trial subscription", () => {
    const fresh = { planId: "trial", status: "active", createdAt: ago(TRIAL_DAYS - 1) };
    expect(evaluateAccess(fresh, [], NOW)).toMatchObject({ active: true });
    const old = { planId: "trial", status: "active", createdAt: ago(TRIAL_DAYS + 0.01) };
    expect(evaluateAccess(old, [], NOW)).toMatchObject({ active: false, reason: "trial_expired" });
  });
  it("suspended always wins", () => {
    expect(evaluateAccess({ planId: "trial", status: "suspended", createdAt: NOW }, [], NOW)).toMatchObject({ active: false, reason: "suspended" });
  });
});

describe("paid plans", () => {
  const org = { planId: "growth", status: "active", createdAt: ago(100) };
  const paid = (status: string, extra: Record<string, unknown> = {}) => ({
    planId: "growth",
    status,
    providerSubscriptionId: "sub_1",
    updatedAt: NOW,
    currentPeriodEnd: ahead(10),
    ...extra,
  });

  it("active / trialing subscriptions are active", () => {
    expect(evaluateAccess(org, [paid("active")], NOW).active).toBe(true);
    expect(evaluateAccess(org, [paid("trialing")], NOW).active).toBe(true);
  });
  it("ignores the expired signup trial row", () => {
    const trialRow = { planId: "trial", status: "expired", trialEndsAt: ago(50) };
    expect(evaluateAccess(org, [paid("active"), trialRow], NOW).active).toBe(true);
    // Paid plan set by staff with no provider subscription follows organization status.
    expect(evaluateAccess(org, [trialRow], NOW).active).toBe(true);
    expect(evaluateAccess({ ...org, status: "past_due" }, [trialRow], NOW)).toMatchObject({ active: false, reason: "past_due" });
  });
  it(`past_due has a ${PAST_DUE_GRACE_DAYS}-day grace from updatedAt`, () => {
    const inGrace = evaluateAccess(org, [paid("past_due", { updatedAt: ago(PAST_DUE_GRACE_DAYS - 0.5) })], NOW);
    expect(inGrace).toMatchObject({ active: true, reason: "past_due" });
    expect(inGrace.graceEndsAt?.getTime()).toBe(ago(PAST_DUE_GRACE_DAYS - 0.5).getTime() + PAST_DUE_GRACE_DAYS * DAY);
    expect(evaluateAccess(org, [paid("past_due", { updatedAt: ago(PAST_DUE_GRACE_DAYS + 0.01) })], NOW)).toMatchObject({
      active: false,
      reason: "past_due",
    });
  });
  it("cancelled keeps access until the paid period ends", () => {
    expect(evaluateAccess(org, [paid("cancelled")], NOW)).toMatchObject({ active: true, reason: "cancelled" });
    expect(evaluateAccess(org, [paid("cancelled", { currentPeriodEnd: ago(1) })], NOW)).toMatchObject({ active: false, reason: "cancelled" });
    expect(evaluateAccess(org, [paid("expired", { currentPeriodEnd: null })], NOW)).toMatchObject({ active: false, reason: "cancelled" });
  });
});

describe("assertOrgActive", () => {
  it("throws 402 plan_inactive with an upgrade hint", async () => {
    state.org = { planId: "trial", status: "active", createdAt: ago(TRIAL_DAYS + 1) };
    const err = await assertOrgActive("org_1").catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 402, code: "plan_inactive" });
    expect((err as HttpError).message).toMatch(/trial has ended/i);
    expect((err as HttpError).details).toMatchObject({ reason: "trial_expired", upgradeUrl: expect.any(String) });
  });
  it("passes for an active trial", async () => {
    state.org = { planId: "trial", status: "active", createdAt: new Date() };
    await expect(assertOrgActive("org_1")).resolves.toMatchObject({ active: true });
  });
  it("missing organization is inactive", async () => {
    expect((await getOrgAccess("nope")).active).toBe(false);
  });
});
