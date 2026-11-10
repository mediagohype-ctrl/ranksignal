import { describe, expect, it } from "vitest";
import robotsParser from "robots-parser";
import {
  buildLlmsFullTxt,
  buildLlmsTxt,
  buildRobots,
  buildSitemap,
  MARKETING_ROUTES,
  publicUrls,
  siteBase,
} from "@/lib/free-check/site-seo";
import { ARTICLES, articleToMarkdown } from "@/lib/learn/articles";
import { breadcrumbLd, organizationLd } from "@/lib/seo/schema";

const BASE = "https://ranksignal.onrender.com";

/** Render MetadataRoute.Robots the way Next does, so we can test it with a real robots parser. */
function renderRobots(r: ReturnType<typeof buildRobots>): string {
  const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
  const lines: string[] = [];
  for (const rule of rules) {
    for (const ua of [rule.userAgent ?? "*"].flat()) lines.push(`User-Agent: ${ua}`);
    for (const a of [rule.allow ?? []].flat()) lines.push(`Allow: ${a}`);
    for (const d of [rule.disallow ?? []].flat()) lines.push(`Disallow: ${d}`);
    lines.push("");
  }
  lines.push(`Sitemap: ${r.sitemap}`);
  return lines.join("\n");
}

describe("site SEO builders", () => {
  it("siteBase strips trailing slashes", () => {
    expect(siteBase(`${BASE}///`)).toBe(BASE);
  });

  it("sitemap lists every marketing page incl. free-check and contact, absolute URLs on APP_URL", () => {
    const sm = buildSitemap(BASE, new Date("2026-10-28T00:00:00Z"));
    const urls = sm.map((e) => e.url);
    for (const p of ["/", "/free-check", "/contact", "/pricing", "/features", "/how-it-works", "/docs", "/privacy", "/terms"]) {
      expect(urls).toContain(p === "/" ? `${BASE}/` : `${BASE}${p}`);
    }
    expect(urls.every((u) => u.startsWith(`${BASE}/`))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
    // No app, admin or API endpoints (a docs page like /docs/api is fine).
    expect(urls.some((u) => /^https?:\/\/[^/]+\/(app|admin|api)(\/|$)/.test(u))).toBe(false);
  });

  it("robots allows search + AI crawlers, blocks private areas, links the sitemap", () => {
    const r = buildRobots(BASE);
    expect(r.sitemap).toBe(`${BASE}/sitemap.xml`);
    const robot = robotsParser(`${BASE}/robots.txt`, renderRobots(r));
    for (const ua of ["Googlebot", "GPTBot", "OAI-SearchBot", "PerplexityBot", "ClaudeBot", "Google-Extended", "Bingbot"]) {
      expect(robot.isAllowed(`${BASE}/`, ua), ua).toBe(true);
      expect(robot.isAllowed(`${BASE}/free-check`, ua), ua).toBe(true);
      expect(robot.isAllowed(`${BASE}/apple-icon`, ua), `${ua} apple-icon`).toBe(true);
      expect(robot.isAllowed(`${BASE}/app`, ua), `${ua} /app`).toBe(false);
      expect(robot.isAllowed(`${BASE}/app/projects/1`, ua), ua).toBe(false);
      expect(robot.isAllowed(`${BASE}/admin`, ua), ua).toBe(false);
      expect(robot.isAllowed(`${BASE}/api/public/free-check`, ua), ua).toBe(false);
    }
    expect(robot.getSitemaps()).toEqual([`${BASE}/sitemap.xml`]);
  });

  it("llms.txt follows the llmstxt.org shape with absolute links", () => {
    const txt = buildLlmsTxt(BASE);
    const lines = txt.split("\n");
    expect(lines[0]).toMatch(/^# \S/);
    expect(lines[2]).toMatch(/^> /);
    expect(txt).toContain("## Product");
    expect(txt).toContain("## Optional");
    for (const r of MARKETING_ROUTES) expect(txt).toContain(`](${BASE}${r.path === "/" ? "/" : r.path})`);
    expect(txt).toContain("## Guides");
    expect(txt).toContain(`${BASE}/llms-full.txt`);
    expect(txt).not.toMatch(/guarantee(d)? (rankings|results)/i);
  });

  it("sitemap includes every guide with its real last-modified date (not request time)", () => {
    const sm = buildSitemap(BASE);
    for (const a of ARTICLES) {
      const e = sm.find((x) => x.url === `${BASE}/learn/${a.slug}`);
      expect(e, a.slug).toBeDefined();
      expect((e!.lastModified as Date).toISOString().slice(0, 10)).toBe(a.updated);
    }
    expect(sm.find((x) => x.url === `${BASE}/learn`)).toBeDefined();
  });

  it("llms-full.txt carries the full text of every guide with absolute links", () => {
    const txt = buildLlmsFullTxt(BASE);
    for (const a of ARTICLES) {
      expect(txt).toContain(`# ${a.title}`);
      expect(txt).toContain(a.answer);
    }
    expect(txt).not.toMatch(/\]\(\/[^)]*\)/); // no relative links left
    expect(txt).toContain("| SEO | AEO | GEO |");
  });

  it("publicUrls lists every marketing URL once", () => {
    const urls = publicUrls(BASE);
    expect(urls.length).toBe(MARKETING_ROUTES.length);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("learn articles", () => {
  it("have unique slugs, valid related links, answer-first copy and FAQs", () => {
    const slugs = new Set(ARTICLES.map((a) => a.slug));
    expect(slugs.size).toBe(ARTICLES.length);
    for (const a of ARTICLES) {
      expect(a.slug).toMatch(/^[a-z0-9-]+$/);
      for (const r of a.related) expect(slugs.has(r), `${a.slug} → ${r}`).toBe(true);
      const words = a.answer.split(/\s+/).length;
      expect(words, `${a.slug} answer length`).toBeGreaterThanOrEqual(30);
      expect(words, `${a.slug} answer length`).toBeLessThanOrEqual(80);
      expect(a.faqs.length).toBeGreaterThanOrEqual(3);
      expect(a.description.length, `${a.slug} description`).toBeLessThanOrEqual(260);
      expect(a.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(`${a.title} ${a.answer}`).not.toMatch(/guarantee(d)? (#1|rankings|results)/i);
    }
  });

  it("internal links in articles point at real marketing routes", () => {
    const known = new Set([...MARKETING_ROUTES.map((r) => r.path), "/llms.txt", "/llms-full.txt"]);
    for (const a of ARTICLES) {
      const text = JSON.stringify(a);
      for (const m of text.matchAll(/\]\((\/[^)#]*)/g)) expect(known.has(m[1]), `${a.slug}: ${m[1]}`).toBe(true);
    }
  });

  it("markdown export flattens links to absolute URLs", () => {
    const md = articleToMarkdown(ARTICLES[0], BASE);
    expect(md).toContain(`${BASE}/`);
    expect(md).not.toMatch(/\]\(\/[^)]*\)/);
  });
});

describe("schema builders", () => {
  it("breadcrumbs start at Home with absolute URLs", () => {
    const b = breadcrumbLd([{ name: "Guides", path: "/learn" }], BASE) as { itemListElement: { position: number; item: string }[] };
    expect(b.itemListElement.map((i) => i.item)).toEqual([`${BASE}/`, `${BASE}/learn`]);
    expect(b.itemListElement.map((i) => i.position)).toEqual([1, 2]);
  });

  it("organization has a stable @id and knowsAbout SEO, AEO and GEO", () => {
    const o = organizationLd(BASE) as { "@id": string; knowsAbout: string[] };
    expect(o["@id"]).toBe(`${BASE}/#organization`);
    expect(o.knowsAbout.join(" ")).toMatch(/SEO/);
    expect(o.knowsAbout.join(" ")).toMatch(/AEO/);
    expect(o.knowsAbout.join(" ")).toMatch(/GEO/);
  });
});
