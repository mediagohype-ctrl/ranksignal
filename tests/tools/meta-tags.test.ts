import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeMetaTags, descriptionVerdict, titleVerdict, truncate } from "@/lib/tools/meta-tags";
import { DESCRIPTION_MAX, TITLE_MAX, TITLE_MIN } from "@/lib/audit/rules";

const URL_ = "https://example.com/services";
const page = (head: string, body = "<h1>Hi</h1><p>Some text on the page.</p>") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const GOOD_HEAD = `
  <title>Plumber in Pune – 24-hour repairs | Sharma Plumbing</title>
  <meta name="description" content="Leaking tap or burst pipe? Sharma Plumbing fixes it the same day anywhere in Pune. Fixed prices from ₹499, call any time.">
  <link rel="canonical" href="https://example.com/services">
  <meta property="og:title" content="Sharma Plumbing">
  <meta property="og:description" content="Same-day plumbing in Pune">
  <meta property="og:image" content="/share.jpg">
  <meta name="twitter:card" content="summary_large_image">`;

const status = (r: ReturnType<typeof analyzeMetaTags>, id: string) => r.checks.find((c) => c.id === id)?.status;

describe("verdicts", () => {
  it("uses the audit limits", () => {
    expect(titleVerdict(null)).toBe("missing");
    expect(titleVerdict("x".repeat(TITLE_MIN - 1))).toBe("too_short");
    expect(titleVerdict("x".repeat(20))).toBe("short");
    expect(titleVerdict("x".repeat(45))).toBe("good");
    expect(titleVerdict("x".repeat(TITLE_MAX + 1))).toBe("too_long");
    expect(descriptionVerdict(null)).toBe("missing");
    expect(descriptionVerdict("x".repeat(40))).toBe("short");
    expect(descriptionVerdict("x".repeat(120))).toBe("good");
    expect(descriptionVerdict("x".repeat(DESCRIPTION_MAX + 1))).toBe("too_long");
  });

  it("truncates on a word boundary", () => {
    expect(truncate("short", 10)).toBe("short");
    const t = truncate("one two three four five six seven", 20);
    expect(t.length).toBeLessThanOrEqual(20);
    expect(t.endsWith("…")).toBe(true);
  });
});

