import { describe, expect, it } from "vitest";
import { runAllChecks } from "@/lib/report/checks";
import { clickDepths, depthChecks } from "@/lib/report/checks/depth";
import { buildIssues } from "@/lib/report/issues";
import type { EvaluatedCheck } from "@/lib/report/inputs";
import type { AuditDepthData, PageSpeedRow } from "@/lib/pagespeed/types";
import { GOOD_HOME, ORIGIN, ctx, page } from "./fixtures";

const byId = (checks: EvaluatedCheck[]) => Object.fromEntries(checks.map((c) => [c.id, c]));
const words = (n: number) => Array.from({ length: n }, (_, i) => (i % 12 === 11 ? "pipes." : "pipes")).join(" ");

const html = (o: { body?: string; head?: string; lang?: string | null; links?: string[] } = {}) => `<!doctype html><html${o.lang === null ? "" : ` lang="${o.lang ?? "en"}"`}><head>
<title>Plumbing in Pune | Acme Plumbing</title><meta name="description" content="Leak repairs and drain cleaning across Pune.">${o.head ?? ""}
</head><body><h1>Plumbing</h1><p>${o.body ?? words(200)}</p>${(o.links ?? []).map((l) => `<a href="${l}">${l}</a>`).join("")}</body></html>`;

function depth(over: Partial<AuditDepthData> = {}): AuditDepthData {
  return { status: "succeeded", finishedAt: "2026-11-10T00:00:00Z", probed: true, probes: [], sitemapNoindex: [], pageSpeed: [], ...over };
}

function psiRow(url: string, o: Partial<PageSpeedRow>): PageSpeedRow {
  return {
    url, strategy: "mobile", isHome: url === `${ORIGIN}/`, status: "ok", performanceScore: 50, fieldScope: null,
    fieldLcpMs: null, fieldInpMs: null, fieldCls: null, labLcpMs: null, labCls: null, labTbtMs: null, labFcpMs: null,
    error: null, fetchedAt: "2026-11-10T00:00:00Z", ...o,
  } as PageSpeedRow;
}

