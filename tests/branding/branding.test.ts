import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ db: { organization: { findUnique: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ db: h.db }));

import {
  brandingInputSchema,
  contrastRatio,
  emailBranding,
  getBranding,
  isBrandingEligible,
  isReadableAccent,
  normalizeHex,
  readStoredBranding,
  resolveBranding,
  safeHttpsUrl,
  toPublicBranding,
  toStoredBranding,
} from "@/lib/branding";
import { renderEmail } from "@/lib/email/layout";
import { monthlyReportEmail } from "@/lib/monthly-report/email";
import type { MonthlyReportPayload } from "@/lib/monthly-report/types";
import { BRAND } from "@/lib/brand";

beforeEach(() => vi.clearAllMocks());

describe("branding validation", () => {
  it("allows only https logo URLs", () => {
    expect(safeHttpsUrl("https://cdn.example.com/logo.png")).toBe("https://cdn.example.com/logo.png");
    for (const bad of [
      "http://example.com/logo.png",
      "data:image/png;base64,AAAA",
      "javascript:alert(1)",
      "//example.com/x.png",
      "https://user:pw@example.com/x.png",
      "ftp://example.com/x.png",
      "",
    ]) {
      expect(safeHttpsUrl(bad)).toBeNull();
    }
    expect(brandingInputSchema.safeParse({ logoUrl: "data:image/svg+xml,<svg onload=alert(1)>" }).success).toBe(false);
    expect(brandingInputSchema.safeParse({ logoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(brandingInputSchema.safeParse({ logoUrl: "https://a.example/logo.svg" }).success).toBe(true);
  });

  it("normalises hex colours and rejects anything else", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("1f6feb")).toBe("#1f6feb");
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("#1f6feb;background:url(x)")).toBeNull();
  });

  it("checks accent contrast against white (AA 4.5:1)", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(isReadableAccent("#1d4ed8")).toBe(true);
    expect(isReadableAccent("#ffeb3b")).toBe(false); // yellow on white is unreadable
    expect(brandingInputSchema.safeParse({ accentColor: "#ffeb3b" }).success).toBe(false);
    const ok = brandingInputSchema.parse({ accentColor: "#1D4ED8" });
    expect(ok.accentColor).toBe("#1d4ed8");
  });

  it("validates reply-to, footer length and strips control characters", () => {
    expect(brandingInputSchema.safeParse({ replyTo: "not-an-email" }).success).toBe(false);
    expect(brandingInputSchema.safeParse({ footerText: "x".repeat(201) }).success).toBe(false);
    const v = brandingInputSchema.parse({ displayName: "Acme\r\nBcc: evil@x.test", footerText: "", replyTo: "" });
    expect(v.displayName).toBe("Acme Bcc: evil@x.test");
    expect(v.footerText).toBeNull();
    expect(v.replyTo).toBeNull();
    expect(brandingInputSchema.safeParse({ unknown: 1 }).success).toBe(false);
  });

  it("hidePoweredBy is agency-only when storing", () => {
    expect(toStoredBranding({ hidePoweredBy: true }, { planId: "growth" }).hidePoweredBy).toBe(false);
    expect(toStoredBranding({ hidePoweredBy: true }, { planId: "agency" }).hidePoweredBy).toBe(true);
  });

  it("re-sanitises the stored JSON on read", () => {
    const s = readStoredBranding({ logoUrl: "javascript:alert(1)", accentColor: "#ffff00", replyTo: "bad", displayName: "  X  " });
    expect(s).toMatchObject({ logoUrl: null, accentColor: null, replyTo: null, displayName: "X" });
    expect(readStoredBranding("nope")).toBeNull();
  });
});

