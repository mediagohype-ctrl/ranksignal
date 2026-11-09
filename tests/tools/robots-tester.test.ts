import { describe, expect, it } from "vitest";
import { lintRobots, robotsStatusNote, testRobotsPath, toRobotsPath, TESTER_CRAWLERS } from "@/lib/tools/robots-tester";

const FILE = [
  "# Example",
  "User-agent: *",
  "Disallow: /private/",
  "Allow: /private/public-page",
  "Disallow: /*.pdf$",
  "",
  "User-agent: GPTBot",
  "Disallow: /",
  "",
  "User-agent: Googlebot",
  "User-agent: Bingbot",
  "Disallow: /search",
  "Allow: /search/help",
  "",
  "Sitemap: https://example.com/sitemap.xml",
].join("\n");

describe("testRobotsPath (RFC 9309 semantics)", () => {
  it("uses the longest matching rule and reports its line", () => {
    const blocked = testRobotsPath(FILE, "*", "/private/notes")!;
    expect(blocked).toMatchObject({ allowed: false, matchedLine: 3, matchedRule: "Disallow: /private/", group: "*" });
    const allowed = testRobotsPath(FILE, "*", "/private/public-page")!;
    expect(allowed).toMatchObject({ allowed: true, matchedLine: 4 });
  });

  it("Allow wins a tie of equal length", () => {
    const r = testRobotsPath("User-agent: *\nDisallow: /page\nAllow: /page\n", "*", "/page")!;
    expect(r).toMatchObject({ allowed: true, matchedLine: 3 });
  });

  it("supports * and $ wildcards", () => {
    expect(testRobotsPath(FILE, "*", "/files/a.pdf")!.allowed).toBe(false);
    expect(testRobotsPath(FILE, "*", "/files/a.pdf?x=1")!.allowed).toBe(true);
  });

  it("a crawler with its own group ignores the * group (case-insensitive token)", () => {
    expect(testRobotsPath(FILE, "GPTBot", "/")).toMatchObject({ allowed: false, group: "GPTBot", matchedLine: 8 });
    const g = testRobotsPath(FILE, "googlebot", "/private/x")!;
    expect(g).toMatchObject({ allowed: true, group: "googlebot", matchedLine: null });
    expect(testRobotsPath(FILE, "Bingbot", "/search/help/x")).toMatchObject({ allowed: true, matchedLine: 13 });
    expect(testRobotsPath(FILE, "Bingbot", "/search?q=1")).toMatchObject({ allowed: false, matchedLine: 12 });
  });

  it("falls back to * for crawlers without a group, and allows all with no rules", () => {
    expect(testRobotsPath(FILE, "ClaudeBot", "/private/a")).toMatchObject({ allowed: false, group: "*" });
    expect(testRobotsPath("", "ClaudeBot", "/anything")).toMatchObject({ allowed: true, group: null, matchedLine: null });
  });

  it("always allows /robots.txt and accepts full URLs or bare paths", () => {
    expect(testRobotsPath("User-agent: *\nDisallow: /\n", "*", "/robots.txt")!.allowed).toBe(true);
    expect(toRobotsPath("https://site.com/a/b?x=1#h")).toBe("/a/b?x=1");
    expect(toRobotsPath("shop")).toBe("/shop");
    expect(toRobotsPath("")).toBe("/");
    expect(toRobotsPath("a b")).toBeNull();
  });

  it("offers Google, Bing and every AI bot from ai-bots.ts", () => {
    const tokens = TESTER_CRAWLERS.map((c) => c.token);
    for (const t of ["Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "Google-Extended", "PerplexityBot", "ClaudeBot", "CCBot", "Applebot-Extended", "*"]) {
      expect(tokens).toContain(t);
    }
  });
});

describe("lintRobots", () => {
  it("builds groups and lists sitemaps", () => {
    const l = lintRobots(FILE);
    expect(l.groups).toHaveLength(3);
    expect(l.groups[2].agents).toEqual(["Googlebot", "Bingbot"]);
    expect(l.sitemaps).toEqual([{ line: 15, url: "https://example.com/sitemap.xml", valid: true }]);
    expect(l.errors).toBe(0);
    expect(l.blocksEveryone).toBe(false);
  });

  it("flags missing colons, typos, orphan rules, bad sitemaps and unknown directives", () => {
    const l = lintRobots("Disallow: /x\nUser-agent *\nUser-agent: *\nDissallow: /a\nSitemap: /sitemap.xml\nFoo: bar\nNoindex: /b\nCrawl-delay: 5\n");
    const p = (n: number) => l.lines.find((x) => x.n === n)!.problem;
    expect(p(1)?.level).toBe("error"); // rule before any User-agent
    expect(p(2)?.level).toBe("error"); // no colon
    expect(p(4)?.message).toMatch(/Did you mean "Disallow"/);
    expect(p(5)?.level).toBe("error");
    expect(p(6)?.level).toBe("warning");
    expect(p(7)?.message).toMatch(/2019/);
    expect(p(8)?.message).toMatch(/Google ignores Crawl-delay/);
  });

  it("detects a whole-site block and the 500 KiB limit", () => {
    expect(lintRobots("User-agent: *\nDisallow: /\n").blocksEveryone).toBe(true);
    expect(lintRobots("User-agent: *\nDisallow: /\nAllow: /\n").blocksEveryone).toBe(false);
    expect(lintRobots(`User-agent: *\n${"# x\n".repeat(140_000)}`).overGoogleLimit).toBe(true);
  });
});

describe("robotsStatusNote", () => {
  it("explains 404, 5xx and redirects", () => {
    expect(robotsStatusNote(404, 0).body).toMatch(/may read every page/);
    expect(robotsStatusNote(503, 0)).toMatchObject({ tone: "danger" });
    expect(robotsStatusNote(503, 0).body).toMatch(/whole site were blocked/);
    expect(robotsStatusNote(200, 2).title).toMatch(/2 redirects/);
    expect(robotsStatusNote(null, 0).tone).toBe("warning");
  });
});
