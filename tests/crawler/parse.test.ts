import { describe, expect, it } from "vitest";
import { isSameSite, normalizeUrl, urlKey } from "@/lib/crawler/normalize";
import { extractPage } from "@/lib/crawler/extract";
import { analyzeRobots } from "@/lib/crawler/robots";
import { parseSitemapXml } from "@/lib/crawler/sitemap";

describe("normalizeUrl", () => {
  it("lowercases host, strips fragment, default port and tracking params, sorts query", () => {
    expect(normalizeUrl("HTTPS://Example.COM:443/Path?b=2&utm_source=x&a=1&gclid=abc&fbclid=z#frag")).toBe(
      "https://example.com/Path?a=1&b=2",
    );
    expect(normalizeUrl("http://example.com:80/")).toBe("http://example.com/");
  });
  it("resolves relative URLs and collapses duplicate slashes", () => {
    expect(normalizeUrl("../a//b", "https://example.com/x/y/")).toBe("https://example.com/x/a/b");
  });
  it("applies trailing slash policy", () => {
    expect(normalizeUrl("https://example.com/blog/", undefined, { trailingSlash: "keep" })).toBe("https://example.com/blog/");
    expect(urlKey("https://example.com/blog/")).toBe("https://example.com/blog");
    expect(urlKey("https://example.com/")).toBe("https://example.com/");
  });
  it("rejects non-http schemes", () => {
    expect(normalizeUrl("mailto:a@b.com")).toBeNull();
    expect(normalizeUrl("javascript:void(0)")).toBeNull();
  });
  it("treats www and apex as the same site", () => {
    expect(isSameSite("https://www.example.com/a", ["example.com"])).toBe(true);
    expect(isSameSite("https://blog.example.com/a", ["example.com"])).toBe(false);
  });
});

const HTML = `<!doctype html><html lang="en"><head>
<title>  How do I choose running shoes?  </title>
<meta name="Description" content="A guide to choosing shoes.">
<meta name="robots" content="index,follow">
<link rel="canonical" href="/guide/">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Acme"},{"@type":["WebPage","FAQPage"]}]}</script>
<script type="application/ld+json">{ not valid json</script>
<style>.x{}</style></head>
<body><h1>Choosing shoes</h1><h3>What size?</h3><p>Some words here about shoes.</p>
<script>var secret = "do not index";</script>
<a href="/a?utm_source=x#top">A</a><a href="https://www.example.com/b">B</a><a href="https://other.com/c">C</a>
<a href="mailto:x@y.z">mail</a><a href="/nf" rel="nofollow">nf</a>
<img src="/i.png"><img src="/j.png" alt=""><img src="/k.png" alt="Shoe">
</body></html>`;

describe("extractPage", () => {
  const x = extractPage(HTML, "https://example.com/guide/", ["example.com"]);
  it("extracts metadata", () => {
    expect(x.title).toBe("How do I choose running shoes?");
    expect(x.description).toBe("A guide to choosing shoes.");
    expect(x.robotsMeta).toBe("index,follow");
    expect(x.canonical).toBe("https://example.com/guide/");
    expect(x.lang).toBe("en");
    expect(x.h1).toEqual(["Choosing shoes"]);
    expect(x.headings.map((h) => h.level)).toEqual([1, 3]);
  });
  it("classifies links", () => {
    expect(x.internalLinks).toEqual(["https://example.com/a", "https://www.example.com/b"]);
    expect(x.externalLinks).toEqual(["https://other.com/c"]);
  });
  it("extracts images and alt state", () => {
    expect(x.images.map((i) => i.alt)).toEqual([null, "", "Shoe"]);
  });
  it("parses JSON-LD safely and collects types", () => {
    expect(x.jsonLd).toHaveLength(2);
    expect(x.schemaTypes).toEqual(["FAQPage", "Organization", "WebPage"]);
    expect(x.hasFaq).toBe(true);
  });
  it("excludes script/style text, caps sample, fingerprints", () => {
    expect(x.textSample).not.toContain("do not index");
    expect(x.textSample).toContain("Some words here");
    expect(x.wordCount).toBeGreaterThan(5);
    expect(x.contentFingerprint).toMatch(/^[a-f0-9]{64}$/);
    const big = extractPage(`<body>${"word ".repeat(2000)}</body>`, "https://example.com/", ["example.com"]);
    expect(big.textSample.length).toBe(2000);
    expect(big.wordCount).toBe(2000);
  });
});

describe("robots", () => {
  const txt = `User-agent: *\nDisallow: /private\nCrawl-delay: 60\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /\n\nSitemap: https://example.com/sm.xml`;
  const r = analyzeRobots("https://example.com/robots.txt", txt);
  it("respects disallow for our UA via *", () => {
    expect(r.isAllowed("https://example.com/private/x")).toBe(false);
    expect(r.isAllowed("https://example.com/public")).toBe(true);
  });
  it("caps crawl delay and lists sitemaps", () => {
    expect(r.crawlDelayMs).toBe(5000);
    expect(r.sitemaps).toEqual(["https://example.com/sm.xml"]);
  });
  it("detects blocked AI crawlers", () => {
    expect(r.blockedAiCrawlers).toEqual(["GPTBot", "PerplexityBot"]);
  });
  it("allows everything when robots is missing", () => {
    expect(analyzeRobots("https://example.com/robots.txt", "", 404).isAllowed("https://example.com/x")).toBe(true);
  });
});

describe("parseSitemapXml", () => {
  it("parses urlsets and indexes", () => {
    const urlset = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/a</loc></url><url><loc> https://example.com/b </loc></url></urlset>`;
    expect(parseSitemapXml(urlset)).toEqual({ kind: "urlset", locs: ["https://example.com/a", "https://example.com/b"] });
    const index = `<sitemapindex><sitemap><loc>https://example.com/s1.xml</loc></sitemap></sitemapindex>`;
    expect(parseSitemapXml(index)).toEqual({ kind: "index", locs: ["https://example.com/s1.xml"] });
  });
});
