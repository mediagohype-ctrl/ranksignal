// Blog: safe Markdown, content score, sitemap/llms wiring and writer-vs-publisher rules.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { links, parseMarkdown, plainText, safeHref, slugify, wordCount } from "@/lib/content/markdown";
import { scorePost, type PostDraft } from "@/lib/content/score";
import { blogRoutes, buildLlmsTxt, buildSitemap } from "@/lib/free-check/site-seo";
import { hasLivePage, keywordInputSchema, STARTER_KEYWORDS } from "@/lib/seo/keywords";
import { permissionsFor } from "@/lib/admin/rbac";

const mockDb = vi.hoisted(() => ({
  blogPost: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
  auditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));
const indexNow = vi.hoisted(() => ({ submitIndexNow: vi.fn(async () => ({ ok: true, status: 200, submitted: 3, message: "ok" })), indexNowKey: vi.fn(() => "testkey123") }));
vi.mock("@/lib/seo/indexnow", () => indexNow);

import { updatePost } from "@/lib/content/admin";
import type { StaffContext } from "@/lib/admin/guard";

describe("markdown", () => {
  it("parses headings, lists, tables, quotes and inline marks", () => {
    const b = parseMarkdown(
      "# Big\n\n## What is GEO?\n\nIt is **bold** and *em* with [a link](/free-check).\n\n- one\n- two\n\n1. a\n2. b\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> quoted\n\n```\ncode\n```\n\n![A chart of scores](https://x.test/a.png)",
    );
    expect(b.map((x) => x.t)).toEqual(["h2", "h2", "p", "ul", "ol", "table", "quote", "code", "img"]);
    expect(b[1]).toMatchObject({ t: "h2", id: "what-is-geo" });
    expect(links(b)).toEqual(["/free-check"]);
    expect(plainText(b)).toContain("It is bold and em with a link.");
  });

  it("never lets script URLs through", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref("  JaVaScRiPt:alert(1)")).toBe("#");
    expect(safeHref("data:text/html,x")).toBe("#");
    expect(safeHref("//evil.test")).toBe("#");
    expect(safeHref("https://ok.test")).toBe("https://ok.test");
    expect(safeHref("/blog")).toBe("/blog");
    const b = parseMarkdown("[x](javascript:alert(1))");
    expect(links(b)).toEqual(["#"]);
  });

  it("makes unique heading ids and readable slugs", () => {
    const b = parseMarkdown("## Steps\n\n## Steps");
    expect(b.map((x) => (x.t === "h2" ? x.id : ""))).toEqual(["steps", "steps-2"]);
    expect(slugify("What is GEO? (2026 Guide)")).toBe("what-is-geo-2026-guide");
    expect(wordCount("SEO, AEO & GEO — it’s simple.")).toBe(5);
  });
});

const good: PostDraft = {
  title: "What is GEO? Generative engine optimization explained",
  metaTitle: null,
  slug: "what-is-geo",
  description:
    "What is GEO? Generative engine optimization gets your business named in ChatGPT, Gemini and Perplexity answers. A plain guide with 7 steps and examples.",
  answer:
    "GEO (generative engine optimization) is making your brand easy for ChatGPT, Gemini, Perplexity and Google AI Overviews to find, trust and cite, so your business is named and linked inside AI-written answers instead of a competitor. It builds on SEO with clear facts and outside mentions.",
  body: [
    "What is GEO? MyWebRank explains it here. " + "word ".repeat(820),
    "## What is GEO?",
    "In 2023 researchers found 40% gains. See [the paper](https://arxiv.org/abs/2311.09735) and [our check](/free-check) and [services](/services).",
    "## Why does it matter?",
    "- 1 fact\n- 2 facts",
    "## How do you do it?",
    "1. Step one\n2. Step two",
  ].join("\n\n"),
  keyPoints: ["One", "Two", "Three"],
  faqs: [
    { q: "Q1?", a: "A1" },
    { q: "Q2?", a: "A2" },
    { q: "Q3?", a: "A3" },
  ],
  keywords: ["what is geo"],
  authorName: "Priya Sharma",
};

