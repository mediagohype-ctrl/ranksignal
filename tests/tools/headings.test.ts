import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeHeadings, buildOutline, HEADING_LONG_CHARS } from "@/lib/tools/headings";

const URL_ = "https://example.com/";
const page = (body: string) => `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;
const ANSWER = "We charge a fixed fee of 499 rupees for a visit within Pune city limits, and the plumber usually arrives within two hours of your call, seven days a week, including most public holidays.";
const status = (r: ReturnType<typeof analyzeHeadings>, id: string) => r.checks.find((c) => c.id === id)?.status;

describe("buildOutline", () => {
  it("indents by level and flags skipped levels", () => {
    const o = buildOutline([
      { level: 1, text: "Main" },
      { level: 2, text: "Section" },
      { level: 4, text: "Deep" },
      { level: 2, text: "Next" },
      { level: 3, text: "Child" },
    ]);
    expect(o.map((h) => h.depth)).toEqual([0, 1, 2, 1, 2]);
    expect(o.map((h) => h.skippedFrom)).toEqual([null, null, 2, null, null]);
  });

  it("does not treat a page that starts at H2 as a skip", () => {
    expect(buildOutline([{ level: 2, text: "A" }])[0].skippedFrom).toBeNull();
  });
});

describe("analyzeHeadings", () => {
  it("passes a clean outline with answered question headings", () => {
    const r = analyzeHeadings(page(`<h1>Plumbing in Pune</h1><h2>How much does a visit cost?</h2><p>${ANSWER}</p><h3>Payment</h3><p>Cash or UPI.</p>`), URL_);
    expect(r.counts.total).toBe(3);
    expect(r.counts.byLevel[1]).toBe(1);
    expect(r.questionCount).toBe(1);
    expect(r.questionsWithConciseAnswer).toBe(1);
    expect(r.conciseAnswerShare).toBe(1);
    expect(r.summary.fail).toBe(0);
    expect(r.summary.warn).toBe(0);
    expect(r.outline.find((h) => h.level === 2)?.question).toBe(true);
  });

  it("fails a page with no headings at all", () => {
    const r = analyzeHeadings(page("<p>Just text</p>"), URL_);
    expect(status(r, "headings")).toBe("fail");
    expect(status(r, "h1")).toBe("fail");
  });

  it("flags no H1, multiple H1s, skips, empty and long headings", () => {
    expect(status(analyzeHeadings(page("<h2>Only a section</h2>"), URL_), "h1")).toBe("fail");
    const r = analyzeHeadings(
      page(`<h1>One</h1><h1>Two</h1><h2>Sec</h2><h4>Skipped</h4><h3>   </h3><h2>${"Long heading words ".repeat(5)}</h2>`),
      URL_,
    );
    expect(status(r, "h1")).toBe("warn");
    expect(status(r, "skips")).toBe("warn");
    expect(r.skips[0]).toMatchObject({ from: 2, to: 4 });
    expect(r.emptyCount).toBe(1);
    expect(status(r, "empty")).toBe("warn");
    expect(r.longCount).toBe(1);
    expect(r.outline.some((h) => h.long && h.text.length > HEADING_LONG_CHARS)).toBe(true);
    expect(status(r, "long")).toBe("warn");
    for (const c of r.checks.filter((c) => c.status !== "pass")) expect(c.fix).toBeTruthy();
  });

  it("warns when there are no question headings, or questions lack a short answer", () => {
    expect(status(analyzeHeadings(page("<h1>A</h1><h2>Services</h2>"), URL_), "questions")).toBe("warn");
    const r = analyzeHeadings(page("<h1>A</h1><h2>What do you offer?</h2><p>Lots.</p><h2>Why choose us?</h2><p>Because.</p>"), URL_);
    expect(r.questionCount).toBe(2);
    expect(r.questionsWithConciseAnswer).toBe(0);
    expect(status(r, "answers")).toBe("warn");
  });
});

// ------------------------------------------------------------------------------------------------- route
const fetchPublicHtml = vi.fn();
vi.mock("@/lib/tools/fetch-page", () => ({ fetchPublicHtml: (...a: unknown[]) => fetchPublicHtml(...a) }));

describe("POST /api/public/tools/heading-checker", { timeout: 30_000 }, () => {
  beforeEach(() => fetchPublicHtml.mockReset());
  it("returns the outline with no-store", async () => {
    fetchPublicHtml.mockResolvedValue({ url: URL_, finalUrl: URL_, status: 200, html: page("<h1>Hello</h1>"), bytes: 50 });
    const { POST } = await import("@/app/api/public/tools/heading-checker/route");
    const res = await POST(
      new Request("http://localhost/api/public/tools/heading-checker", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": "203.0.113.8" },
        body: JSON.stringify({ url: "example.com" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const data = (await res.json()) as { result: { h1: string[] } };
    expect(data.result.h1).toEqual(["Hello"]);
  });
});
