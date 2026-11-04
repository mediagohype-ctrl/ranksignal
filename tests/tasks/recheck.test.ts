import { describe, expect, it, vi } from "vitest";

// db is mocked: the re-check only reads the last website check's other pages.
const h = vi.hoisted(() => ({ db: { crawlPage: { findMany: vi.fn(async () => []) } } }));
vi.mock("@/lib/db", () => ({ db: h.db }));

import { recheckIssuePage, stillAffected } from "@/lib/tasks/recheck";
import type { SafeFetchResult } from "@/lib/crawler/safe-fetch";

const html = (head: string, body = "<p>Hello there.</p>") => `<!doctype html><html lang="en"><head>${head}</head><body><h1>Shop</h1>${body}</body></html>`;
const fetcher = (body: string, status = 200) =>
  vi.fn(async (url: string): Promise<SafeFetchResult> => ({
    finalUrl: url,
    status,
    headers: new Headers({ "content-type": "text/html" }),
    body,
    redirectChain: [],
  }));

const base = {
  organizationId: "org",
  projectId: "p",
  crawlRunId: "c1",
  websiteUrl: "https://shop.in",
  brandNames: ["Shop"],
  competitors: [],
  url: "https://shop.in/about",
};

describe("stillAffected", () => {
  const checks = [
    { id: "seo.titles", status: "fail" as const, affectedUrls: ["https://shop.in/about/"] },
    { id: "seo.h1", status: "pass" as const, affectedUrls: [] },
    { id: "geo.x", status: "not_measured" as const, affectedUrls: [] },
  ];
  it("tells whether a page is still listed", () => {
    expect(stillAffected(checks, "seo.titles", "https://shop.in/about")).toBe(true);
    expect(stillAffected(checks, "seo.titles", "https://shop.in/other")).toBe(false);
    expect(stillAffected(checks, "seo.h1", "https://shop.in/about")).toBe(false);
    expect(stillAffected(checks, "geo.x", "https://shop.in/about")).toBeNull();
    expect(stillAffected(checks, "missing", "https://shop.in/about")).toBeNull();
  });
});

describe("recheckIssuePage", () => {
  it("sees a fixed Google summary", async () => {
    const f = fetcher(html(`<title>About us | Shop</title><meta name="description" content="Shop sells handmade soaps in Kochi. Learn who we are, where we work and how to order from us today.">`));
    const r = await recheckIssuePage({ ...base, issueId: "seo-meta_description", fetcher: f });
    expect(r.fixed).toBe(true);
    expect(f).toHaveBeenCalledWith("https://shop.in/about", expect.objectContaining({ maxRedirects: 5 }));
  });

  it("can't see a change that isn't there", async () => {
    const r = await recheckIssuePage({ ...base, issueId: "seo-meta_description", fetcher: fetcher(html("<title>About us | Shop</title>")) });
    expect(r.fixed).toBe(false);
  });

  it("never fetches another website, and leaves site-wide problems to the next full check", async () => {
    const f = fetcher(html(""));
    expect((await recheckIssuePage({ ...base, url: "https://evil.example/", issueId: "seo-meta_description", fetcher: f })).fixed).toBeNull();
    expect((await recheckIssuePage({ ...base, issueId: "geo-ai_search_access", fetcher: f })).fixed).toBeNull();
    expect((await recheckIssuePage({ ...base, issueId: "finding-missing-lang", fetcher: f })).fixed).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("reports 'can't see it' when the page doesn't open", async () => {
    const f = vi.fn(async () => {
      throw new Error("timeout");
    });
    expect((await recheckIssuePage({ ...base, issueId: "seo-h1", fetcher: f })).fixed).toBe(false);
  });
});
