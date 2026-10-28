import { describe, expect, it } from "vitest";
import robotsParser from "robots-parser";
import { buildLlmsTxt, buildRobots, buildSitemap, MARKETING_ROUTES, siteBase } from "@/lib/free-check/site-seo";

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
    expect(urls.some((u) => /\/(app|admin|api)(\/|$)/.test(u))).toBe(false);
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
    expect(txt).not.toMatch(/guarantee(d)? (rankings|results)/i);
  });
});
