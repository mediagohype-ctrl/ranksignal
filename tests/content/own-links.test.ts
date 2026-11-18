import { describe, expect, it } from "vitest";
import { ownSitePath, relativizeOwnLinks } from "@/lib/content/markdown";
import { scorePost } from "@/lib/content/score";

const draft = (body: string) => ({
  title: "How to get found on ChatGPT",
  description: "x",
  slug: "get-found",
  answer: "",
  body,
  keyPoints: [],
  faqs: [],
  keywords: ["chatgpt"],
  authorName: "Team",
});

describe("links to our own site", () => {
  it("treats full mywebrank.tech links as our pages, other sites as outside", () => {
    expect(ownSitePath("/free-check")).toBe("/free-check");
    expect(ownSitePath("https://mywebrank.tech/free-check")).toBe("/free-check");
    expect(ownSitePath("https://www.mywebrank.tech/blog/x?a=1#top")).toBe("/blog/x?a=1#top");
    expect(ownSitePath("https://mywebrank.tech")).toBe("/");
    expect(ownSitePath("https://example.com/free-check")).toBeNull();
    expect(ownSitePath("https://mywebrank.tech.evil.com/x")).toBeNull();
    expect(ownSitePath("//evil.com")).toBeNull();
    expect(ownSitePath("mailto:a@b.c")).toBeNull();
  });

  it("counts them as internal links in the content score, not outside sources", () => {
    const s = scorePost(
      draft("Run the [free check](https://mywebrank.tech/free-check), see [pricing](/pricing) and [Google's guide](https://developers.google.com/search)."),
    );
    expect(s.stats.internalLinks).toBe(2);
    expect(s.stats.externalLinks).toBe(1);
    expect(s.checks.find((c) => c.id === "internal-links")?.state).toBe("pass");
  });

  it("shortens full links to our pages and leaves other links alone", () => {
    const r = relativizeOwnLinks("[a](https://mywebrank.tech/pricing) [b](/tools) [c](https://example.com/x)");
    expect(r).toEqual({ body: "[a](/pricing) [b](/tools) [c](https://example.com/x)", changed: 1 });
  });
});
