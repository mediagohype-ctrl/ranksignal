// Free check fix brief (Nov 2026): WhatsApp unlock box, 24-hour cache, redirects that skip moved pages.
import { describe, expect, it } from "vitest";
import { decideLeadWhatsApp, leadWhatsAppSchema, normalizeIndianMobile, reportLink, salesAlert, visitorMessage } from "@/lib/free-check/lead-whatsapp";
import { clearFreeCheckCache, freeCheckCacheKey, getCachedFreeCheck, setCachedFreeCheck, FREE_CHECK_CACHE_MS } from "@/lib/free-check/cache";
import { attributionFrom } from "@/lib/attribution";
import { currentPath } from "@/lib/seo/redirects";
import { homeCandidates, toggleWww } from "@/lib/free-check/run";
import type { FreeCheckResult } from "@/lib/free-check/types";

describe("WhatsApp number", () => {
  it("accepts Indian mobiles typed any common way and returns 91 + 10 digits", () => {
    for (const raw of ["9876543210", "98765 43210", "+91 98765-43210", "919876543210", "09876543210"]) {
      expect(normalizeIndianMobile(raw), raw).toBe("919876543210");
    }
  });
  it("rejects landlines, short numbers and junk", () => {
    for (const raw of ["1234567890", "98765", "abc", "", "+1 415 555 0100"]) expect(normalizeIndianMobile(raw), raw).toBeNull();
  });
  it("needs a lead id or a website", () => {
    expect(leadWhatsAppSchema.safeParse({ phone: "9876543210" }).success).toBe(false);
    expect(leadWhatsAppSchema.safeParse({ phone: "9876543210", leadId: "clead1234567" }).success).toBe(true);
    expect(leadWhatsAppSchema.safeParse({ phone: "9876543210", url: "acme.com", failure: "timeout" }).success).toBe(true);
  });
  it("only stores on fresh free-check leads and never overwrites another number", () => {
    const now = Date.now();
    const lead = { source: "free_check", phone: null, createdAt: new Date(now - 1000) };
    expect(decideLeadWhatsApp(lead, "919876543210", now)).toEqual({ ok: true, changed: true });
    expect(decideLeadWhatsApp({ ...lead, phone: "919876543210" }, "919876543210", now)).toEqual({ ok: true, changed: false });
    expect(decideLeadWhatsApp({ ...lead, phone: "919999999999" }, "919876543210", now)).toMatchObject({ ok: false, reason: "taken" });
    expect(decideLeadWhatsApp({ ...lead, source: "contact" }, "919876543210", now)).toMatchObject({ ok: false });
    expect(decideLeadWhatsApp({ ...lead, createdAt: new Date(now - 25 * 3600_000) }, "919876543210", now)).toMatchObject({ reason: "expired" });
  });
  it("links the visitor back to the check for their site, tagged as WhatsApp", () => {
    const link = reportLink("https://mywebrank.tech/", "https://www.acme.com/");
    expect(link).toBe("https://mywebrank.tech/free-check?url=acme.com&utm_source=whatsapp&utm_medium=lead&utm_campaign=free_check_report");
    expect(visitorMessage({ websiteUrl: "https://acme.com/", score: 61.4, link, failed: false })).toContain("score 61/100");
    expect(visitorMessage({ websiteUrl: "https://acme.com/", score: null, link, failed: true })).toMatch(/by hand/);
  });
  it("gives sales the number, site, score and ad source", () => {
    const a = salesAlert({
      phone: "919876543210",
      websiteUrl: "https://acme.com/",
      score: 48,
      topFix: "Add a page title",
      failure: null,
      attribution: { utm_source: "instagram", utm_campaign: "diwali" },
      leadId: "l1",
      appUrl: "https://mywebrank.tech",
    });
    expect(a.subject).toBe("New WhatsApp lead: acme.com");
    expect(a.text).toContain("wa.me/919876543210");
    expect(a.text).toContain("Score: 48/100");
    expect(a.text).toContain("Source: instagram / diwali");
    expect(a.text).toContain("https://mywebrank.tech/admin/leads/l1");
  });
});

describe("attribution", () => {
  it("reads UTM tags and fbclid from the landing URL", () => {
    expect(attributionFrom("https://mywebrank.tech/?utm_source=ig&utm_medium=paid&fbclid=abc")).toEqual({
      utm_source: "ig",
      utm_medium: "paid",
      fbclid: "abc",
      landing: "/",
    });
    expect(attributionFrom("https://mywebrank.tech/pricing")).toBeNull();
  });
});

describe("free-check cache", () => {
  const item = { url: "https://www.acme.com/", leadId: "l1", benchmark: null, overall: { score: 50 } } as unknown as FreeCheckResult;
  it("serves the same site for 24 hours, whatever way it is typed, without the lead id", () => {
    clearFreeCheckCache();
    const t0 = 1_000_000;
    setCachedFreeCheck(["https://acme.com/"], item, t0);
    expect(freeCheckCacheKey("https://WWW.acme.com/")).toBe(freeCheckCacheKey("https://acme.com"));
    const hit = getCachedFreeCheck("https://www.acme.com/", t0 + 1000);
    expect(hit).toMatchObject({ url: "https://www.acme.com/" });
    expect(hit).not.toHaveProperty("leadId");
    expect(getCachedFreeCheck("https://acme.com/", t0 + FREE_CHECK_CACHE_MS + 1)).toBeNull();
  });
});

describe("homepage address variants", () => {
  it("toggles www and adds plain http last", () => {
    expect(toggleWww("https://acme.com/")).toBe("https://www.acme.com/");
    expect(toggleWww("https://www.acme.com/")).toBe("https://acme.com/");
    expect(toggleWww("https://1.2.3.4/")).toBeNull();
    expect(homeCandidates("https://acme.com/")).toEqual(["https://acme.com/", "https://www.acme.com/", "http://acme.com/"]);
  });
});

describe("links to moved pages", () => {
  it("point straight at the new address (no redirect hop)", () => {
    expect(currentPath("/services")).toBe("/done-for-you");
    expect(currentPath("/services/?a=1#x")).toBe("/done-for-you?a=1#x");
    expect(currentPath("/pricing")).toBe("/pricing");
  });
});
