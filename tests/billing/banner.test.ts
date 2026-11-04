import { describe, expect, it } from "vitest";
import { pickBanner, trialDaysLeft, type BannerInput } from "@/lib/billing/banner";

const NOW = new Date("2026-11-04T10:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
const base = (o: Partial<BannerInput> = {}): BannerInput => ({
  access: { active: true, planId: "starter", trialEndsAt: null },
  ai: { cap: 300, left: 120 },
  emailVerified: true,
  now: NOW,
  ...o,
});

describe("one banner slot: priority", () => {
  it("nothing to say → no banner", () => expect(pickBanner(base())).toBeNull());

  it("email not confirmed beats trial ending and limit reached", () => {
    expect(
      pickBanner(base({ emailVerified: false, access: { active: true, planId: "trial", trialEndsAt: day(1) }, ai: { cap: 30, left: 0 } })),
    ).toBe("verify_email");
  });

  it("trial ending (≤ 2 days) beats limit reached", () => {
    expect(pickBanner(base({ access: { active: true, planId: "trial", trialEndsAt: day(2) }, ai: { cap: 30, left: 0 } }))).toBe("trial_ending");
  });

  it("trial with more than 2 days left → no trial banner", () => {
    expect(pickBanner(base({ access: { active: true, planId: "trial", trialEndsAt: day(5) } }))).toBeNull();
  });

  it("limit reached when AI answers are used up", () => {
    expect(pickBanner(base({ ai: { cap: 300, left: 0 } }))).toBe("limit_reached");
  });

  it("a blocked account comes first (it's a dead end otherwise)", () => {
    expect(pickBanner(base({ emailVerified: false, access: { active: false, reason: "trial_expired", planId: "trial", trialEndsAt: day(-1) } }))).toBe("blocked");
  });

  it("staff in support mode never see the customer's verify-email banner", () => {
    expect(pickBanner(base({ emailVerified: false, staffMode: true }))).toBeNull();
  });

  it("unknown email state doesn't nag; allowance unavailable doesn't show a limit", () => {
    expect(pickBanner(base({ emailVerified: null, ai: null }))).toBeNull();
  });

  it("trial days left rounds up", () => {
    expect(trialDaysLeft({ active: true, planId: "trial", trialEndsAt: new Date(NOW.getTime() + 25 * 60 * 60 * 1000) }, NOW)).toBe(2);
    expect(trialDaysLeft({ active: true, planId: "starter", trialEndsAt: day(1) }, NOW)).toBeNull();
  });
});
