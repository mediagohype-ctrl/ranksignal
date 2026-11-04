// Admin: AI cost vs what the customer pays, org labels that tell same-named orgs apart, staff wording, lead follow-up email.
import { describe, expect, it } from "vitest";
import { costVsPrice, monthlyPriceInr, SERVICE_TIER_PRICES_INR } from "@/lib/admin/money";
import { hostLabel, orgDisplayLabel, staffAccessMessage } from "@/lib/admin/labels";
import { leadFollowupEmail, topFixFromMessage, topFixMessage } from "@/lib/admin/lead-followup";
import { PLANS } from "@/lib/billing/plans";

const usd = (n: number) => n * 1_000_000;

describe("costVsPrice", () => {
  it("flags a customer whose AI cost (at ₹95/$) is above what they pay", () => {
    const price = PLANS.starter.priceInrMonthly!;
    const overUsd = price / 95 + 1;
    const r = costVsPrice({ planId: "starter", status: "active", serviceTier: null, costMicros: usd(overUsd) }, 95);
    expect(r.priceInr).toBe(price);
    expect(r.costInr).toBeCloseTo(overUsd * 95);
    expect(r.costsMore).toBe(true);
    expect(r.marginInr).toBeLessThan(0);
  });
  it("does not flag a profitable customer, and counts the service tier", () => {
    const r = costVsPrice({ planId: "starter", status: "active", serviceTier: "fix", costMicros: usd(10) }, 95);
    expect(r.priceInr).toBe(PLANS.starter.priceInrMonthly! + SERVICE_TIER_PRICES_INR.fix);
    expect(r.costInr).toBe(950);
    expect(r.costsMore).toBe(false);
  });
  it("trials and cancelled orgs pay 0, so any cost flags; zero cost never flags", () => {
    expect(monthlyPriceInr({ planId: "trial", status: "active", serviceTier: null })).toBe(0);
    expect(monthlyPriceInr({ planId: "growth", status: "cancelled", serviceTier: null })).toBe(0);
    expect(costVsPrice({ planId: "trial", status: "active", serviceTier: null, costMicros: usd(0.5) }, 95).costsMore).toBe(true);
    expect(costVsPrice({ planId: "trial", status: "active", serviceTier: null, costMicros: 0 }, 95).costsMore).toBe(false);
  });
});

describe("orgDisplayLabel", () => {
  it("adds website and owner email so two 'Go Hype Media' orgs differ", () => {
    const a = orgDisplayLabel({ name: "Go Hype Media", website: "https://www.gohypemedia.com/", ownerEmail: "a@gohypemedia.com" });
    const b = orgDisplayLabel({ name: "Go Hype Media", website: "https://clientsite.in", ownerEmail: "b@clientsite.in" });
    expect(a).toBe("Go Hype Media · gohypemedia.com · a@gohypemedia.com");
    expect(a).not.toBe(b);
    expect(orgDisplayLabel({ name: "Solo", website: null, ownerEmail: null })).toBe("Solo");
    expect(hostLabel("not a url")).toBe("not a url");
  });
});

describe("staffAccessMessage", () => {
  it("never says 'Your plan'", () => {
    for (const reason of [undefined, "trial_expired", "past_due", "cancelled", "suspended"] as const) {
      for (const active of [true, false]) {
        expect(staffAccessMessage({ active, reason, planId: "starter" })).not.toMatch(/\byour\b/i);
      }
    }
  });
});

describe("lead follow-up email", () => {
  it("round-trips the top fix stored on the lead", () => {
    expect(topFixFromMessage(topFixMessage("Add a Google summary to 6 pages"))).toBe("Add a Google summary to 6 pages");
    expect(topFixFromMessage("Hello, please call me")).toBeNull();
    expect(topFixMessage(null)).toBeNull();
  });
  it("includes the score, top fix and a sign-up link for their website", () => {
    const e = leadFollowupEmail(
      { url: "https://www.shop.in/", score: 51, message: topFixMessage("Say what you sell on your homepage") },
      "https://app.example",
    );
    expect(e.subject).toBe("Your website check for shop.in");
    expect(e.text).toContain("51 / 100 (Needs work)");
    expect(e.text).toContain("Say what you sell on your homepage");
    expect(e.text).toContain("https://app.example/signup?website=https%3A%2F%2Fwww.shop.in%2F");
  });
});
