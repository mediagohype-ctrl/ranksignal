import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseHtml } from "./dom";
import { collectPage } from "../../extension/lib/extract.js";
import { analyzePage, descriptionCheck, headingOutline, isQuestionHeading, titleCheck } from "../../extension/lib/analyze.js";
import { aiBotRules, isAllowed, parseRobots, patternMatches } from "../../extension/lib/robots.js";
import * as ext from "../../extension/lib/constants.js";
import * as rules from "@/lib/audit/rules";
import * as metaTags from "@/lib/tools/meta-tags";
import { AI_BOTS } from "@/lib/audit/ai-bots";
import { QUESTION_START } from "@/lib/crawler/extract";

const URL_ = "https://www.example.in/services/";
const read = (html: string, url = URL_) => collectPage(parseHtml(html), url);

const GOOD_PAGE = `<!doctype html><html lang="en-IN"><head>
<title>Wedding photographer in Kochi | Anu Studio Photography</title>
<meta name="description" content="Candid wedding photography in Kochi and across Kerala. Packages from ₹45,000, albums in four weeks. Call Anu Studio today.">
<link rel="canonical" href="https://www.example.in/services/">
<meta property="og:title" content="Anu Studio"><meta property="og:description" content="Weddings"><meta property="og:image" content="/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="alternate" hreflang="en-in" href="/services/"><link rel="alternate" hreflang="x-default" href="https://www.example.in/services/">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"LocalBusiness","name":"Anu"},{"@type":"FAQPage"}]}</script>
<style>.a{color:red}</style>
</head><body>
<h1>Wedding photography</h1>
<h2>How much does a wedding shoot cost?</h2><p>${"word ".repeat(320)}</p>
<h2>Do you travel outside Kochi?</h2><h3>Destinations</h3>
<img src="/a.jpg" alt="Bride and groom"><img src="/b.jpg" alt="">
<a href="/contact">Contact</a><a href="https://example.in/about">About</a><a href="https://instagram.com/anu" rel="nofollow">IG</a>
<a href="mailto:a@b.c">Mail</a><a href="#top">Top</a>
<script>var hidden = "these words should not count";</script>
<svg><title>icon</title></svg>
</body></html>`;

describe("extension constants", () => {
  it("match the website's limits and lists", () => {
    expect(ext.TITLE_MIN).toBe(rules.TITLE_MIN);
    expect(ext.TITLE_MAX).toBe(rules.TITLE_MAX);
    expect(ext.DESCRIPTION_MAX).toBe(rules.DESCRIPTION_MAX);
    expect(ext.THIN_WORDS).toBe(rules.THIN_WORDS);
    expect(ext.TITLE_SHORT).toBe(metaTags.TITLE_SHORT);
    expect(ext.DESCRIPTION_SHORT).toBe(metaTags.DESCRIPTION_SHORT);
    expect(ext.QUESTION_START.source).toBe(QUESTION_START.source);
    expect(ext.AI_BOTS).toEqual(AI_BOTS);
  });

  it("builds a free-check link from the page origin only", () => {
    expect(ext.freeCheckUrl("https://shop.example.in/p/1?x=2#y")).toBe(
      "https://mywebrank.tech/free-check?url=https%3A%2F%2Fshop.example.in",
    );
    expect(ext.freeCheckUrl("chrome://settings")).toBe("https://mywebrank.tech/free-check");
    expect(ext.freeCheckUrl("not a url")).toBe("https://mywebrank.tech/free-check");
  });

  it("links only to tool pages that exist on the website", () => {
    for (const t of Object.values(ext.TOOL_LINKS)) {
      const dir = path.join(process.cwd(), "src", "app", "(marketing)", ...t.path.split("/").filter(Boolean));
      expect(() => readFileSync(path.join(dir, "page.tsx"))).not.toThrow();
    }
  });
});

describe("collectPage", () => {
  it("reads the SEO facts of a page", () => {
    const f = read(GOOD_PAGE);
    expect(f.lang).toBe("en-IN");
    expect(f.titles).toEqual(["Wedding photographer in Kochi | Anu Studio Photography"]);
    expect(f.descriptions).toHaveLength(1);
    expect(f.canonicals).toEqual(["https://www.example.in/services/"]);
    expect(f.headings.map((h) => h.level)).toEqual([1, 2, 2, 3]);
    expect(f.images).toEqual({ total: 2, missingAlt: 0, emptyAlt: 1, missingAltExamples: [] });
    expect(f.links).toEqual({ internal: 2, external: 1, nofollow: 1 });
    expect(f.jsonLd).toEqual({ blocks: 1, invalid: 0, types: ["LocalBusiness", "FAQPage"] });
    expect(f.openGraph["og:image"]).toBe("/og.png");
    expect(f.twitter["twitter:card"]).toBe("summary_large_image");
    expect(f.hreflang).toEqual([
      { lang: "en-in", href: "https://www.example.in/services/" },
      { lang: "x-default", href: "https://www.example.in/services/" },
    ]);
  });

  it("counts visible body words only (not scripts, styles, svg titles or the head)", () => {
    const f = read(GOOD_PAGE);
    // headings: 2 + 7 + 5 + 1 = 15, paragraph 320, links: Contact About IG Mail Top = 5
    expect(f.wordCount).toBe(340);
  });

  it("flags images without alt, broken JSON-LD, and duplicate tags", () => {
    const f = read(`<html><head><title>A</title><title>B</title><meta name="description" content="x"><meta name="description" content="y">
      <script type="application/ld+json">{oops</script></head><body><img src="/x.png"><img src="y.png" alt="Y"></body></html>`);
    expect(f.titles).toEqual(["A", "B"]);
    expect(f.descriptions).toEqual(["x", "y"]);
    expect(f.jsonLd.invalid).toBe(1);
    expect(f.images.missingAlt).toBe(1);
    expect(f.images.missingAltExamples).toEqual(["https://www.example.in/x.png"]);
    expect(f.lang).toBeNull();
  });

  it("is self-contained so chrome.scripting can serialise it", () => {
    // executeScript({ func }) sends only the function's source text; a fresh Function must still work.
    const fresh = new Function(`return (${collectPage.toString()})`)() as typeof collectPage;
    expect(fresh(parseHtml(GOOD_PAGE), URL_).titles).toHaveLength(1);
  });
});