describe("audit depth checks", () => {
  it("skips probe/PSI checks when there is no depth data (older crawls)", () => {
    const ids = depthChecks(ctx([page("/", GOOD_HOME)])).map((c) => c.id);
    for (const id of ["seo.core_web_vitals", "seo.large_images", "seo.redirecting_links", "seo.canonical_target", "seo.sitemap_noindex"]) {
      expect(ids).not.toContain(id);
    }
  });

  it("uses real Core Web Vitals and drops the size estimate when PSI measured the pages", () => {
    const pages = [page("/", GOOD_HOME), page("/services", html())];
    const d = depth({
      pageSpeed: [
        psiRow(`${ORIGIN}/`, { labLcpMs: 1800, labCls: 0.02, labTbtMs: 100 }),
        psiRow(`${ORIGIN}/services`, { labLcpMs: 6200, labCls: 0.4, labTbtMs: 900 }),
      ],
    });
    const seo = runAllChecks(ctx(pages, { depth: d })).seo;
    const ids = seo.map((c) => c.id);
    expect(ids).toContain("seo.core_web_vitals");
    expect(ids).not.toContain("seo.page_speed_proxy");
    const cwv = byId(seo)["seo.core_web_vitals"];
    expect(cwv.facts).toMatchObject({ tested: 2, passing: 1, slow: 1 });
    expect(cwv.affectedUrls).toEqual([`${ORIGIN}/services`]);
    // Without PSI data the estimate is still used.
    expect(runAllChecks(ctx(pages)).seo.map((c) => c.id)).toContain("seo.page_speed_proxy");
  });

  it("flags large images, redirecting links, broken canonical targets and noindex pages in the sitemap", () => {
    const d = depth({
      probes: [
        { kind: "image", url: `${ORIGIN}/big.jpg`, status: 200, finalUrl: `${ORIGIN}/big.jpg`, hops: 0, bytes: 900_000, contentType: "image/jpeg", pages: [`${ORIGIN}/`] },
        { kind: "image", url: `${ORIGIN}/small.jpg`, status: 200, finalUrl: `${ORIGIN}/small.jpg`, hops: 0, bytes: 40_000, contentType: "image/jpeg", pages: [`${ORIGIN}/`] },
        { kind: "link", url: `${ORIGIN}/old`, status: 200, finalUrl: `${ORIGIN}/new`, hops: 1, bytes: null, contentType: "text/html", pages: [`${ORIGIN}/services`] },
        { kind: "canonical", url: `${ORIGIN}/gone`, status: 404, finalUrl: `${ORIGIN}/gone`, hops: 0, bytes: null, contentType: "text/html", pages: [`${ORIGIN}/a`] },
      ],
      sitemapNoindex: [`${ORIGIN}/thank-you`],
    });
    const c = byId(depthChecks(ctx([page("/", GOOD_HOME)], { depth: d })));
    expect(c["seo.large_images"].facts).toMatchObject({ large: 1, total: 2 });
    expect(c["seo.redirecting_links"].affectedUrls).toEqual([`${ORIGIN}/services`]);
    expect(c["seo.canonical_target"].status).not.toBe("pass");
    expect(c["seo.sitemap_noindex"].affectedUrls).toEqual([`${ORIGIN}/thank-you`]);
  });

  it("checks hreflang self-reference and return links", () => {
    const en = page("/", html({ head: `<link rel="alternate" hreflang="en" href="${ORIGIN}/"><link rel="alternate" hreflang="hi" href="${ORIGIN}/hi">` }));
    const hiNoReturn = page("/hi", html({ lang: "hi", head: `<link rel="alternate" hreflang="hi" href="${ORIGIN}/hi">` }));
    const c = byId(depthChecks(ctx([en, hiNoReturn])));
    expect(c["seo.hreflang"].facts).toMatchObject({ noReturn: 1, noSelf: 0, invalid: 0 });
    expect(c["seo.hreflang"].affectedUrls).toEqual([`${ORIGIN}/`]);
  });

  it("flags mixed content, missing lang and vague link text", () => {
    const p = page("/x", html({ lang: null, body: `${words(200)} <img src="http://cdn.acme.example/a.jpg" alt="a"> <a href="/services">click here</a>` }));
    const c = byId(depthChecks(ctx([page("/", GOOD_HOME), p])));
    expect(c["seo.mixed_content"].affectedUrls).toContain(`${ORIGIN}/x`);
    expect(c["seo.lang_attribute"].affectedUrls).toEqual([`${ORIGIN}/x`]);
    expect(c["seo.link_text"].affectedUrls).toContain(`${ORIGIN}/x`);
  });

  it("measures click depth from the homepage", () => {
    const chain = ["/", "/a", "/b", "/c", "/d", "/e"];
    const pages = chain.map((p, i) => page(p, html({ links: chain[i + 1] ? [chain[i + 1]] : [] })));
    expect(clickDepths(pages, `${ORIGIN}/`).size).toBe(6);
    const extra = Array.from({ length: 5 }, (_, i) => page(`/x${i}`, html({ links: ["/"] })));
    const c = byId(depthChecks(ctx([...pages, ...extra])));
    expect(c["seo.click_depth"].facts.deepest).toBe(5);
    expect(c["seo.click_depth"].affectedUrls).toEqual([`${ORIGIN}/d`, `${ORIGIN}/e`]);
  });

  it("every new check has plain-English issue copy", () => {
    const d = depth({
      pageSpeed: [psiRow(`${ORIGIN}/`, { labLcpMs: 6000, labCls: 0.5, labTbtMs: 900 })],
      probes: [{ kind: "image", url: `${ORIGIN}/big.jpg`, status: 200, finalUrl: null, hops: 0, bytes: 900_000, contentType: null, pages: [`${ORIGIN}/`] }],
      sitemapNoindex: [`${ORIGIN}/t`],
    });
    const checks = depthChecks(ctx([page("/", html({ lang: null }))], { depth: d }));
    const issues = buildIssues(checks);
    for (const id of ["seo-core_web_vitals", "seo-large_images", "seo-sitemap_noindex", "seo-lang_attribute"]) {
      const i = issues.find((x) => x.id === id);
      expect(i, id).toBeTruthy();
      expect(i!.howToFix.length).toBeGreaterThan(0);
    }
  });
});
