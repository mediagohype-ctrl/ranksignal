import { describe, expect, it } from "vitest";
import { generateSitemap, GENERATOR_MAX_URLS, xmlEscape } from "@/lib/tools/sitemap-generate";
import { checkXmlWellFormed } from "@/lib/tools/sitemap-check";
import { parseSitemapEntries } from "@/lib/crawler/sitemap";

describe("generateSitemap", () => {
  it("builds a valid urlset from one URL per line", () => {
    const g = generateSitemap("https://shop.test/\n\n# comment\nhttps://shop.test/a?x=1&y=2\nhttps://shop.test/b#frag\n", { lastmod: "2026-11-09" });
    expect(g.urls).toEqual(["https://shop.test/", "https://shop.test/a?x=1&y=2", "https://shop.test/b"]);
    expect(g.xml).toContain("<loc>https://shop.test/a?x=1&amp;y=2</loc>");
    expect(g.xml).toContain("<lastmod>2026-11-09</lastmod>");
    expect(checkXmlWellFormed(g.xml!)).toBeNull();
    const parsed = parseSitemapEntries(g.xml!);
    expect(parsed.kind).toBe("urlset");
    expect(parsed.entries[1].loc).toBe("https://shop.test/a?x=1&y=2");
  });

  it("rejects other hosts, bad addresses and drops duplicates", () => {
    const g = generateSitemap("https://a.test/1\nhttps://b.test/2\nnot a url\nftp://a.test/x\nhttps://a.test/1\n");
    expect(g.urls).toEqual(["https://a.test/1"]);
    expect(g.rejected.map((r) => r.line)).toEqual([2, 3, 4]);
    expect(g.rejected[0].reason).toMatch(/Different website/);
    expect(g.duplicates).toBe(1);
  });

  it("caps at 1,000 URLs and returns null XML for empty input", () => {
    const lines = Array.from({ length: GENERATOR_MAX_URLS + 5 }, (_, i) => `https://a.test/p${i}`).join("\n");
    const g = generateSitemap(lines);
    expect(g.urls).toHaveLength(GENERATOR_MAX_URLS);
    expect(g.overLimit).toBe(5);
    expect(generateSitemap("   \n").xml).toBeNull();
  });

  it("escapes all five XML special characters", () => {
    expect(xmlEscape(`&<>'"`)).toBe("&amp;&lt;&gt;&apos;&quot;");
  });
});
