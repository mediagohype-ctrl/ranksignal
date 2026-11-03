import { describe, expect, it } from "vitest";
import { PLATFORMS, type Platform } from "@/lib/platform/detect";
import { resolveFix, type FixContext, type FixPage } from "@/lib/fix-guides";
import { AI_GUIDES } from "@/lib/fix-guides/guides/ai";
import type { ReportIssue } from "@/lib/report/types";
import type { ExtractedPage } from "@/lib/types";

const IDS = [
  "aeo.content_depth", "aeo.direct_answers", "aeo.faq_schema", "aeo.lists_tables", "aeo.question_headings", "aeo.readability",
  "aeo.structured_data", "geo.ai_search_access", "geo.llms_txt", "geo.quotable_facts", "geo.cited_sources", "geo.freshness",
  "geo.author_signals", "geo.entity_clarity", "geo.ai_mention_rate", "geo.ai_citation_rate", "geo.competitor_share",
  "brand.about_page", "brand.contact_info", "brand.name_consistency", "brand.organization_schema", "brand.privacy_policy",
  "brand.social_profiles", "brand.ai_recommendation", "brand.ai_knowledge",
];

// Jargon the owner must never see in plain text (code the owner types goes in backticks and is allowed).
const JARGON = /\b(AEO|GEO|schema|llms\.txt|robots\.txt)\b/i;
const outsideBackticks = (s: string) => s.replace(/`[^`]*`/g, "");

const extracted = (over: Partial<ExtractedPage> = {}): ExtractedPage => ({
  title: "Boiler repair",
  description: "Fast local plumbers.",
  h1: ["Boiler Repair"],
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
  extractorVersion: 2,
  ...over,
});
const page = (url: string, over: Partial<ExtractedPage> = {}, note: string | null = null): FixPage => ({ url, note, extracted: extracted(over) });

const issue = (id: string, over: Partial<ReportIssue> = {}): ReportIssue => ({
  id,
  pillar: "aeo",
  title: "Problem",
  whatsWrong: "Something is wrong.",
  whyItMatters: "It matters.",
  howToFix: ["Fix it."],
  impact: "medium",
  effort: "moderate",
  affectedUrls: [],
  affectedCount: 2,
  ...over,
});
const ctx = (issueId: string, platform: Platform, pages: FixPage[], over: Partial<ReportIssue> = {}): FixContext => ({
  brand: "Acme Plumbing",
  websiteUrl: "https://acme.example",
  platform,
  issue: issue(issueId, over),
  pages,
});

describe("AI fix guides", () => {
  it("covers every AI, answer and business-info check", () => {
    expect(Object.keys(AI_GUIDES).sort()).toEqual([...IDS].sort());
  });

  for (const id of IDS) {
    describe(id, () => {
      const g = AI_GUIDES[id];

      it("has steps for all 9 platforms, verify steps, time and category", () => {
        expect(g.steps.custom.length).toBeGreaterThan(0);
        for (const p of PLATFORMS) {
          expect(g.steps[p], `${id} → ${p}`).toBeDefined();
          expect(g.steps[p]!.length, `${id} → ${p}`).toBeGreaterThanOrEqual(2);
          expect(g.steps[p]!.length, `${id} → ${p}`).toBeLessThanOrEqual(9);
          for (const s of g.steps[p]!) expect(s.trim().length, `${id} → ${p}`).toBeGreaterThan(0);
        }
        expect(g.verify.length).toBeGreaterThan(0);
        expect(g.time).toBeTruthy();
        expect(g.category).toBeTruthy();
      });

      it("uses plain words outside code", () => {
        const all = [...Object.values(g.steps).flat(), ...g.verify];
        for (const s of all) expect(outsideBackticks(s), s).not.toMatch(JARGON);
      });

      it("has balanced backticks", () => {
        for (const s of [...Object.values(g.steps).flat(), ...g.verify]) expect((s.match(/`/g) ?? []).length % 2, s).toBe(0);
      });

      it("never promises results", () => {
        for (const s of [...Object.values(g.steps).flat(), ...g.verify]) expect(s).not.toMatch(/\b(guaranteed to|we guarantee|will rank|will appear in|will be (named|cited|linked|recommended))\b/i);
      });

      it("resolves for every platform without crashing", () => {
        const pages = [page("https://acme.example/"), page("https://acme.example/services/boiler-repair")];
        for (const p of PLATFORMS) {
          const r = resolveFix(ctx(id.replace(".", "-"), p, pages));
          expect(r.steps.length).toBeGreaterThan(0);
          expect(r.platformSpecific).toBe(true);
          expect(r.prompt).toContain("Acme Plumbing");
          expect(r.steps.join(" ")).not.toContain("<Brand>");
          expect(r.verify.join(" ")).not.toContain("<Brand>");
        }
      });
    });
  }
});

