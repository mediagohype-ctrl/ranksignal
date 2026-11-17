// 15 Nov 2026 site audit: /services → /done-for-you, tool renames, hidden extension, sign-up score, plan card copy.
import { describe, expect, it } from "vitest";
import { PERMANENT_REDIRECTS } from "../../next.config";
import { MARKETING_ROUTES, buildLlmsTxt, buildSitemap } from "@/lib/free-check/site-seo";
import { PAGE_SEO } from "@/lib/seo/pages";
import { hreflangFor } from "@/components/marketing/hi/pairs";
import { TOOL_LABELS } from "@/lib/admin/tool-usage";
import { TOOL_NAMES } from "@/lib/growth/tools";
import { MARKETING_PLANS, SELF_PLAN, aiCheckedLine } from "@/components/marketing/plans";
import { SELF_FIX_LINE } from "@/lib/billing/offer";
import { OUR } from "@/components/marketing/compare/ours";
import { LAST_CHECK_MAX_AGE_MS, hostOf, lastCheckFrom, readLastCheck, scoreHeadline } from "@/lib/free-check/last-check";

const BASE = "https://example.com";
const paths = MARKETING_ROUTES.map((r) => r.path);

describe("moved pages", () => {
  it("redirects the old addresses permanently to live pages", () => {
    const map = Object.fromEntries(PERMANENT_REDIRECTS.map((r) => [r.source, r.destination]));
    expect(map).toMatchObject({
      "/services": "/done-for-you",
      "/tools/ai-mention-checker": "/free-check",
      "/tools/ai-guide-file-maker": "/tools/llms-txt-generator",
      "/tools/faq-markup-maker": "/tools/faq-schema-generator",
    });
    for (const r of PERMANENT_REDIRECTS) {
      expect(paths, r.destination).toContain(r.destination);
      expect(paths, r.source).not.toContain(r.source);
    }
  });

  it("lists the new addresses in the sitemap and llms.txt, and hides the unreleased extension", () => {
    const urls = buildSitemap(BASE).map((e) => e.url);
    for (const p of ["/done-for-you", "/tools/llms-txt-generator", "/tools/faq-schema-generator"]) expect(urls).toContain(`${BASE}${p}`);
    for (const p of ["/services", "/tools/seo-extension", "/tools/ai-mention-checker"]) expect(urls).not.toContain(`${BASE}${p}`);
    const txt = buildLlmsTxt(BASE);
    expect(txt).not.toMatch(/com\/services\)|seo-extension|ai-mention-checker|faq-markup-maker|ai-guide-file-maker/);
    expect((PAGE_SEO as Record<string, { noindex?: boolean }>)["/tools/seo-extension"].noindex).toBe(true);
  });

  it("pairs /done-for-you with the Hindi services page", () => {
    expect(hreflangFor("/done-for-you")).toEqual({ "en-IN": "/done-for-you", "hi-IN": "/hi/services", "x-default": "/done-for-you" });
    expect(hreflangFor("/hi/services")?.["en-IN"]).toBe("/done-for-you");
  });

  it("keeps the stored tool keys, so old usage rows and leads still match", () => {
    expect(TOOL_NAMES).toContain("faq-markup-maker");
    expect(TOOL_NAMES).toContain("ai-guide-file-maker");
    expect(Object.keys(TOOL_LABELS)).toContain("meta-tag-checker");
  });
});

describe("plan copy (owner decision 1)", () => {
  it("Do it myself promises ready-to-paste fixes and AI checks by name, not one-click fixes or answer counts", () => {
    const h = SELF_PLAN.highlights.join(" | ");
    expect(h).toContain(SELF_FIX_LINE);
    expect(h).toContain(aiCheckedLine(SELF_PLAN.id));
    expect(aiCheckedLine(SELF_PLAN.id)).toBe("ChatGPT, Gemini and Perplexity checked every week");
    // "Found Score" is allowed: the free check, the badge and the homepage all use that name for the overall score.
    expect(h).not.toMatch(/one-click|undo|AI answers a month/i);
    expect(MARKETING_PLANS).toHaveLength(1);
    expect(OUR.publishing).not.toMatch(/one-click|undo/i);
    expect(OUR.publishing).toContain(SELF_FIX_LINE);
  });
});

describe("sign-up score from the visitor's own free check", () => {
  const now = 1_800_000_000_000;

  it("saves a real score with the check's own target, and nothing without a score", () => {
    expect(lastCheckFrom("https://www.Acme.example/", 61.4, 14, now)).toEqual({ host: "acme.example", score: 61, target: 75, at: now });
    expect(lastCheckFrom("acme.example", 61, 0, now)?.target).toBeNull();
    expect(lastCheckFrom("acme.example", null, 10, now)).toBeNull();
    expect(lastCheckFrom("not a site", 50, 10, now)).toBeNull();
  });

  it("shows it only for the same website, recently, and never a tampered value", () => {
    const raw = JSON.stringify(lastCheckFrom("acme.example", 61, 14, now));
    expect(readLastCheck(raw, "https://acme.example/", now + 1000)?.score).toBe(61);
    expect(readLastCheck(raw, "other.example", now)).toBeNull();
    expect(readLastCheck(raw, null, now)).toBeNull();
    expect(readLastCheck(raw, "acme.example", now + LAST_CHECK_MAX_AGE_MS + 1)).toBeNull();
    expect(readLastCheck("{bad", "acme.example", now)).toBeNull();
    expect(readLastCheck(JSON.stringify({ host: "acme.example", score: 140, target: null, at: now }), "acme.example", now)).toBeNull();
    expect(readLastCheck(JSON.stringify({ host: "acme.example", score: 61, target: 50, at: now }), "acme.example", now)?.target).toBeNull();
  });

  it("words it plainly", () => {
    expect(scoreHeadline({ host: "a.example", score: 61, target: 75, at: now })).toEqual({ score: "Your score: 61.", goal: "Let's get it to 75." });
    expect(scoreHeadline({ host: "a.example", score: 61, target: null, at: now }).goal).toBe("Let's raise it.");
    expect(hostOf("WWW.Acme.Example/path")).toBe("acme.example");
  });
});