describe("content score", () => {
  it("a complete post scores high on all three pillars", () => {
    const s = scorePost(good);
    expect(s.overall).toBeGreaterThanOrEqual(85);
    expect(s.pillars.seo).toBeGreaterThanOrEqual(80);
    expect(s.pillars.aeo).toBe(100);
    expect(s.pillars.geo).toBe(100);
  });

  it("an empty draft scores low and says why", () => {
    const s = scorePost({ ...good, keywords: [], answer: "", body: "short", faqs: [], keyPoints: [], description: "x" });
    expect(s.overall).toBeLessThan(35);
    expect(s.checks.find((c) => c.id === "keyword")?.state).toBe("fail");
    expect(s.checks.find((c) => c.id === "answer")?.state).toBe("fail");
  });
});

describe("blog in sitemap and llms.txt", () => {
  const posts = [{ slug: "geo-for-shops", title: "GEO for shops", description: "How shops get named by AI.", updatedAt: new Date("2026-11-20T10:00:00Z") }];
  it("published posts are listed with their real dates", () => {
    const sm = buildSitemap("https://x.test", undefined, blogRoutes(posts));
    const e = sm.find((u) => u.url === "https://x.test/blog/geo-for-shops");
    expect(e).toBeDefined();
    expect((e!.lastModified as Date).toISOString().slice(0, 10)).toBe("2026-11-20");
    expect(sm.some((u) => u.url === "https://x.test/blog")).toBe(true);
    const txt = buildLlmsTxt("https://x.test", blogRoutes(posts));
    expect(txt).toContain("## Blog");
    expect(txt).toContain("[GEO for shops](https://x.test/blog/geo-for-shops)");
  });
});

describe("keywords", () => {
  it("starter keywords are valid and unique", () => {
    const parsed = STARTER_KEYWORDS.map((k) => keywordInputSchema.parse(k));
    expect(new Set(parsed.map((k) => k.phrase)).size).toBe(parsed.length);
  });
  it("detects whether a target page is live", () => {
    const live = new Set(["/services", "/blog/a"]);
    expect(hasLivePage("/services/", live)).toBe(true);
    expect(hasLivePage("/blog/a?x=1", live)).toBe(true);
    expect(hasLivePage("/blog/b", live)).toBe(false);
    expect(hasLivePage(null, live)).toBe(false);
  });
});

describe("writer vs publisher", () => {
  const as = (roles: string[]) => {
    const permissions = permissionsFor(roles);
    return { user: { id: "s1", email: "s@x.com", name: "S" }, roles, permissions, can: (p: string) => permissions.has(p as never) } as unknown as StaffContext;
  };
  const req = () => new Request("http://localhost/api/admin/content/p1", { method: "PATCH" });
  beforeEach(() => vi.clearAllMocks());

  it("content writers can send for review but not publish", async () => {
    mockDb.blogPost.findUnique.mockResolvedValue({ id: "p1", status: "draft", slug: "a", publishedAt: null });
    await expect(updatePost(as(["content_writer"]), req(), "p1", { status: "published" })).rejects.toMatchObject({ status: 403 });
    mockDb.blogPost.update.mockResolvedValue({ id: "p1", status: "review", slug: "a" });
    await updatePost(as(["content_writer"]), req(), "p1", { status: "review" });
    expect(mockDb.blogPost.update.mock.calls[0][0].data.status).toBe("review");
  });

  it("content writers cannot edit a live post", async () => {
    mockDb.blogPost.findUnique.mockResolvedValue({ id: "p1", status: "published", slug: "a", publishedAt: new Date() });
    await expect(updatePost(as(["content_writer"]), req(), "p1", { title: "Changed title" })).rejects.toMatchObject({ status: 403 });
    expect(mockDb.blogPost.update).not.toHaveBeenCalled();
  });

  it("the SEO team can publish, and the first publish stamps publishedAt", async () => {
    mockDb.blogPost.findUnique.mockResolvedValue({ id: "p1", status: "review", slug: "a", publishedAt: null });
    mockDb.blogPost.update.mockResolvedValue({ id: "p1", status: "published", slug: "a" });
    await updatePost(as(["seo"]), req(), "p1", { status: "published" });
    const data = mockDb.blogPost.update.mock.calls[0][0].data;
    expect(data.status).toBe("published");
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(mockDb.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "content.post_published" });
    // Publishing tells Bing (IndexNow) about the new post.
    expect(indexNow.submitIndexNow).toHaveBeenCalledWith({ paths: ["/blog/a", "/blog", "/sitemap.xml"] });
  });
});