describe("resolveFix with real page data", () => {
  it("question headings: suggests questions per page and gives WordPress heading steps", () => {
    const pages = [
      page("https://acme.example/", { headings: [{ level: 2, text: "Our services" }] }),
      page("https://acme.example/services/boiler-repair", { headings: [] }),
    ];
    const r = resolveFix(ctx("aeo-question_headings", "wordpress", pages));
    expect(r.changes).toHaveLength(2);
    expect(r.changes[0]).toMatchObject({ page: "Home page", now: "1 subheading, none written as a question" });
    expect(r.changes[0].change).toContain("What does Acme Plumbing do?");
    expect(r.changes[1].change).toContain("How much does boiler repair cost?");
    expect(r.steps.join(" ")).toMatch(/Heading/);
    expect(r.category).toBe("content");
  });

  it("direct answers: names the first unanswered question and the counts", () => {
    const pages = [
      page("https://acme.example/faq", { questionHeadings: ["How long does a boiler service take?", "Do you work weekends?"], questionsWithConciseAnswer: 0 }),
    ];
    const r = resolveFix(ctx("aeo-direct_answers", "shopify", pages, { affectedCount: 1 }));
    expect(r.changes[0].now).toBe("2 question headings, 0 with a short answer");
    expect(r.changes[0].change).toContain("How long does a boiler service take?");
    expect(r.steps.some((s) => s.includes("Acme Plumbing"))).toBe(true);
    expect(r.prompt).toContain("SUGGESTED CHANGE PER PAGE");
  });

  it("content depth: real word counts, and a JavaScript hint for empty Next.js pages", () => {
    const pages = [page("https://acme.example/about", { contentWordCount: 140 }), page("https://acme.example/", { wordCount: 0, contentWordCount: 0 })];
    const r = resolveFix(ctx("aeo-content_depth", "nextjs", pages));
    expect(r.changes[0]).toMatchObject({ page: "/about", now: "140 words" });
    expect(r.changes[0].change).toMatch(/^Add about 260 words/);
    expect(r.changes[1].now).toMatch(/No text found/);
    expect(r.steps.join(" ")).toMatch(/JavaScript/);
    expect(r.prompt).toContain("TECHNICAL NOTES");
  });

  it("freshness and readability show the measured values", () => {
    const f = resolveFix(ctx("geo-freshness", "webflow", [page("https://acme.example/blog/old", { dateModified: "2023-02-01T00:00:00Z" })]));
    expect(f.changes[0].now).toBe("Last updated 2023-02-01");
    expect(f.steps.join(" ")).toContain("Updated On");
    const r = resolveFix(ctx("aeo-readability", "custom", [page("https://acme.example/guide", { readingEase: 31.4, sentenceCount: 4, contentWordCount: 120 })]));
    expect(r.changes[0].now).toBe("Reading score 31 of 100 (about 30 words per sentence)");
  });

  it("structured data: flags broken info and suggests a type per page", () => {
    const pages = [
      page("https://acme.example/", { jsonLd: [{ "@invalid": true }], schemaTypes: [] }),
      page("https://acme.example/blog/how-to-bleed-a-radiator"),
    ];
    const r = resolveFix(ctx("aeo-structured_data", "squarespace", pages));
    expect(r.changes[0].now).toMatch(/^Broken/);
    expect(r.changes[1].change).toMatch(/BlogPosting/);
    expect(r.steps.join(" ")).toMatch(/Code Injection/);
  });

  it("AI robot access is honest about Squarespace's single switch", () => {
    const r = resolveFix(ctx("geo-ai_search_access", "squarespace", [], { evidence: "Blocked: PerplexityBot (Perplexity search)" }));
    expect(r.changes[0].now).toContain("PerplexityBot");
    expect(r.steps.join(" ")).toMatch(/Block known artificial intelligence crawlers/);
  });
});
