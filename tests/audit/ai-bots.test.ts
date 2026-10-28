import { describe, expect, it } from "vitest";
import { analyzeAiBots } from "@/lib/audit/ai-bots";
import { auditSite, type SiteContext } from "@/lib/audit/rules";

describe("analyzeAiBots", () => {
  it("separates search and training bots, explicit vs inherited", () => {
    const r = analyzeAiBots("https://e.test/robots.txt", "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\n", 200);
    const get = (t: string) => r.aiBots.find((b) => b.token === t)!;
    expect(get("GPTBot")).toMatchObject({ allowed: false, explicit: true, purpose: "training" });
    expect(get("OAI-SearchBot")).toMatchObject({ allowed: true, explicit: false, purpose: "search" });
    expect(r.blocksEveryone).toBe(false);
  });
  it("detects a site-wide block and missing robots.txt", () => {
    const all = analyzeAiBots("https://e.test/robots.txt", "User-agent: *\nDisallow: /\n", 200);
    expect(all.blocksEveryone).toBe(true);
    expect(all.aiBots.every((b) => !b.allowed)).toBe(true);
    const none = analyzeAiBots("https://e.test/robots.txt", "", 404);
    expect(none.fetched).toBe(false);
    expect(none.aiBots.every((b) => b.allowed)).toBe(true);
  });
  it("audit uses the richer bot list when present", () => {
    const ai = analyzeAiBots("https://e.test/robots.txt", "User-agent: ChatGPT-User\nDisallow: /\n", 200);
    const site: SiteContext = {
      homepageUrl: "https://e.test/",
      robots: { fetched: true, status: 200, blockedAiCrawlers: [], aiBots: ai.aiBots },
      sitemapsFound: ["x"],
      llmsTxtFound: true,
    };
    const f = auditSite([], site).find((x) => x.code === "ai_crawler_access")!;
    expect(f.severity).toBe("medium");
    expect(f.evidence).toEqual({ blocked: ["ChatGPT-User"] });
  });
});
