// Pure helpers: API key format/hashing, header parsing, cursors, limits and date ranges.
import { describe, expect, it } from "vitest";
import { HttpError } from "@/lib/api";
import { apiKeyFromHeaders, displayPrefix, generateApiKey, hashApiKey, looksLikeApiKey, normalizeKeyName } from "@/lib/api-keys/keys";
import { API_PLAN_LIMITS, apiLimitsFor } from "@/lib/api-keys/limits";
import { PLAN_IDS } from "@/lib/billing/plans";
import { decodeKeysetCursor, decodeOffsetCursor, encodeCursor, parseDateRange, parseEnum, parseLimit } from "@/lib/public-api/params";
import { etagMatches, weakEtag } from "@/lib/public-api/http";

describe("API keys", () => {
  it("generates mwr_ keys with a short display prefix and a SHA-256 hash", () => {
    const g = generateApiKey();
    expect(g.key).toMatch(/^mwr_[A-Za-z0-9_-]{43}$/);
    expect(looksLikeApiKey(g.key)).toBe(true);
    expect(g.prefix).toBe(g.key.slice(0, 12));
    expect(displayPrefix(g.key)).toBe(g.prefix);
    expect(g.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(g.hash).toBe(hashApiKey(g.key));
    expect(g.hash).not.toContain(g.key.slice(4));
    expect(generateApiKey().key).not.toBe(g.key);
  });

  it("rejects malformed keys before any lookup", () => {
    for (const k of ["", "mwr_short", "sk_" + "a".repeat(43), "mwr_" + "a".repeat(42) + "!", "mwr_" + "a".repeat(44)]) expect(looksLikeApiKey(k)).toBe(false);
  });

  it("reads Bearer and X-API-Key headers", () => {
    expect(apiKeyFromHeaders(new Headers({ authorization: "Bearer mwr_abc" }))).toBe("mwr_abc");
    expect(apiKeyFromHeaders(new Headers({ authorization: "bearer   mwr_abc  " }))).toBe("mwr_abc");
    expect(apiKeyFromHeaders(new Headers({ authorization: "Basic xyz" }))).toBeNull();
    expect(apiKeyFromHeaders(new Headers({ "x-api-key": "mwr_x" }))).toBe("mwr_x");
    expect(apiKeyFromHeaders(new Headers())).toBeNull();
  });

  it("normalizes key names", () => {
    expect(normalizeKeyName("  Looker   Studio ")).toBe("Looker Studio");
    expect(normalizeKeyName("")).toBeNull();
    expect(normalizeKeyName("x".repeat(61))).toBeNull();
    expect(normalizeKeyName(42)).toBeNull();
    expect(normalizeKeyName("a\u0000b")).toBe("ab");
  });

  it("has limits for every plan and falls back to trial", () => {
    for (const id of PLAN_IDS) expect(API_PLAN_LIMITS[id].perDay).toBeGreaterThan(0);
    expect(apiLimitsFor("nope")).toEqual(API_PLAN_LIMITS.trial);
    expect(apiLimitsFor("agency").maxKeys).toBeGreaterThan(apiLimitsFor("trial").maxKeys);
  });
});

describe("params", () => {
  it("round-trips keyset and offset cursors", () => {
    const t = new Date("2026-10-01T10:00:00.000Z");
    expect(decodeKeysetCursor(encodeCursor({ t: t.toISOString(), i: "abc" }))).toEqual({ t, i: "abc" });
    expect(decodeOffsetCursor(encodeCursor({ o: 50 }))).toBe(50);
    expect(decodeKeysetCursor(null)).toBeNull();
    expect(decodeOffsetCursor("")).toBe(0);
  });

  it("rejects tampered cursors with 400 invalid_cursor", () => {
    for (const bad of ["%%%", encodeCursor({ o: -1 }), Buffer.from("[1]").toString("base64url"), "x".repeat(600)]) {
      expect(() => decodeOffsetCursor(bad)).toThrow(HttpError);
    }
    expect(() => decodeKeysetCursor(encodeCursor({ t: "nope", i: "a" }))).toThrow(/cursor/);
  });

  it("validates limit and enums strictly", () => {
    expect(parseLimit(null, 50, 100)).toBe(50);
    expect(parseLimit("10", 50, 100)).toBe(10);
    for (const bad of ["0", "101", "1.5", "abc"]) expect(() => parseLimit(bad, 50, 100)).toThrow(HttpError);
    expect(parseEnum("seo", ["seo", "aeo"] as const, "pillar")).toBe("seo");
    expect(parseEnum(null, ["seo"] as const, "pillar")).toBeUndefined();
    expect(() => parseEnum("x", ["seo"] as const, "pillar")).toThrow(/pillar must be one of/);
  });

  it("defaults date ranges to complete days and caps their length", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    expect(parseDateRange(new URLSearchParams(), 28, 366, now)).toEqual({ from: "2026-10-12", to: "2026-11-08" }); // 28 days inclusive
    expect(parseDateRange(new URLSearchParams("from=2026-01-01&to=2026-01-31"), 28, 366, now)).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(() => parseDateRange(new URLSearchParams("from=2026-02-01&to=2026-01-01"), 28, 366, now)).toThrow(HttpError);
    expect(() => parseDateRange(new URLSearchParams("from=2024-01-01&to=2026-01-01"), 28, 366, now)).toThrow(/at most 366/);
    expect(() => parseDateRange(new URLSearchParams("to=2026-02-30"), 28, 366, now)).toThrow(HttpError);
  });
});

describe("ETags", () => {
  it("matches weak and strong forms and lists", () => {
    const e = weakEtag('{"data":1}');
    expect(e).toMatch(/^W\/"/);
    expect(etagMatches(e, e)).toBe(true);
    expect(etagMatches(`"other", ${e.slice(2)}`, e)).toBe(true);
    expect(etagMatches("*", e)).toBe(true);
    expect(etagMatches(null, e)).toBe(false);
    expect(etagMatches('W/"nope"', e)).toBe(false);
  });
});