describe("analyze", () => {
  it("uses the website's title and description verdicts", () => {
    expect(titleCheck(null).status).toBe("bad");
    expect(titleCheck("Home").status).toBe("warn");
    expect(titleCheck("x".repeat(61)).message).toContain("Google may cut it off (aim for 60 or fewer)");
    expect(titleCheck("x".repeat(45)).status).toBe("good");
    expect(descriptionCheck(null).message).toBe(
      "This page has no Google summary, so Google shows random text from the page instead.",
    );
    expect(descriptionCheck("x".repeat(161)).status).toBe("warn");
    expect(descriptionCheck("x".repeat(120)).status).toBe("good");
  });

  it("marks heading problems in the outline", () => {
    const outline = headingOutline([
      { level: 2, text: "Intro" },
      { level: 4, text: "Deep" },
      { level: 1, text: "Main" },
      { level: 1, text: "" },
    ]);
    expect(outline.map((o) => o.problem)).toEqual([null, "Jumps from H2 to H4", null, "Empty heading"]);
  });

  it("detects question headings like the crawler", () => {
    expect(isQuestionHeading("How do I book?")).toBe(true);
    expect(isQuestionHeading("Pricing")).toBe(false);
  });

  it("reports a healthy page as mostly good", () => {
    const facts = read(GOOD_PAGE);
    const robots = aiBotRules("User-agent: *\nAllow: /\n", 200);
    const r = analyzePage(facts, { robots, llms: { status: 200, contentType: "text/plain", text: "# Anu Studio" } });
    expect(r.summary.bad).toBe(0);
    const byId = Object.fromEntries(r.checks.map((c) => [c.id, c.status]));
    expect(byId).toMatchObject({ title: "good", description: "good", canonical: "good", robots: "good", h1: "good", faq: "good", llms: "good", ai_bots: "good", schema: "good", og: "good" });
  });

  it("warns loudly about noindex, a foreign canonical and blocked AI search bots", () => {
    const facts = read(`<html><head><title>Hi</title><meta name="robots" content="noindex, follow">
      <link rel="canonical" href="https://other.com/"></head><body><h2>What is it?</h2><h2>Why us?</h2></body></html>`);
    const robots = aiBotRules("User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n", 200);
    const r = analyzePage(facts, { robots, llms: { status: 200, contentType: "text/html", text: "<!doctype html>" } });
    const get = (id: string) => r.checks.find((c) => c.id === id)!;
    expect(get("robots").status).toBe("bad");
    expect(get("canonical").status).toBe("bad");
    expect(get("ai_bots").status).toBe("warn");
    expect(get("ai_bots").message).toContain("OAI-SearchBot");
    expect(get("faq").status).toBe("warn");
    expect(get("llms").status).toBe("info"); // an HTML page served at /llms.txt is not a guide file
    expect(get("h1").message).toBe("This page has no main heading.");
    expect(get("words").status).toBe("warn");
  });
});

describe("robots.txt AI rules", () => {
  it("matches wildcards and end anchors", () => {
    expect(patternMatches("/", "/")).toBe(true);
    expect(patternMatches("/*", "/")).toBe(true);
    expect(patternMatches("/$", "/")).toBe(true);
    expect(patternMatches("/admin", "/")).toBe(false);
    expect(patternMatches("*.php$", "/index.php")).toBe(true);
  });

  it("prefers the bot's own group, the longest rule, and Allow on a tie", () => {
    const g = parseRobots("User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: *\nDisallow: /private\nAllow: /\nDisallow: /\n");
    expect(isAllowed(g, "GPTBot")).toBe(false);
    expect(isAllowed(g, "ccbot")).toBe(false);
    expect(isAllowed(g, "PerplexityBot")).toBe(true);
    expect(isAllowed(g, "PerplexityBot", "/private/x")).toBe(false);
  });

  it("treats training-only blocks as a business choice", () => {
    const r = aiBotRules("User-agent: GPTBot\nDisallow: /\n", 200);
    expect(r.bots.find((b) => b.token === "GPTBot")).toMatchObject({ allowed: false, explicit: true });
    const facts = read("<html><body><h1>x</h1></body></html>");
    const check = analyzePage(facts, { robots: r }).checks.find((c) => c.id === "ai_bots")!;
    expect(check.status).toBe("info");
  });

  it("treats a missing robots.txt as no restrictions, and a full block as a problem", () => {
    expect(aiBotRules(null, 404).bots.every((b) => b.allowed)).toBe(true);
    const all = aiBotRules("User-agent: *\nDisallow: /\n", 200);
    expect(all.blocksEveryone).toBe(true);
    const facts = read("<html><body></body></html>");
    expect(analyzePage(facts, { robots: all }).checks.find((c) => c.id === "ai_bots")!.status).toBe("bad");
  });

  it("ignores an empty Disallow", () => {
    expect(aiBotRules("User-agent: *\nDisallow:\n", 200).bots.every((b) => b.allowed)).toBe(true);
  });
});
