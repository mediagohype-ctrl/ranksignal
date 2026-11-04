import { describe, expect, it } from "vitest";
import { extractPage } from "@/lib/crawler/extract";
import { detectJsOnlySite, isShellPage, parseJsSite, renderedShowsJsOnly } from "@/lib/crawler/js-site";
import { applyJsSiteFindings } from "@/lib/crawler/job";
import type { FindingInput } from "@/lib/types";
import { GOOD_HOME, ARTICLE } from "../report/fixtures";

const ORIGIN = "https://catalance.example";
const SHELL = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Catalance</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<script type="module" crossorigin src="/assets/index-a1b2c3.js"></script><link rel="stylesheet" href="/assets/index-a1b2c3.css">
</head><body><noscript>You need to enable JavaScript to run this app.</noscript><div id="root"></div></body></html>`;

const page = (path: string, html: string) => {
  const url = `${ORIGIN}${path}`;
  return { url, finalUrl: url, statusCode: 200, contentType: "text/html", extracted: extractPage(html, url, ["catalance.example"]) };
};


describe("JavaScript-only site detection (heuristic)", () => {
  it("records app-shell signals from the raw HTML", () => {
    const x = page("/", SHELL).extracted;
    expect(x.jsShell).toEqual({ appRoot: "#root", scripts: 1 });
    expect(x.wordCount).toBe(0);
    expect(isShellPage(x)).toBe(true);
  });

  it("does not treat a real page as a shell", () => {
    expect(isShellPage(page("/", GOOD_HOME).extracted)).toBe(false);
    expect(isShellPage(page("/blog", ARTICLE).extracted)).toBe(false);
  });

  it("flags a site whose pages are empty shells with the same headline", () => {
    const pages = ["/", "/about", "/services", "/contact", "/pricing"].map((p) => page(p, SHELL));
    const d = detectJsOnlySite(pages);
    expect(d).toMatchObject({ detected: true, method: "heuristic", shellPages: 5, totalPages: 5, appRoot: "#root", sameTitleShare: 1 });
  });

  it("flags a single-page crawl of a shell (no links to follow)", () => {
    expect(detectJsOnlySite([page("/", SHELL)]).detected).toBe(true);
  });

  it("leaves server-rendered sites alone", () => {
    const pages = [page("/", GOOD_HOME), page("/blog/a", ARTICLE), page("/blog/b", ARTICLE.replace("Why do pipes", "How do pipes"))];
    expect(detectJsOnlySite(pages).detected).toBe(false);
  });

  it("needs most pages to be shells", () => {
    const pages = [page("/", SHELL), page("/a", GOOD_HOME), page("/b", ARTICLE), page("/c", ARTICLE)];
    expect(detectJsOnlySite(pages).detected).toBe(false);
  });

  it("an empty page without scripts is not a JavaScript site", () => {
    const blank = `<html><head><title>Hi</title></head><body><div id="root"></div></body></html>`;
    expect(isShellPage(page("/", blank).extracted)).toBe(false);
  });

  it("works on older crawls without jsShell using the detected platform", () => {
    const x = { ...page("/", SHELL).extracted, jsShell: undefined, platform: "react" as const };
    expect(isShellPage(x)).toBe(true);
  });
});

describe("rendered comparison", () => {
  it("content only after rendering → detected; the browser result beats the heuristic", () => {
    expect(renderedShowsJsOnly({ url: "u", rawWords: 0, renderedWords: 600 })).toBe(true);
    expect(renderedShowsJsOnly({ url: "u", rawWords: 0, renderedWords: 30 })).toBe(false);
    const shells = [page("/", SHELL), page("/a", SHELL)];
    expect(detectJsOnlySite(shells, [{ url: `${ORIGIN}/`, rawWords: 0, renderedWords: 800 }])).toMatchObject({ detected: true, method: "rendered" });
    // Rendered page is empty too (a genuinely blank site) → not a JavaScript problem.
    expect(detectJsOnlySite(shells, [{ url: `${ORIGIN}/`, rawWords: 0, renderedWords: 3 }]).detected).toBe(false);
  });

  it("round-trips through stored JSON", () => {
    const d = detectJsOnlySite([page("/", SHELL)]);
    expect(parseJsSite(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(parseJsSite(null)).toBeNull();
    expect(parseJsSite({ detected: "yes" })).toBeNull();
  });
});

describe("findings on a JavaScript-only site", () => {
  const f = (code: string, pageUrl = `${ORIGIN}/a`): FindingInput => ({ category: "content", code, severity: "medium", confidence: 1, message: code, pageUrl, evidence: {} });
  const findings = [f("missing_h1"), f("missing_h1", `${ORIGIN}/b`), f("duplicate_title"), f("thin_content"), f("no_sitemap"), f("missing_meta_description")];

  it("replaces the per-page symptoms with one finding", () => {
    const d = detectJsOnlySite([page("/", SHELL)]);
    const out = applyJsSiteFindings(findings, d, `${ORIGIN}/`);
    expect(out.map((x) => x.code)).toEqual(["js_only_site", "no_sitemap"]);
    expect(out[0]).toMatchObject({ severity: "critical", pageUrl: `${ORIGIN}/` });
    expect(out[0].message).toMatch(/AI tools can't read your site because it needs JavaScript/);
  });

  it("changes nothing when not detected", () => {
    expect(applyJsSiteFindings(findings, { ...detectJsOnlySite([]), detected: false }, ORIGIN)).toBe(findings);
  });
});