describe("plan gate + getBranding", () => {
  const stored = { displayName: "Acme Digital", logoUrl: "https://acme.test/l.png", accentColor: "#1d4ed8", replyTo: "hi@acme.test", footerText: "Mumbai", hidePoweredBy: true };

  it("only agency or done-for-you orgs are eligible", () => {
    expect(isBrandingEligible({ planId: "agency" })).toBe(true);
    expect(isBrandingEligible({ planId: "starter", serviceTier: "fix" })).toBe(true);
    expect(isBrandingEligible({ planId: "growth", serviceTier: null })).toBe(false);
  });

  it("falls back to the product brand for ineligible orgs, even with stored branding", () => {
    const b = resolveBranding({ planId: "growth", serviceTier: null, branding: stored });
    expect(b.custom).toBe(false);
    expect(b.displayName).toBe(BRAND.name);
  });

  it("done-for-you org on a non-agency plan gets branding but cannot hide Powered by", () => {
    const b = resolveBranding({ planId: "growth", serviceTier: "grow", branding: stored });
    expect(b).toMatchObject({ custom: true, displayName: "Acme Digital", hidePoweredBy: false });
  });

  it("getBranding loads the org and never throws", async () => {
    h.db.organization.findUnique.mockResolvedValueOnce({ name: "A", planId: "agency", serviceTier: null, branding: stored });
    const b = await getBranding("org_1");
    expect(h.db.organization.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "org_1" } }));
    expect(b).toMatchObject({ custom: true, hidePoweredBy: true, replyTo: "hi@acme.test" });
    expect("replyTo" in toPublicBranding(b)).toBe(false);

    h.db.organization.findUnique.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await getBranding("org_1")).custom).toBe(false);
  });
});

describe("renderEmail branding", () => {
  it("is unchanged when no branding is passed", () => {
    const a = renderEmail({ title: "Hello", paragraphs: ["Body"] });
    expect(a.html).toContain("/brand/logo-mark-96.png");
    expect(a.html).toContain(BRAND.supportEmail);
    expect(a.text).toContain(`${BRAND.name} · ${BRAND.supportEmail}`);
  });

  it("applies branding with every value escaped", () => {
    const evil = `<script>x</script>"'&`;
    const { html, text } = renderEmail({
      title: "Report",
      paragraphs: ["p"],
      cta: { label: "Open", url: "https://app.test/r" },
      branding: { displayName: evil, logoUrl: "https://acme.test/logo.png?a=1&b=2", accentColor: "#1d4ed8", footerText: evil },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;&quot;&#39;&amp;");
    expect(html).toContain('src="https://acme.test/logo.png?a=1&amp;b=2"');
    expect(html).toContain("background:#1d4ed8");
    expect(html).not.toContain("/brand/logo-mark-96.png");
    expect(html).toContain(`Sent with ${BRAND.name}`);
    expect(text).toContain(evil);
  });

  it("ignores non-https logos and non-hex colours", () => {
    const { html } = renderEmail({
      title: "t",
      paragraphs: [],
      cta: { label: "Go", url: "https://app.test" },
      branding: { displayName: "A", logoUrl: "javascript:alert(1)", accentColor: "red;background:url(javascript:x)" },
    });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("red;");
    const d = renderEmail({ title: "t", paragraphs: [], branding: { logoUrl: "data:image/png;base64,AAA" } });
    expect(d.html).not.toContain("data:image");
  });

  it("can hide the Sent with line", () => {
    const { html, text } = renderEmail({ title: "t", paragraphs: [], branding: { displayName: "Acme", hidePoweredBy: true } });
    expect(html).not.toContain(`Sent with ${BRAND.name}`);
    expect(text).not.toContain(BRAND.name);
  });
});

describe("monthly report email", () => {
  const payload = {
    period: "2026-10",
    periodLabel: "October 2026",
    project: { id: "p1", name: "Client site", domain: "client.test" },
    scores: { start: { overall: 60 }, end: { overall: 68 } },
    aiVisibility: { start: null, end: null, likeForLike: null },
    work: { shipped: [] },
    issues: { fixed: { total: 3 } },
  } as unknown as MonthlyReportPayload;

  it("passes branding through and returns replyTo", () => {
    const b = resolveBranding({ planId: "agency", branding: { displayName: "Acme <Digital>", replyTo: "team@acme.test", accentColor: "#1d4ed8" } });
    const mail = monthlyReportEmail(payload, "Summary", "https://app.test", b);
    expect(mail.replyTo).toBe("team@acme.test");
    expect(mail.html).toContain("Acme &lt;Digital&gt;");
    expect(emailBranding(b)?.displayName).toBe("Acme <Digital>");
  });

  it("is unbranded without branding", () => {
    const mail = monthlyReportEmail(payload, "Summary", "https://app.test");
    expect(mail.replyTo).toBeUndefined();
    expect(mail.html).toContain("/brand/logo-mark-96.png");
  });
});
