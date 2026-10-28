import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_USD_INR_RATE, estimateMrr, microsToInr, SERVICE_TIER_PRICES_INR, usdInrRate } from "@/lib/admin/money";
import { PLANS } from "@/lib/billing/plans";

afterEach(() => vi.unstubAllEnvs());

describe("estimateMrr", () => {
  it("sums plan list prices and service-tier prices for billed orgs", () => {
    const m = estimateMrr([
      { planId: "starter", status: "active", serviceTier: null },
      { planId: "growth", status: "active", serviceTier: "fix" },
      { planId: "agency", status: "past_due", serviceTier: "authority" },
    ]);
    const plans = PLANS.starter.priceInrMonthly! + PLANS.growth.priceInrMonthly! + PLANS.agency.priceInrMonthly!;
    const services = 19_999 + 119_999;
    expect(m.planInr).toBe(plans);
    expect(m.serviceInr).toBe(services);
    expect(m.totalInr).toBe(plans + services);
  });

  it("uses the agreed service-tier prices", () => {
    expect(SERVICE_TIER_PRICES_INR).toEqual({ fix: 19_999, grow: 49_999, authority: 119_999 });
  });

  it("ignores trial plans, cancelled/suspended orgs and unknown tiers", () => {
    const m = estimateMrr([
      { planId: "trial", status: "active", serviceTier: null },
      { planId: "growth", status: "cancelled", serviceTier: "grow" },
      { planId: "agency", status: "suspended", serviceTier: null },
      { planId: "starter", status: "active", serviceTier: "platinum" },
      { planId: "made-up", status: "active", serviceTier: null },
    ]);
    expect(m.totalInr).toBe(PLANS.starter.priceInrMonthly);
    expect(m.serviceInr).toBe(0);
  });

  it("counts a service client on the trial plan (service fee only)", () => {
    const m = estimateMrr([{ planId: "trial", status: "active", serviceTier: "grow" }]);
    expect(m.totalInr).toBe(49_999);
    expect(m.lines).toEqual([expect.objectContaining({ kind: "service", id: "grow", count: 1, totalInr: 49_999 })]);
  });

  it("accepts grouped counts (groupBy rows) and multiplies by count", () => {
    const m = estimateMrr([
      { planId: "growth", status: "active", serviceTier: "grow", count: 3 },
      { planId: "growth", status: "active", serviceTier: null, count: 2 },
      { planId: "starter", status: "cancelled", serviceTier: null, count: 10 },
    ]);
    expect(m.planInr).toBe(5 * PLANS.growth.priceInrMonthly!);
    expect(m.serviceInr).toBe(3 * 49_999);
    const growthLine = m.lines.find((l) => l.kind === "plan" && l.id === "growth");
    expect(growthLine).toMatchObject({ count: 5, unitInr: PLANS.growth.priceInrMonthly });
    // Lines are sorted by contribution, largest first.
    expect(m.lines[0].totalInr).toBeGreaterThanOrEqual(m.lines[m.lines.length - 1].totalInr);
  });

  it("is zero with no customers", () => {
    expect(estimateMrr([])).toEqual({ totalInr: 0, planInr: 0, serviceInr: 0, lines: [] });
  });
});

describe("USD→INR conversion", () => {
  it("defaults to 95 and can be overridden", () => {
    vi.stubEnv("ADMIN_USD_INR_RATE", "");
    expect(usdInrRate()).toBe(DEFAULT_USD_INR_RATE);
    expect(microsToInr(2_000_000)).toBe(190);
    vi.stubEnv("ADMIN_USD_INR_RATE", "83.5");
    expect(usdInrRate()).toBe(83.5);
    vi.stubEnv("ADMIN_USD_INR_RATE", "nonsense");
    expect(usdInrRate()).toBe(95);
  });
});
