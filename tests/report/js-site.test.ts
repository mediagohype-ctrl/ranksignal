import { describe, expect, it } from "vitest";
import { composeReport } from "@/lib/report/compose";
import { JS_SUPPRESSED_DETAIL } from "@/lib/report/checks/js-site";
import { guideFor } from "@/lib/fix-guides";
import { ARTICLE, BAD_PAGE, GOOD_HOME, ctx, page } from "./fixtures";

const SHELL = `<!doctype html><html lang="en"><head><title>Acme</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script type="module" src="/assets/index-a1b2c3.js"></script></head><body><div id="root"></div></body></html>`;

const base = { projectId: "p1", brand: "Acme Plumbing", websiteUrl: "https://acme.example/", generatedAt: new Date("2026-11-04T00:00:00Z") };
const paths = ["/", "/about", "/services", "/contact", "/pricing", "/blog", "/faq"];
const shellPages = paths.map((p) => page(p, SHELL));
const crawl = (n: number) => ({ crawlRunId: "c1", pagesCrawled: n, pagesFound: n, finishedAt: new Date() });
const symptomFindings = paths.flatMap((p) => [
  { code: "missing_h1", severity: "medium", category: "content", pageUrl: `https://acme.example${p}`, message: "No main heading" },
  { code: "duplicate_title", severity: "medium", category: "metadata", pageUrl: `https://acme.example${p}`, message: "Same headline" },
  { code: "heading_level_skip", severity: "low", category: "content", pageUrl: `https://acme.example${p}`, message: "Headings jump" },
]);

describe("JavaScript-only site in the report", () => {
  const r = composeReport({ ...base, crawl: crawl(shellPages.length), ctx: ctx(shellPages, { findings: [...symptomFindings, { code: "js_only_site", severity: "critical", category: "ai_readiness", pageUrl: "https://acme.example/", message: "x" }] }) });

  it("shows ONE top problem with the fix", () => {
    expect(r.issues[0]).toMatchObject({ id: "seo-js_rendering", title: "AI tools can't read your site because it needs JavaScript", impact: "high", affectedCount: paths.length });
    expect(r.issues[0].howToFix.join(" ")).toMatch(/server-side rendering or pre-rendering/);
    expect(r.overall.headline).toMatch(/Biggest fix: AI tools can't read your site because it needs JavaScript/);
    expect(r.issues.filter((i) => /javascript/i.test(i.title))).toHaveLength(1);
  });

  it("suppresses the symptom problems from the list and the score", () => {
    const ids = r.issues.map((i) => i.id);
    for (const id of ["seo-h1", "seo-titles", "seo-meta_description", "seo-thin_content", "aeo-question_headings", "finding-heading-level-skip", "finding-js-only-site"]) {
      expect(ids).not.toContain(id);
    }
    const seo = r.pillars.find((p) => p.pillar === "seo")!;
    for (const id of ["seo.h1", "seo.titles", "seo.meta_description", "seo.thin_content"]) {
      const c = seo.checks.find((x) => x.id === id)!;
      expect(c.status).toBe("not_measured");
      expect(c.detail).toBe(JS_SUPPRESSED_DETAIL);
    }
    expect(seo.checks[0]).toMatchObject({ id: "seo.js_rendering", status: "fail" });
    expect(seo.score!).toBeLessThan(60); // the one big problem still weighs on the score
  });

  it("has a fix guide with steps for Next.js and React", () => {
    const g = guideFor("seo-js_rendering");
    expect(g).not.toBeNull();
    expect(g!.steps.nextjs!.join(" ")).toMatch(/use client/);
    expect(g!.steps.react!.join(" ")).toMatch(/react-snap|vite/);
  });

  it("uses the stored browser comparison when there is one", () => {
    const notJs = composeReport({
      ...base,
      crawl: crawl(shellPages.length),
      ctx: ctx(shellPages, { jsSite: { detected: false, method: "rendered", shellPages: 7, totalPages: 7, appRoot: "#root", sameTitleShare: 1, examples: [], rendered: [] } }),
    });
    expect(notJs.issues.some((i) => i.id === "seo-js_rendering")).toBe(false);
  });

  it("leaves normal sites unchanged", () => {
    const pages = [page("/", GOOD_HOME), page("/services", BAD_PAGE("/services")), page("/blog/why-pipes-burst", ARTICLE)];
    const n = composeReport({ ...base, crawl: crawl(3), ctx: ctx(pages) });
    expect(n.issues.some((i) => i.id === "seo-js_rendering")).toBe(false);
    expect(n.pillars.flatMap((p) => p.checks).some((c) => c.detail === JS_SUPPRESSED_DETAIL)).toBe(false);
  });
});
