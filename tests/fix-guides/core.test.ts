import { describe, expect, it } from "vitest";
import { detectPlatform } from "@/lib/platform/detect";
import { resolveFix, type FixPage } from "@/lib/fix-guides";
import { suggestTitle } from "@/lib/fix-guides/helpers";
import type { ReportIssue } from "@/lib/report/types";
import type { ExtractedPage } from "@/lib/types";

const extracted = (over: Partial<ExtractedPage> = {}): ExtractedPage => ({
  title: "Hire Verified Freelancers in India | Catalance",
  description: null, h1: [], headings: [], canonical: null, robotsMeta: null, lang: "en", internalLinks: [], externalLinks: [],
  images: [], jsonLd: [], schemaTypes: [], wordCount: 0, textSample: "", hasFaq: false, contentFingerprint: "x", ...over,
});
const page = (url: string, over: Partial<ExtractedPage> = {}): FixPage => ({ url, note: "Same Google headline as another page", extracted: extracted(over) });

const issue: ReportIssue = {
  id: "seo-titles", pillar: "seo", title: "34 pages share the same Google headline", whatsWrong: "34 pages share the same title.",
  whyItMatters: "Titles matter.", howToFix: ["Give each page its own title."], impact: "high", effort: "moderate",
  affectedUrls: ["https://catalance.in/", "https://catalance.in/fees-pricing"], affectedCount: 34,
};

describe("detectPlatform", () => {
  it.each([
    ['<script src="/_next/static/chunks/main.js"></script>', "nextjs"],
    ['<link href="/wp-content/themes/x/style.css">', "wordpress"],
    ['<meta name="generator" content="Framer 1a2b">', "framer"],
    ['<img src="https://static.wixstatic.com/media/a.jpg">', "wix"],
    ['<html data-wf-site="123">', "webflow"],
    ['<script src="//cdn.shopify.com/s/files/theme.js"></script>', "shopify"],
    ['<link href="https://static1.squarespace.com/static/x.css">', "squarespace"],
    ['<body><div id="root"></div><script type="module" src="/assets/index-abc123.js"></script></body>', "react"],
  ])("detects %s", (html, want) => {
    expect(detectPlatform(html)).toBe(want);
  });

  it("returns null for plain HTML and reads x-powered-by", () => {
    expect(detectPlatform("<html><body><h1>Hi</h1></body></html>")).toBeNull();
    expect(detectPlatform("<html></html>", { "x-powered-by": "Next.js" })).toBe("nextjs");
  });
});

describe("fix guides", () => {
  it("suggests 'Page topic | Brand' headlines from the address when the page has no heading", () => {
    expect(suggestTitle(page("https://catalance.in/fees-pricing"), "Catalance")).toBe("Fees Pricing | Catalance");
    expect(suggestTitle(page("https://catalance.in/", { h1: ["Hire freelancers"] }), "Catalance")).toBe("Catalance – Hire freelancers");
  });

  it("gives Next.js steps, a page-by-page plan and a coding-assistant prompt", () => {
    const pages = [page("https://catalance.in/"), page("https://catalance.in/fees-pricing")];
    const fix = resolveFix({ brand: "Catalance", websiteUrl: "https://catalance.in/", platform: "nextjs", issue, pages });
    expect(fix.platformSpecific).toBe(true);
    expect(fix.steps.join(" ")).toMatch(/app\/layout\.tsx/);
    expect(fix.steps.join(" ")).not.toContain("<Brand>");
    expect(fix.changes.map((c) => c.change)).toContain("Fees Pricing | Catalance");
    expect(fix.prompt).toMatch(/codebase/);
    expect(fix.prompt).toContain("https://catalance.in/fees-pricing");
    expect(fix.prompt).toMatch(/generateMetadata/);
  });

  it("gives a non-technical prompt for site builders", () => {
    const fix = resolveFix({ brand: "Catalance", websiteUrl: "https://catalance.in/", platform: "wordpress", issue, pages: [page("https://catalance.in/")] });
    expect(fix.steps.join(" ")).toMatch(/Yoast/);
    expect(fix.prompt).toMatch(/I am not technical/);
  });

  it("falls back to the report's own steps for problems without a guide", () => {
    const other = { ...issue, id: "finding-something-new", howToFix: ["Do the thing."] };
    const fix = resolveFix({ brand: "Catalance", websiteUrl: "https://catalance.in/", platform: "wix", issue: other, pages: [] });
    expect(fix.steps).toEqual(["Do the thing."]);
    expect(fix.platformSpecific).toBe(false);
  });
});
