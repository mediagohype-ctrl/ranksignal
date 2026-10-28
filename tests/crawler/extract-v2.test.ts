import { describe, expect, it } from "vitest";
import { countSyllables, extractPage, fleschReadingEase, isAuthoritativeUrl, isQuestionHeading, isStatSentence } from "@/lib/crawler/extract";
import { crawlPriority } from "@/lib/audit/page-kind";
import { clampMaxPages, DEFAULT_MAX_PAGES } from "@/lib/crawler/crawl";
import { GOOD_HOME, ARTICLE } from "../report/fixtures";

describe("extractPage v2 signals", () => {
  const x = extractPage(GOOD_HOME, "https://acme.example/", ["acme.example"], { brandNames: ["Acme Plumbing"] });
  it("finds question headings and concise answers", () => {
    expect(x.questionHeadings).toEqual(["How fast can a plumber reach me?", "What does a boiler service cost?"]);
    expect(x.questionsWithConciseAnswer).toBe(2);
    expect(x.listCount).toBe(1);
  });
  it("reads organization schema, OG, dates, links and contacts", () => {
    expect(x.organization).toMatchObject({ name: "Acme Plumbing", logo: "https://acme.example/logo.png", hasAddress: true, telephone: "+91 20 1234 5678" });
    expect(x.organization!.sameAs).toHaveLength(3);
    expect(x.openGraph).toMatchObject({ title: "Acme Plumbing", image: "https://acme.example/og.png" });
    expect(x.dateModified).toBe("2026-09-01T00:00:00.000Z");
    expect(x.pageLinks).toMatchObject({ about: "https://acme.example/about", contact: "https://acme.example/contact", privacy: "https://acme.example/privacy-policy" });
    expect(x.navLinks).toContain("https://acme.example/services");
    expect(x.socialLinks!.length).toBe(2);
    expect(x.citationLinks).toEqual(["https://www.who.int/water"]);
    expect(x.hasPhoneLink).toBe(true);
    expect(x.hasEmailLink).toBe(true);
    expect(x.viewport).toContain("device-width");
    expect(x.statSentenceCount).toBeGreaterThanOrEqual(3);
    expect(x.brandMentions).toMatchObject({ inTitle: true, inH1: true });
    expect(x.brandMentions!.bodyCount).toBe(2); // h1 + first paragraph ("an Acme plumber" is not the full name)
  });
  it("reads authors and published dates from articles", () => {
    const a = extractPage(ARTICLE, "https://acme.example/blog/why-pipes-burst", ["acme.example"]);
    expect(a.author).toBe("Priya Shah");
    expect(a.authorSignals).toEqual(expect.arrayContaining(["jsonld", "byline"]));
    expect(a.datePublished).toBe("2024-01-05T00:00:00.000Z");
    expect(a.brandMentions).toBeUndefined();
  });
  it("counts render-blocking head scripts only", () => {
    const h = extractPage(`<html><head><script src="/a.js"></script><script src="/b.js" defer></script><script type="module" src="/c.js"></script></head><body></body></html>`, "https://x.test/", ["x.test"]);
    expect(h.renderBlockingScripts).toBe(1);
  });
});

describe("text helpers", () => {
  it("question headings", () => {
    expect(isQuestionHeading("How do I reset my boiler")).toBe(true);
    expect(isQuestionHeading("Pricing?")).toBe(true);
    expect(isQuestionHeading("Our services")).toBe(false);
  });
  it("stat sentences and authority", () => {
    expect(isStatSentence("We have served 1,200 customers across the region.")).toBe(true);
    expect(isStatSentence("We love helping people with their homes.")).toBe(false);
    expect(isAuthoritativeUrl("https://www.cdc.gov/x")).toBe(true);
    expect(isAuthoritativeUrl("https://iitb.ac.in/x")).toBe(true);
    expect(isAuthoritativeUrl("https://randomblog.com/x")).toBe(false);
  });
  it("flesch", () => {
    expect(countSyllables("water")).toBe(2);
    const easy = Array.from({ length: 30 }, () => "The cat sat on the mat.");
    expect(fleschReadingEase(easy)!).toBeGreaterThan(90);
    expect(fleschReadingEase(["Too short."])).toBeNull();
  });
});

describe("crawl prioritisation and limits", () => {
  it("orders home, key pages, nav, then deep pages", () => {
    const nav = new Set(["https://a.test/our-approach"]);
    const urls = ["https://a.test/blog/2020/01/post", "https://a.test/our-approach", "https://a.test/pricing", "https://a.test/", "https://a.test/x?page=2"];
    expect([...urls].sort((a, b) => crawlPriority(a, nav) - crawlPriority(b, nav))).toEqual([
      "https://a.test/", "https://a.test/pricing", "https://a.test/our-approach", "https://a.test/x?page=2", "https://a.test/blog/2020/01/post",
    ]);
  });
  it("defaults to 25 pages and respects plan caps", () => {
    expect(DEFAULT_MAX_PAGES).toBe(25);
    expect(clampMaxPages(undefined, 250)).toBe(25);
    expect(clampMaxPages(undefined, 10)).toBe(10);
    expect(clampMaxPages(400, 250)).toBe(250);
  });
});
