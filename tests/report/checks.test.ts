import { describe, expect, it } from "vitest";
import { runAllChecks } from "@/lib/report/checks";
import type { EvaluatedCheck } from "@/lib/report/inputs";
import { ARTICLE, BAD_PAGE, GOOD_HOME, ctx, page, site } from "./fixtures";
import { emptyVisibility } from "@/lib/report/visibility";

const byId = (checks: Record<string, EvaluatedCheck[]>) => Object.fromEntries(Object.values(checks).flat().map((c) => [c.id, c]));

describe("report checks on fixture pages", () => {
  const pages = [page("/", GOOD_HOME), page("/services", BAD_PAGE("/services")), page("/team", BAD_PAGE("/team")), page("/blog/why-pipes-burst", ARTICLE)];
  const c = byId(runAllChecks(ctx(pages)));

  it("SEO: counts real problems with numbers in the detail", () => {
    expect(c["seo.titles"].status).not.toBe("pass");
    expect(c["seo.titles"].facts.duplicate).toBe(2); // two pages titled "Page"
    expect(c["seo.titles"].detail).toContain("2 duplicated");
    expect(c["seo.meta_description"].facts.missing).toBe(2);
    expect(c["seo.h1"].facts.missing).toBe(2);
    expect(c["seo.image_alt"].detail).toBe("4 of 4 images have no alt text, across 2 pages.");
    expect(c["seo.mobile_viewport"].facts.missing).toBe(2);
    expect(c["seo.page_speed_proxy"].detail).toMatch(/^Proxy, not a speed test/);
    expect(c["seo.page_speed_proxy"].facts.blocking).toBe(2);
    expect(c["seo.https"].status).toBe("pass");
    expect(c["seo.sitemap"].status).toBe("pass");
  });

  it("AEO: detects question headings and concise answers", () => {
    expect(c["aeo.direct_answers"].facts.questions).toBeGreaterThanOrEqual(2);
    expect(c["aeo.direct_answers"].facts.answered).toBe(2);
    expect(c["aeo.faq_schema"].status).toBe("pass"); // homepage has FAQPage markup
  });

  it("GEO: robots access, facts, freshness, authors, entity", () => {
    expect(c["geo.ai_search_access"].status).toBe("pass");
    expect(c["geo.llms_txt"].status).toBe("warn");
    expect(c["geo.author_signals"].facts).toMatchObject({ withAuthor: 1, total: 1 });
    expect(c["geo.entity_clarity"].facts).toMatchObject({ hasOrg: true, sameAs: 3 });
    expect(c["geo.entity_clarity"].status).toBe("pass");
    expect(c["geo.ai_mention_rate"].status).toBe("not_measured");
  });

  it("Brand: org schema, trust pages, contact info", () => {
    expect(c["brand.organization_schema"].status).toBe("pass");
    expect(c["brand.about_page"].status).toBe("pass");
    expect(c["brand.privacy_policy"].status).toBe("pass");
    expect(c["brand.contact_info"].facts).toMatchObject({ contactPage: true, phone: true, address: true });
    expect(c["brand.social_profiles"].status).toBe("pass");
    expect(c["brand.name_consistency"].facts.homeTitle).toBe(true);
    expect(c["brand.ai_knowledge"].status).toBe("not_measured");
  });

  it("GEO: distinguishes blocked search bots from training bots", () => {
    const robots = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /\n";
    const r = byId(runAllChecks(ctx(pages, { site: site(robots) })));
    expect(r["geo.ai_search_access"].status).toBe("fail");
    expect(r["geo.ai_search_access"].detail).toContain("PerplexityBot");
    expect(r["geo.ai_search_access"].detail).not.toContain("GPTBot");
    expect(r["geo.ai_training_access"].detail).toContain("GPTBot");
    expect(r["geo.ai_training_access"].detail).toContain("business choice");
  });

  it("uses only real AI observations; simulated data is not scored", () => {
    const sim = { ...emptyVisibility(), measured: true, simulated: true, sampleSize: 10, mentionRate: 0.9 };
    const r = byId(runAllChecks(ctx(pages, { ai: sim })));
    expect(r["geo.ai_mention_rate"].status).toBe("not_measured");
    const real = { ...emptyVisibility(), measured: true, sampleSize: 20, collected: 20, mentionRate: 0.15, citationRate: 0.05, recommendationRate: 0.1, brandShare: 0.2, topCompetitors: [{ name: "PipeCo", share: 0.6 }], providers: ["ChatGPT"] };
    const r2 = byId(runAllChecks(ctx(pages, { ai: real })));
    expect(r2["geo.ai_mention_rate"].detail).toContain("15% of 20 AI answers");
    expect(r2["geo.competitor_share"].detail).toContain("PipeCo");
    expect(r2["geo.competitor_share"].score).toBe(33);
  });

  it("marks v2-only checks not_measured for legacy pages and falls back to findings without site data", () => {
    const legacy = pages.map((p) => ({ ...p, extracted: { ...p.extracted!, extractorVersion: undefined } }));
    const r = byId(runAllChecks(ctx(legacy, { site: null, findings: [{ code: "no_sitemap", severity: "medium", category: "technical", pageUrl: null, message: "x" }] })));
    expect(r["seo.mobile_viewport"].status).toBe("not_measured");
    expect(r["geo.quotable_facts"].status).toBe("not_measured");
    expect(r["seo.sitemap"].status).toBe("fail");
  });

  it("flags error pages and noindex under indexability", () => {
    const r = byId(runAllChecks(ctx([...pages, { ...page("/gone", BAD_PAGE("/gone")), statusCode: 404, extracted: null }])));
    expect(r["seo.indexability"].facts).toMatchObject({ errors: 1, noindex: 0, total: 5 });
  });
});