describe("analyzeMetaTags", () => {
  it("passes a well-tagged page and builds both previews", () => {
    const r = analyzeMetaTags(page(GOOD_HEAD), URL_);
    expect(r.summary.fail).toBe(0);
    expect(r.summary.warn).toBe(0);
    expect(r.title.verdict).toBe("good");
    expect(r.preview.search.displayUrl).toBe("example.com › services");
    expect(r.preview.share.image).toBe("https://example.com/share.jpg");
    expect(r.preview.share.domain).toBe("example.com");
  });

  it("fails a page with no title or description and guesses the snippet from page text", () => {
    const r = analyzeMetaTags(page(""), URL_);
    expect(status(r, "title")).toBe("fail");
    expect(status(r, "description")).toBe("fail");
    expect(r.preview.search.descriptionIsGuess).toBe(true);
    expect(r.preview.search.description).toContain("Some text");
    for (const c of r.checks.filter((c) => c.status !== "pass")) expect(c.fix).toBeTruthy();
  });

  it("flags duplicate title and description tags but ignores SVG titles", () => {
    const head = `${GOOD_HEAD}<title>Second</title><meta name="description" content="Another one">`;
    const r = analyzeMetaTags(page(head, '<svg><title>icon</title></svg><h1>x</h1>'), URL_);
    expect(r.title.count).toBe(2);
    expect(r.description.count).toBe(2);
    expect(status(r, "title-duplicate")).toBe("warn");
    expect(status(r, "description-duplicate")).toBe("warn");
    const single = analyzeMetaTags(page(GOOD_HEAD, "<svg><title>icon</title></svg>"), URL_);
    expect(single.title.count).toBe(1);
  });

  it("fails noindex (robots or googlebot) and warns on nofollow", () => {
    expect(status(analyzeMetaTags(page(`${GOOD_HEAD}<meta name="robots" content="noindex, follow">`), URL_), "robots")).toBe("fail");
    expect(status(analyzeMetaTags(page(`${GOOD_HEAD}<meta name="googlebot" content="noindex">`), URL_), "robots")).toBe("fail");
    const nf = analyzeMetaTags(page(`${GOOD_HEAD}<meta name="robots" content="nofollow">`), URL_);
    expect(status(nf, "robots")).toBe("warn");
    expect(nf.robots.noindex).toBe(false);
  });

  it("warns on a missing, duplicate or foreign canonical", () => {
    const none = GOOD_HEAD.replace(/<link rel="canonical"[^>]*>/, "");
    expect(status(analyzeMetaTags(page(none), URL_), "canonical")).toBe("warn");
    const elsewhere = analyzeMetaTags(page(GOOD_HEAD.replace("/services", "/other")), URL_);
    expect(elsewhere.canonical.pointsElsewhere).toBe(true);
    expect(status(elsewhere, "canonical")).toBe("warn");
    const trailing = analyzeMetaTags(page(GOOD_HEAD.replace('href="https://example.com/services"', 'href="https://example.com/services/"')), URL_);
    expect(trailing.canonical.pointsElsewhere).toBe(false);
    const dup = analyzeMetaTags(page(`${GOOD_HEAD}<link rel="canonical" href="https://example.com/x">`), URL_);
    expect(dup.canonical.count).toBe(2);
    expect(status(dup, "canonical")).toBe("warn");
  });

  it("warns on missing Open Graph and twitter card tags", () => {
    const r = analyzeMetaTags(page("<title>Plumber in Pune – same-day repairs</title>"), URL_);
    expect(status(r, "open-graph")).toBe("warn");
    expect(r.checks.find((c) => c.id === "open-graph")?.detail).toContain("og:image");
    expect(status(r, "twitter")).toBe("warn");
    // Share card falls back to the title.
    expect(r.preview.share.title).toBe("Plumber in Pune – same-day repairs");
  });
});

// ------------------------------------------------------------------------------------------------- route
const fetchPublicHtml = vi.fn();
vi.mock("@/lib/tools/fetch-page", () => ({ fetchPublicHtml: (...a: unknown[]) => fetchPublicHtml(...a) }));

describe("POST /api/public/tools/meta-tag-checker", { timeout: 30_000 }, () => {
  beforeEach(() => fetchPublicHtml.mockReset());
  const req = (body: unknown, ip = "203.0.113.7") =>
    new Request("http://localhost/api/public/tools/meta-tag-checker", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": ip },
      body: JSON.stringify(body),
    });

  it("returns the report with no-store", async () => {
    fetchPublicHtml.mockResolvedValue({ url: "https://example.com/services", finalUrl: URL_, status: 200, html: page(GOOD_HEAD), bytes: 100 });
    const { POST } = await import("@/app/api/public/tools/meta-tag-checker/route");
    const res = await POST(req({ url: "example.com/services" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = (await res.json()) as { result: { title: { verdict: string }; finalUrl: string } };
    expect(data.result.title.verdict).toBe("good");
    expect(data.result.finalUrl).toBe(URL_);
  });

  it("rejects an unusable address without fetching", async () => {
    const { POST } = await import("@/app/api/public/tools/meta-tag-checker/route");
    const res = await POST(req({ url: "javascript:alert(1)" }));
    expect(res.status).toBe(400);
    expect(fetchPublicHtml).not.toHaveBeenCalled();
  });

  it("rate-limits one visitor after 20 checks an hour", async () => {
    fetchPublicHtml.mockResolvedValue({ url: URL_, finalUrl: URL_, status: 200, html: page(GOOD_HEAD), bytes: 100 });
    const { POST } = await import("@/app/api/public/tools/meta-tag-checker/route");
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await POST(req({ url: "example.com" }, "198.51.100.99"))).status;
    expect(last).toBe(429);
  });
});
