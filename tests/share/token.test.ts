import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import {
  SHARE_AUDIENCE, isShareActive, mergeShareSettings, newTokenId, readShareSettings, shareUrl, signShareToken, verifyShareToken,
} from "@/lib/share/token";
import { toPublicReport } from "@/lib/share/public-report";
import type { SiteReport } from "@/lib/report/types";

const SECRET = "test-session-secret-0123456789-abcdefghijklmnop";

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

describe("share tokens", () => {
  it("mints random base64url token ids", () => {
    const a = newTokenId();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newTokenId()).not.toBe(a);
  });

  it("verifies a valid token and returns its claims", async () => {
    const tokenId = newTokenId();
    const t = await signShareToken({ projectId: "proj_1", tokenId });
    expect(await verifyShareToken(t)).toEqual({ projectId: "proj_1", tokenId });
    // Stable: same tokenId → same URL.
    expect(await signShareToken({ projectId: "proj_1", tokenId })).toBe(t);
    expect(shareUrl(t, "https://app.example/")).toBe(`https://app.example/r/${t}`);
  });

  it("rejects garbage, tampered tokens and session tokens", async () => {
    expect(await verifyShareToken("")).toBeNull();
    expect(await verifyShareToken("not.a.jwt")).toBeNull();
    const t = await signShareToken({ projectId: "proj_1", tokenId: newTokenId() });
    expect(await verifyShareToken(t.slice(0, -2) + (t.endsWith("A") ? "BB" : "AA"))).toBeNull();
    // A session-style JWT signed with the raw SESSION_SECRET must not verify (different key and no aud).
    const session = await new SignJWT({ org: "o1" }).setProtectedHeader({ alg: "HS256" }).setSubject("u1").sign(new TextEncoder().encode(SECRET));
    expect(await verifyShareToken(session)).toBeNull();
  });

  it("rejects a token with the wrong audience", async () => {
    const { createHmac } = await import("node:crypto");
    const key = new Uint8Array(createHmac("sha256", SECRET).update("report-share-link-key:v1").digest());
    const wrongAud = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuer("ranksignal").setAudience("something-else").setSubject("proj_1").setJti("x").sign(key);
    expect(await verifyShareToken(wrongAud)).toBeNull();
    const rightAud = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuer("ranksignal").setAudience(SHARE_AUDIENCE).setSubject("proj_1").setJti("x").sign(key);
    expect(await verifyShareToken(rightAud)).toEqual({ projectId: "proj_1", tokenId: "x" });
  });

  it("rejects an expired token", async () => {
    const t = await signShareToken({ projectId: "p", tokenId: "x" }, { expiresInDays: -1 });
    expect(await verifyShareToken(t)).toBeNull();
  });

  it("is honoured only while enabled and while jti matches the current tokenId", async () => {
    const tokenId = newTokenId();
    const claims = (await verifyShareToken(await signShareToken({ projectId: "p", tokenId })))!;
    expect(isShareActive({ share: { enabled: true, tokenId } }, claims)).toBe(true);
    // disabled
    expect(isShareActive({ share: { enabled: false, tokenId } }, claims)).toBe(false);
    // rotated
    expect(isShareActive({ share: { enabled: true, tokenId: newTokenId() } }, claims)).toBe(false);
    // never configured / malformed
    expect(isShareActive(null, claims)).toBe(false);
    expect(isShareActive({ share: { enabled: true } }, claims)).toBe(false);
    expect(isShareActive({ share: "yes" }, claims)).toBe(false);
  });
});

describe("share settings", () => {
  it("merge preserves every other settings key", () => {
    const before = { maxPagesPerCrawl: 50, automation: { allowClassB: ["meta_description"] }, schedule: { crawl: "weekly", visibility: "off" } };
    const after = mergeShareSettings(before, { enabled: true, tokenId: "abc" });
    expect(after).toEqual({ ...before, share: { enabled: true, tokenId: "abc" } });
    expect(before).not.toHaveProperty("share"); // input not mutated
  });

  it("merge replaces an existing share block and tolerates null settings", () => {
    expect(mergeShareSettings({ a: 1, share: { enabled: true, tokenId: "old", extra: 1 } }, { enabled: false, tokenId: "old" })).toEqual({
      a: 1,
      share: { enabled: false, tokenId: "old" },
    });
    expect(mergeShareSettings(null, { enabled: true, tokenId: "t" })).toEqual({ share: { enabled: true, tokenId: "t" } });
    expect(mergeShareSettings([1, 2], { enabled: true, tokenId: "t" })).toEqual({ share: { enabled: true, tokenId: "t" } });
  });

  it("reads share settings defensively", () => {
    expect(readShareSettings({ share: { enabled: true, tokenId: "t" } })).toEqual({ enabled: true, tokenId: "t" });
    expect(readShareSettings({ share: { enabled: "true", tokenId: "t" } })).toEqual({ enabled: false, tokenId: "t" });
    expect(readShareSettings({})).toBeNull();
    expect(readShareSettings(undefined)).toBeNull();
  });
});

describe("toPublicReport", () => {
  it("strips evidence, action hooks, run ids and AI answer text", () => {
    const r = {
      projectId: "p",
      brand: "Acme",
      websiteUrl: "https://acme.example",
      generatedAt: "2026-10-28T00:00:00Z",
      crawl: { crawlRunId: "c1", pagesCrawled: 3, finishedAt: "2026-10-28T00:00:00Z" },
      overall: { score: 70, grade: "C", headline: "h" },
      pillars: [],
      issues: [
        {
          id: "i1", pillar: "seo", title: "t", whatsWrong: "w", whyItMatters: "y", howToFix: ["a"], impact: "high", effort: "quick",
          affectedUrls: ["https://acme.example/"], affectedCount: 1, evidence: "secret snippet", relatedActionType: "meta_description",
        },
      ],
      quickWins: ["i1"],
      strengths: [],
      aiVisibility: {
        measured: true, simulated: false, providers: ["x"], sampleSize: 1, mentionRate: 1, citationRate: 0, recommendationRate: 0, visibilityIndex: 50,
        topCompetitors: [], topCitedDomains: [], promptsWhereMissing: [], measuredAt: null,
        brandKnowledge: [{ provider: "x", knowsBrand: true, summary: "raw answer", inaccuracies: ["quote"] }],
      },
      executiveSummary: "s",
      executiveSummarySource: "template",
      limitations: [],
      methodologyVersion: "1",
    } satisfies SiteReport;
    const pub = toPublicReport(r);
    expect(pub.crawl.crawlRunId).toBeNull();
    expect(pub.issues[0]).not.toHaveProperty("evidence");
    expect(pub.issues[0]).not.toHaveProperty("relatedActionType");
    expect(pub.issues[0].howToFix).toEqual(["a"]);
    expect(pub.aiVisibility.brandKnowledge).toEqual([{ provider: "x", knowsBrand: true, summary: "", inaccuracies: [] }]);
  });
});
