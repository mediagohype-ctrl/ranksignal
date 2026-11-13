import { describe, expect, it } from "vitest";
import { PLANS, PUBLIC_PLAN_IDS, plansShownTo } from "@/lib/billing/plans";
import { CUSTOM_PLAN, DFY_PLAN, MARKETING_PLANS, SELF_PLAN, SERVICE_TIERS } from "@/components/marketing/plans";

describe("public offer: Do it myself, Do it for me, Custom", () => {
  it("offers only Do it myself as a self-serve plan", () => {
    expect(PUBLIC_PLAN_IDS).toEqual(["starter"]);
    expect(PLANS.starter.name).toBe("Do it myself");
    expect(MARKETING_PLANS).toEqual([SELF_PLAN]);
    expect(SELF_PLAN.price).toBe(1_999);
  });

  it("shows the trial and Do it myself on the billing page, plus a legacy plan only to its own customers", () => {
    expect(plansShownTo("trial")).toEqual(["trial", "starter"]);
    expect(plansShownTo("starter")).toEqual(["trial", "starter"]);
    expect(plansShownTo("agency")).toEqual(["trial", "starter", "agency"]);
    expect(plansShownTo("nonsense")).toEqual(["trial", "starter"]);
  });

  it("has one done-for-you offer with no setup fee, and a Custom option", () => {
    expect(SERVICE_TIERS).toEqual([DFY_PLAN]);
    expect(DFY_PLAN).toMatchObject({ name: "Do it for me", price: 19_999, setup: 0, minimumMonths: 3 });
    expect(CUSTOM_PLAN.priceLabel).toBe("Let's talk");
  });
});

describe("Custom plan button", () => {
  it("opens WhatsApp on the sales number with a ready message, in a new tab", async () => {
    const { CUSTOM_CONTACT_HREF, CUSTOM_CONTACT_HREF_HI, newTabProps } = await import("@/components/marketing/plans");
    const url = new URL(CUSTOM_CONTACT_HREF);
    expect(url.origin + url.pathname).toBe("https://wa.me/918447788703");
    expect(url.searchParams.get("text")).toMatch(/^Hi MyWebRank, I'm interested in a Custom plan\.\n\nMy website: /);
    expect(new URL(CUSTOM_CONTACT_HREF_HI).searchParams.get("text")).toMatch(/Custom प्लान/);
    expect(newTabProps(CUSTOM_CONTACT_HREF)).toEqual({ target: "_blank", rel: "noopener noreferrer" });
    expect(newTabProps("/pricing")).toEqual({});
  });
});
