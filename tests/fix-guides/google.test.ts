import { describe, expect, it } from "vitest";
import { resolveFix, type FixContext, type FixPage } from "@/lib/fix-guides";
import { GOOGLE_GUIDES } from "@/lib/fix-guides/guides/google";
import { PLATFORMS } from "@/lib/platform/detect";
import type { ReportIssue } from "@/lib/report/types";
import type { ExtractedPage } from "@/lib/types";

const CHECK_IDS = [
  "seo.meta_description", "seo.h1", "seo.canonical", "seo.indexability", "seo.redirects", "seo.broken_links",
  "seo.internal_links", "seo.image_alt", "seo.thin_content", "seo.duplicate_content", "seo.sitemap", "seo.https",
  "seo.mobile_viewport", "seo.page_speed_proxy", "seo.open_graph",
];

/** Words the owner should never see in plain text. Code (`…`) and exact on-screen labels ("…") are allowed. */
const JARGON = /\bSEO\b|meta description|alt text|schema/i;
const plainText = (s: string) => s.replace(/`[^`]*`/g, "").replace(/"[^"]*"/g, "").replace(/“[^”]*”/g, "");

const extracted = (over: Partial<ExtractedPage> = {}): ExtractedPage => ({
  title: "Plumbing services | Acme",
  description: null,
  h1: ["Emergency plumbing"],
  headings: [],
  canonical: null,
  robotsMeta: null,
  lang: "en",
  internalLinks: [],
  externalLinks: [],
  images: [],
  jsonLd: [],
  schemaTypes: [],
  wordCount: 120,
  textSample: "",
  hasFaq: false,
  contentFingerprint: "x",
  ...over,
});
const page = (url: string, x: Partial<ExtractedPage> = {}, note: string | null = null): FixPage => ({ url, note, extracted: extracted(x) });
const issue = (id: string, over: Partial<ReportIssue> = {}): ReportIssue => ({
  id,
  pillar: "seo",
  title: "Problem",
  whatsWrong: "Something is wrong.",
  whyItMatters: "It matters.",
  howToFix: ["Fix it."],
  impact: "medium",
  effort: "quick",
  affectedUrls: [],
  affectedCount: 2,
  ...over,
});
const ctx = (id: string, pages: FixPage[], over: Partial<FixContext> = {}): FixContext => ({
  brand: "Acme Plumbing",
  websiteUrl: "https://acme.example",
  platform: "nextjs",
  issue: issue(id, { affectedCount: pages.length }),
  pages,
  ...over,
});

describe("Google health fix guides", () => {
  it("covers every Google health check", () => {
    for (const id of CHECK_IDS) expect(GOOGLE_GUIDES[id], id).toBeDefined();
  });

  for (const id of CHECK_IDS) {
    describe(id, () => {
      const g = GOOGLE_GUIDES[id];
      it("has steps for every platform, verify steps and a time", () => {
        expect(g.steps.custom.length).toBeGreaterThan(0);
        for (const p of PLATFORMS) {
          expect(g.steps[p], `${id} ${p}`).toBeDefined();
          expect(g.steps[p]!.length, `${id} ${p}`).toBeGreaterThanOrEqual(3);
          expect(g.steps[p]!.length, `${id} ${p}`).toBeLessThanOrEqual(8);
        }
        expect(g.verify.length).toBeGreaterThan(0);
        expect(g.time).not.toBe("");
      });

      it("uses plain words outside code and on-screen labels", () => {
        const lines = [...Object.values(g.steps).flat(), ...g.verify];
        for (const line of lines) expect(plainText(line), line).not.toMatch(JARGON);
      });

      it("resolves for a fake issue on every platform", () => {
        const pages = [page("https://acme.example/services"), page("https://acme.example/about", { wordCount: 0 })];
        for (const platform of PLATFORMS) {
          const r = resolveFix(ctx(`seo-${id.slice(4)}`, pages, { platform }));
          expect(r.platformSpecific).toBe(true);
          expect(r.steps.join(" ")).not.toContain("<Brand>");
          expect(r.effect.length).toBeGreaterThan(10);
          expect(r.prompt).toContain("acme.example");
        }
      });
    });
  }

  it("Google summaries: suggests text per page and flags missing, copied and long ones", () => {
    const long = "x".repeat(200);
    const pages = [
      page("https://acme.example/", { description: null, h1: ["Acme Plumbing"] }),
      page("https://acme.example/boilers", { description: "Same text", h1: ["Boiler repair"] }),
      page("https://acme.example/drains", { description: "same text", h1: ["Drain cleaning"] }),
      page("https://acme.example/pricing", { description: long, h1: [] }),
    ];
    const r = resolveFix(ctx("seo-meta_description", pages));
    expect(r.changes).toHaveLength(4);
    expect(r.changes[0]).toMatchObject({ page: "Home page", now: "(no Google summary)" });
    expect(r.changes[0].change).toContain("Acme Plumbing");
    expect(r.changes[1].now).toMatch(/^Same as another page/);
    expect(r.changes[1].change).toContain("Boiler repair");
    expect(r.changes[3].now).toMatch(/Too long \(200 characters\)/);
    expect(r.changes[3].change).toContain("Pricing");
    expect(r.prompt).toContain("Boiler repair");
    expect(r.prompt).toContain("TECHNICAL NOTES");
  });

  it("Enough content: tells empty JavaScript pages apart from short pages", () => {
    const pages = [
      page("https://acme.example/services", { wordCount: 120 }),
      page("https://acme.example/about", { wordCount: 0 }),
    ];
    const r = resolveFix(ctx("seo-thin_content", pages));
    expect(r.effect).toMatch(/1 page looks completely empty/);
    expect(r.effect).toMatch(/1 more page has fewer than 300 words/);
    expect(r.changes[0]).toMatchObject({ page: "/about", now: "0 words — looks empty without JavaScript" });
    expect(r.changes[1].now).toBe("120 words");
    expect(r.changes[1].change).toMatch(/Add about 200 words/);
    expect(r.steps.join(" ")).toContain("use client");
    expect(r.steps.join(" ")).toContain("generateStaticParams");

    const react = resolveFix(ctx("seo-thin_content", pages, { platform: "react" }));
    expect(react.steps.join(" ")).toMatch(/vite-react-ssg/);

    const onlyEmpty = resolveFix(ctx("seo-thin_content", [pages[1]]));
    expect(onlyEmpty.effect).toMatch(/0 words/);
    const onlyShort = resolveFix(ctx("seo-thin_content", [pages[0]]));
    expect(onlyShort.effect).not.toMatch(/empty/);
  });

  it("Image descriptions and main version: page-by-page plan with real values", () => {
    const img = resolveFix(ctx("seo-image_alt", [
      page("https://acme.example/team", {
        images: [{ src: "/img/team-photo.jpg", alt: null }, { src: "/img/van.png?w=800", alt: null }, { src: "/logo.svg", alt: "Acme" }],
      }),
    ], { platform: "shopify" }));
    expect(img.effect).toMatch(/^2 images/);
    expect(img.changes[0].now).toBe("2 of 3 images without description: team-photo.jpg, van.png");
    expect(img.steps.join(" ")).toContain("Add alt text");

    const can = resolveFix(ctx("seo-canonical", [
      page("https://acme.example/services#top", { canonical: "https://other.example/services" }),
    ]));
    expect(can.effect).toMatch(/another website/);
    expect(can.changes[0]).toMatchObject({ now: "Points to https://other.example/services", change: "Point to the page's own address: https://acme.example/services" });
  });

  it("Broken links: names the broken address found on each page", () => {
    const r = resolveFix(ctx("seo-broken_links", [
      page("https://acme.example/", { internalLinks: ["https://acme.example/old-prices/", "https://acme.example/services"] }),
    ], { issue: issue("seo-broken_links", { evidence: "Broken: https://acme.example/old-prices", affectedCount: 1 }) }));
    expect(r.changes[0].now).toBe("Links to /old-prices/ (error page)");
  });
});
