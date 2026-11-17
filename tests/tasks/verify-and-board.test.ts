import { describe, expect, it } from "vitest";
import { canVerifyNow, looksLikeSitemap, recheckSiteFile, sitemapsInRobots } from "@/lib/tasks/recheck";
import { fixMinutes, notSeenDetail, recheckLine, timeLabel } from "@/lib/tasks/todo";
import { boardColumns, defaultPerformer, readEvidence, statusLabel } from "@/lib/tasks/types";
import { isLikelyTestPage, pagePath } from "@/lib/links/suggest";
import type { SafeFetchResult } from "@/lib/crawler/safe-fetch";

const res = (url: string, status: number, body: string, type = "text/plain"): SafeFetchResult =>
  ({ finalUrl: url, status, body, headers: new Headers({ "content-type": type }), redirectChain: [] }) as unknown as SafeFetchResult;

describe("fixMinutes / timeLabel (realistic time per fix)", () => {
  it("uses the kind of fix and the number of pages", () => {
    expect(timeLabel(fixMinutes({ id: "geo-llms_txt", effort: "quick", affectedCount: 1 }))).toBe("About 5 min");
    expect(timeLabel(fixMinutes({ id: "seo-mobile_viewport", effort: "quick", affectedCount: 30 }))).toBe("About 10 min");
    expect(fixMinutes({ id: "seo-titles", effort: "quick", affectedCount: 23 })).toBe(46);
    expect(timeLabel(fixMinutes({ id: "seo-titles", effort: "quick", affectedCount: 23 }))).toBe("About 45 min");
    expect(fixMinutes({ id: "seo-thin_content", effort: "moderate", affectedCount: 100 })).toBe(480);
  });
  it("falls back to the rough effort for other problems", () => {
    expect(fixMinutes({ id: "finding-missing-lang", effort: "moderate" })).toBe(60);
  });
  it("doesn't call everything 'About 15 min'", () => {
    const labels = new Set(["geo-llms_txt", "seo-sitemap", "seo-titles", "seo-meta_description", "brand-about_page"].map((id) => timeLabel(fixMinutes({ id, effort: "quick", affectedCount: 12 }))));
    expect(labels.size).toBeGreaterThanOrEqual(4);
  });
});

describe("recheckLine", () => {
  it("shows the fix's real points when confirmed", () => {
    expect(recheckLine({ url: "u", at: "t", fixed: true }, 5)?.text).toBe("Confirmed live. +5 points");
    expect(recheckLine({ url: "u", at: "t", fixed: true }, 1)?.text).toBe("Confirmed live. +1 point");
    expect(recheckLine({ url: "u", at: "t", fixed: false })?.text).toBe("We couldn't see the change yet.");
    expect(recheckLine({ url: "u", at: "t", fixed: null })?.text).toBe("Marked done — we'll confirm at your next website check.");
    expect(notSeenDetail({ url: "u", at: "t", fixed: false, looked: "We looked for your AI guide file at x." })).toMatch(/^We looked for your AI guide file at x\. A change/);
  });
  it("keeps what we looked for when stored", () => {
    expect(readEvidence({ links: [], recheck: { url: "u", at: "t", fixed: false, looked: "We read /a again." } }).recheck?.looked).toBe("We read /a again.");
  });
});

describe("re-checking a site file after 'I've done it'", () => {
  it("knows which fixes can be confirmed within seconds", () => {
    expect(canVerifyNow("geo-llms_txt")).toBe(true);
    expect(canVerifyNow("seo-titles")).toBe(true);
    expect(canVerifyNow("geo-ai_mention_rate")).toBe(false);
    expect(canVerifyNow("finding-missing-lang")).toBe(false);
  });
  it("says the AI guide file is missing when the site serves an HTML error page", async () => {
    const r = await recheckSiteFile("geo.llms_txt", "https://x.in/", async (u) => res(u, 200, "<!doctype html><p>Not found</p>", "text/html"));
    expect(r).toMatchObject({ url: "https://x.in/llms.txt", fixed: false });
    expect(r.looked).toContain("https://x.in/llms.txt");
  });
  it("confirms a real AI guide file", async () => {
    const r = await recheckSiteFile("geo.llms_txt", "https://x.in/", async (u) => res(u, 200, "# X\n> Bakery"));
    expect(r.fixed).toBe(true);
  });
  it("doesn't count a redirect to another site", async () => {
    const r = await recheckSiteFile("geo.llms_txt", "https://x.in/", async () => res("https://evil.example/llms.txt", 200, "# X"));
    expect(r.fixed).toBe(false);
  });
  it("finds a page list for Google via the robot rules file", async () => {
    const fetcher = async (u: string) =>
      u.endsWith("/sitemap.xml") ? res(u, 404, "") : u.endsWith("/robots.txt") ? res(u, 200, "User-agent: *\nSitemap: https://x.in/sm_index.xml") : res(u, 200, "<sitemapindex></sitemapindex>", "application/xml");
    expect((await recheckSiteFile("seo.sitemap", "https://x.in/", fetcher)).fixed).toBe(true);
    expect(looksLikeSitemap("<?xml?><urlset xmlns=x>")).toBe(true);
    expect(sitemapsInRobots("sitemap: a\nSitemap:b")).toEqual(["a", "b"]);
  });
  it("treats a failed fetch as not seen", async () => {
    const r = await recheckSiteFile("seo.sitemap", "https://x.in/", async () => {
      throw new Error("timeout");
    });
    expect(r.fixed).toBe(false);
  });
});

describe("Task board for Do it myself", () => {
  it("uses owner words and drops the hand-off column", () => {
    expect(boardColumns(true, [])).toEqual(["backlog", "in_progress", "blocked", "done"]);
    expect(boardColumns(true, [{ status: "client_review" }])).toContain("client_review");
    expect(boardColumns(false, [])).toHaveLength(5);
    expect(statusLabel("in_progress", true)).toBe("Doing");
    expect(statusLabel("client_review", false)).toBe("Waiting on you");
    expect(defaultPerformer(true)).toBe("client");
    expect(defaultPerformer(false)).toBe("agency");
  });
});

describe("Internal links: telling pages apart", () => {
  it("shows the address", () => {
    expect(pagePath("https://x.in/about-us")).toBe("/about-us");
    expect(pagePath("https://x.in/")).toBe("/");
  });
  it("flags likely test pages", () => {
    for (const u of ["/fiztest", "/test", "/test-2", "/demo", "/sample-page", "/hello-world", "/blog/lorem-ipsum"]) expect(isLikelyTestPage(`https://x.in${u}`), u).toBe(true);
    for (const u of ["/", "/testimonials", "/latest-news", "/contest-rules", "/demolition-services", "/about"]) expect(isLikelyTestPage(`https://x.in${u}`), u).toBe(false);
    expect(isLikelyTestPage("https://x.in/new", "Lorem ipsum dolor sit amet")).toBe(true);
  });
});
