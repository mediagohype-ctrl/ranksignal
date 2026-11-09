import { beforeEach, describe, expect, it, vi } from "vitest";

const safeFetch = vi.fn();
vi.mock("@/lib/crawler/safe-fetch", async (orig) => {
  const real = await orig<typeof import("@/lib/crawler/safe-fetch")>();
  return { ...real, safeFetch: (...a: unknown[]) => safeFetch(...a) };
});
const validate = vi.fn();
vi.mock("@/lib/free-check/validate", async (orig) => {
  const real = await orig<typeof import("@/lib/free-check/validate")>();
  return { ...real, validateFreeCheckUrl: (...a: unknown[]) => validate(...a) };
});

import { HttpError } from "@/lib/api";
import { SafeFetchError } from "@/lib/crawler/safe-fetch";
import { fetchPublicHtml, PAGE_MAX_BYTES, PAGE_TIMEOUT_MS } from "@/lib/tools/fetch-page";

const ok = (body: string, type: string | null = "text/html; charset=utf-8", status = 200) => ({
  finalUrl: "https://example.com/final",
  status,
  headers: new Headers(type ? { "content-type": type } : {}),
  body,
  redirectChain: [],
});

async function err(p: Promise<unknown>): Promise<HttpError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    return e as HttpError;
  }
  throw new Error("expected an HttpError");
}

beforeEach(() => {
  safeFetch.mockReset();
  validate.mockReset();
  validate.mockResolvedValue({ ok: true, url: "https://example.com/" });
});

describe("fetchPublicHtml", () => {
  it("fetches with the 2 MB / 10 s caps and returns html, final URL and size", async () => {
    safeFetch.mockResolvedValue(ok("<html><title>Hi ₹</title></html>"));
    const r = await fetchPublicHtml("example.com");
    expect(safeFetch).toHaveBeenCalledWith("https://example.com/", expect.objectContaining({ maxBytes: PAGE_MAX_BYTES, timeoutMs: PAGE_TIMEOUT_MS }));
    expect(PAGE_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(PAGE_TIMEOUT_MS).toBe(10_000);
    expect(r).toMatchObject({ url: "https://example.com/", finalUrl: "https://example.com/final", status: 200 });
    expect(r.bytes).toBe(Buffer.byteLength(r.html, "utf8"));
  });

  it("rejects invalid or private addresses before fetching", async () => {
    validate.mockResolvedValue({ ok: false, code: "blocked_url", message: "That address isn't a public website we can check." });
    const e = await err(fetchPublicHtml("http://127.0.0.1"));
    expect(e.status).toBe(400);
    expect(e.code).toBe("blocked_url");
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["timeout", "fetch_timeout", 422],
    ["too_large", "page_too_large", 422],
    ["too_many_redirects", "too_many_redirects", 422],
    ["network", "fetch_failed", 422],
    ["blocked", "blocked_url", 400],
  ] as const)("maps SafeFetchError %s to a friendly %s", async (code, expected, status) => {
    safeFetch.mockRejectedValue(new SafeFetchError(code, "raw"));
    const e = await err(fetchPublicHtml("example.com"));
    expect(e.code).toBe(expected);
    expect(e.status).toBe(status);
    expect(e.message).not.toBe("raw");
  });

  it("reports HTTP errors with the status code", async () => {
    safeFetch.mockResolvedValue(ok("not found", "text/html", 404));
    const e = await err(fetchPublicHtml("example.com"));
    expect(e.code).toBe("http_error");
    expect(e.message).toContain("404");
  });

  it("rejects non-HTML responses and empty pages", async () => {
    safeFetch.mockResolvedValue(ok('{"a":1}', "application/json"));
    expect((await err(fetchPublicHtml("example.com"))).code).toBe("not_html");
    safeFetch.mockResolvedValue(ok("", "image/png"));
    expect((await err(fetchPublicHtml("example.com"))).code).toBe("not_html");
    safeFetch.mockResolvedValue(ok("   ", "text/html"));
    expect((await err(fetchPublicHtml("example.com"))).code).toBe("empty_page");
  });

  it("accepts HTML served without a content type", async () => {
    safeFetch.mockResolvedValue(ok("<!doctype html><title>x</title>", null));
    expect((await fetchPublicHtml("example.com")).html).toContain("<title>");
  });
});
