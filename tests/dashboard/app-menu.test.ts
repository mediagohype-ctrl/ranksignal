// The app menu is one pure function of {offer, what is switched on, Expert mode, number of websites}.
import { describe, expect, it } from "vitest";
import { buildMenu, DEFAULT_MENU_INPUT, expertModeHelp, hiddenPageSlugs, unreadBadgeText, UPGRADE_HREF, type MenuInput } from "@/components/app/nav";
import { capabilityLines } from "@/components/app/integrations/capability-matrix";
import { choiceForPlatform, detectedName, noConnectionLine } from "@/components/app/integrations/platforms";
import { SHOPIFY_CAPABILITIES } from "@/lib/connectors/shopify";
import { descriptor as shopify } from "@/lib/connectors/catalog/shopify";

const base: MenuInput = { ...DEFAULT_MENU_INPUT };
const slugs = (pages: { slug?: string }[]) => pages.map((p) => p.slug);
const google = (i: MenuInput) => buildMenu(i).tabs.find((t) => t.key === "google");

describe("buildMenu", () => {
  it("Do it myself: no Connect website, no IndexNow, no Advanced group without Expert mode", () => {
    const m = buildMenu(base);
    expect(slugs(m.setup)).toEqual(["alerts", "settings"]);
    expect(m.advanced).toEqual([]);
    expect(m.account.map((l) => l.key)).toEqual(["websites", "prospect", "settings"]);
  });

  it("Do it myself + Expert mode: Advanced has API keys only (IndexNow needs a key file on the website)", () => {
    expect(buildMenu({ ...base, expert: true }).advanced.map((l) => l.key)).toEqual(["api"]);
  });

  it("managed offers: Connect website in Setup; IndexNow and API keys under Advanced with Expert mode", () => {
    const m = buildMenu({ ...base, canConnect: true });
    expect(slugs(m.setup)).toEqual(["integrations", "alerts", "settings"]);
    expect(m.advanced).toEqual([]);
    const e = buildMenu({ ...base, canConnect: true, expert: true });
    expect(e.advanced.map((l) => l.key)).toEqual(["indexnow", "api"]);
    expect(e.advanced[0].slug).toBe("indexnow");
    expect(e.advanced[1].href).toBe("/app/settings/api");
  });

  it("Portfolio only with 2+ websites", () => {
    expect(buildMenu({ ...base, websiteCount: 1 }).account.some((l) => l.key === "portfolio")).toBe(false);
    expect(buildMenu({ ...base, websiteCount: 2 }).account.some((l) => l.key === "portfolio")).toBe(true);
  });

  it("Google tab: Keywords always; paid pages only when their data is switched on", () => {
    expect(slugs(google(base)!.pages)).toEqual(["keywords"]);
    expect(slugs(google({ ...base, googleData: true })!.pages)).toEqual(["keywords", "rankings", "research", "competitors"]);
    expect(slugs(google({ ...base, googleData: true, backlinks: true })!.pages)).toEqual([
      "keywords",
      "rankings",
      "research",
      "competitors",
      "backlinks",
    ]);
    // Keywords moved out of Progress.
    expect(buildMenu(base).tabs.find((t) => t.key === "progress")!.pages.some((p) => p.slug === "keywords")).toBe(false);
  });

  it("Business profile only when switched on", () => {
    const home = (i: MenuInput) => slugs(buildMenu(i).tabs.find((t) => t.key === "home")!.pages);
    expect(home(base)).not.toContain("business-profile");
    expect(home({ ...base, businessProfile: true })).toContain("business-profile");
    expect(hiddenPageSlugs(base).has("business-profile")).toBe(true);
  });

  it("staff in support mode see everything", () => {
    const m = buildMenu({ ...base, staff: true });
    expect(slugs(m.setup)).toContain("integrations");
    expect(m.advanced.map((l) => l.key)).toEqual(["indexnow", "api"]);
    expect(m.account.some((l) => l.key === "portfolio")).toBe(true);
    expect(slugs(google({ ...base, staff: true })!.pages)).toContain("backlinks");
  });

  it("Expert mode help says what it shows, per offer", () => {
    expect(expertModeHelp(false)).toMatch(/API keys/);
    expect(expertModeHelp(false)).not.toMatch(/IndexNow/);
    expect(expertModeHelp(true)).toMatch(/IndexNow and API keys/);
  });

  it("Upgrade goes to the plan cards on the Billing tab", () => {
    expect(UPGRADE_HREF).toBe("/app/settings?tab=billing#plans");
  });
});

describe("notification badge", () => {
  it("caps at 99+ and never shows a negative or broken number", () => {
    expect(unreadBadgeText(0)).toBe("0");
    expect(unreadBadgeText(18)).toBe("18");
    expect(unreadBadgeText(99)).toBe("99");
    expect(unreadBadgeText(100)).toBe("99+");
    expect(unreadBadgeText(123456)).toBe("99+");
    expect(unreadBadgeText(-3)).toBe("0");
    expect(unreadBadgeText(Number.NaN)).toBe("0");
  });
});

describe("Connect website page", () => {
  it("pre-selects the detected platform and names it", () => {
    expect(choiceForPlatform("shopify")?.connector).toBe("shopify");
    expect(detectedName("shopify")).toBe("Shopify");
    expect(choiceForPlatform("nextjs")?.id).toBe("code");
    expect(choiceForPlatform(null)).toBeNull();
    expect(detectedName("custom")).toBeNull();
  });

  it("is honest about platforms without a connection (Framer)", () => {
    expect(choiceForPlatform("framer")?.connector).toBeNull();
    expect(noConnectionLine("Framer")).toBe("We don't have a Framer connection. Our team makes the changes for you by hand.");
  });

  it("lists plain capabilities from the real flags", () => {
    const { can, cannot } = capabilityLines(SHOPIFY_CAPABILITIES);
    expect(can.length + cannot.length).toBe(6);
    expect(capabilityLines(null).can).toEqual([]);
  });

  it("Shopify steps no longer tell owners to create a new custom app in the admin", () => {
    const steps = shopify.setupSteps.join(" ");
    expect(steps).not.toMatch(/Create an app/);
    expect(steps).toMatch(/before January 2026/);
    expect(steps).toMatch(/our team makes the changes for you/);
    expect(steps).toMatch(/write_online_store_pages/);
  });
});
