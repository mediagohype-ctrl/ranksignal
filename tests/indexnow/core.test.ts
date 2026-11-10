import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/jobs/queue", () => ({ enqueue: vi.fn() }));

import {
  buildPayload, changedPages, chunk, classifyResponse, filterUrlsForHost, generateIndexNowKey, isValidKey, keyFileMatches, keyFileUrl, planBatch, siteOf,
} from "@/lib/indexnow-customer/core";
import { checkKeyFile } from "@/lib/indexnow-customer/service";
import { SafeFetchError, type SafeFetchResult } from "@/lib/crawler/safe-fetch";

describe("keys and site", () => {
  it("generates valid keys and key file URLs", () => {
    const k = generateIndexNowKey();
    expect(isValidKey(k)).toBe(true);
    expect(k).not.toBe(generateIndexNowKey());
    expect(siteOf("acme.in/shop")).toEqual({ origin: "https://acme.in", host: "acme.in" });
    expect(siteOf("http://Shop.Acme.in:8080/")).toEqual({ origin: "http://shop.acme.in:8080", host: "shop.acme.in:8080" });
    expect(siteOf("ftp://x")).toBeNull();
    expect(keyFileUrl("https://acme.in", "abc12345")).toBe("https://acme.in/abc12345.txt");
    expect(keyFileMatches("﻿abc12345\n", "abc12345")).toBe(true);
    expect(keyFileMatches("abc12345 extra", "abc12345")).toBe(false);
  });
});

describe("URL handling", () => {
  it("keeps only URLs on exactly the site's host, dedupes and strips fragments", () => {
    expect(
      filterUrlsForHost(["https://acme.in/a#x", "https://acme.in/a", "https://www.acme.in/b", "https://evil.com/c", "javascript:alert(1)", "https://u:p@acme.in/d", "/relative", "http://acme.in/e"], "acme.in"),
    ).toEqual(["https://acme.in/a", "http://acme.in/e"]);
  });
  it("plans batches: skips recently sent URLs and respects the daily cap", () => {
    const p = planBatch({ urls: ["a", "b", "c", "d"], recentlySent: new Set(["b"]), sentToday: 9_998 });
    expect(p).toEqual({ send: ["a", "c"], skippedRecent: ["b"], overCap: ["d"] });
    expect(planBatch({ urls: ["a"], recentlySent: new Set(), sentToday: 20_000 }).send).toEqual([]);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(buildPayload({ host: "acme.in", key: "k", keyLocation: "https://acme.in/k.txt", urls: ["u"] })).toEqual({ host: "acme.in", key: "k", keyLocation: "https://acme.in/k.txt", urlList: ["u"] });
  });
  it("classifies IndexNow responses", () => {
    expect(classifyResponse(200).kind).toBe("accepted");
    expect(classifyResponse(202).kind).toBe("accepted");
    expect(classifyResponse(429).kind).toBe("retry");
    expect(classifyResponse(503).kind).toBe("retry");
    expect(classifyResponse(403).kind).toBe("key_invalid");
    expect(classifyResponse(422).kind).toBe("rejected");
    expect(classifyResponse(400).kind).toBe("rejected");
  });
});

describe("changed pages after a crawl", () => {
  const v = (url: string, fingerprint: string | null, statusCode = 200, contentType = "text/html") => ({ url, fingerprint, statusCode, contentType });
  it("announces new and changed HTML pages only, and nothing on a first crawl", () => {
    const prev = [v("https://a.in/", "f1"), v("https://a.in/b", "f2"), v("https://a.in/gone", "f3"), v("https://a.in/err", "f4", 500)];
    const curr = [v("https://a.in/", "f1"), v("https://a.in/b", "f2-new"), v("https://a.in/new", "f5"), v("https://a.in/err", "f4"), v("https://a.in/404", "x", 404), v("https://a.in/f.pdf", "p", 200, "application/pdf")];
    expect(changedPages(prev, curr)).toEqual(["https://a.in/b", "https://a.in/new", "https://a.in/err"]);
    expect(changedPages(null, curr)).toEqual([]);
    expect(changedPages([], curr)).toEqual([]);
  });
});

describe("key file check (SSRF-safe GET)", () => {
  const res = (o: Partial<SafeFetchResult>): SafeFetchResult => ({ finalUrl: "https://acme.in/k1234567.txt", status: 200, headers: new Headers(), body: "k1234567", redirectChain: [], ...o });
  it("passes when the file holds exactly the key", async () => {
    const fetcher = vi.fn(async () => res({}));
    expect((await checkKeyFile("https://acme.in", "k1234567", fetcher)).ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith("https://acme.in/k1234567.txt", expect.objectContaining({ maxBytes: 65536 }));
  });
  it("explains 404s, wrong content, cross-host redirects and blocked addresses", async () => {
    expect((await checkKeyFile("https://acme.in", "k1234567", async () => res({ status: 404 }))).message).toMatch(/404/);
    expect((await checkKeyFile("https://acme.in", "k1234567", async () => res({ body: "<html>" }))).ok).toBe(false);
    expect((await checkKeyFile("https://acme.in", "k1234567", async () => res({ finalUrl: "https://other.in/k1234567.txt" }))).message).toMatch(/redirects/);
    const blocked = await checkKeyFile("https://acme.in", "k1234567", async () => {
      throw new SafeFetchError("blocked", "private");
    });
    expect(blocked).toMatchObject({ ok: false });
    expect(blocked.message).toMatch(/public address/);
  });
});
