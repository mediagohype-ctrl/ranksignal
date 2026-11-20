import { describe, expect, it } from "vitest";
import { BENCHMARK_MIN_SAMPLE, benchmarkFrom } from "@/lib/free-check/benchmark";
import { buildSnapshot } from "@/lib/free-check/run";
import type { ExtractedPage } from "@/lib/types";

describe("benchmark: better than N% of websites checked", () => {
  it("is hidden until there are enough earlier checks to be fair", () => {
    expect(benchmarkFrom(70, BENCHMARK_MIN_SAMPLE - 1, 10, 60)).toBeNull();
    expect(benchmarkFrom(null, 500, 10, 60)).toBeNull();
  });

  it("gives the share of earlier checks below this score, never 0% or 100%", () => {
    expect(benchmarkFrom(70, 200, 130, 61.4)).toEqual({ betterThan: 65, average: 61, sample: 200 });
    expect(benchmarkFrom(5, 100, 0, 60)?.betterThan).toBe(1);
    expect(benchmarkFrom(100, 100, 100, 60)?.betterThan).toBe(99);
  });
});

describe("snapshot: what we read from the homepage", () => {
  const home = {
    title: "  Cake shop in Indiranagar ",
    description: null,
    h1: ["Fresh cakes"],
    schemaTypes: ["Organization", "Organization", "WebSite"],
    wordCount: 300,
    contentWordCount: 240,
    images: [{ src: "a.jpg", alt: "cake" }, { src: "b.jpg", alt: "" }, { src: "c.jpg", alt: null }],
  } as unknown as ExtractedPage;
  const site = { https: true, robots: { fetched: true, status: 200, blockedAiCrawlers: [] }, sitemapsFound: [], sitemapUrlCount: 0, llmsTxtFound: false };

  it("shows each AI assistant as blocked only when its live-reading robot is blocked", () => {
    const snap = buildSnapshot("https://x.example/", home, site, [
      { token: "OAI-SearchBot", allowed: false },
      { token: "ChatGPT-User", allowed: true },
      { token: "GPTBot", allowed: false }, // training robot: does not decide ChatGPT answers
      { token: "PerplexityBot", allowed: true },
    ]);
    expect(snap.ai).toEqual([
      { name: "ChatGPT", allowed: false },
      { name: "Gemini", allowed: true },
      { name: "Claude", allowed: true },
      { name: "Perplexity", allowed: true },
    ]);
  });

  it("reads the Google preview and the basics", () => {
    const snap = buildSnapshot("https://x.example/", home, site, []);
    expect(snap.google).toEqual({ title: "Cake shop in Indiranagar", description: null, url: "https://x.example/" });
    expect(snap.facts).toMatchObject({ https: true, robotsTxt: true, sitemap: false, h1: true, homeWords: 240, images: 3, imagesWithoutAlt: 2 });
    expect(snap.facts.schemaTypes).toEqual(["Organization", "WebSite"]);
  });
});
