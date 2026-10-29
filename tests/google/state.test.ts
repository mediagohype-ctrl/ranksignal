import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { createHmac } from "node:crypto";
import { STATE_AUDIENCE, signOAuthState, verifyOAuthState } from "@/lib/google/state";

const SECRET = "s".repeat(40);
const base = { projectId: "p1", orgId: "o1", userId: "u1", product: "gsc" as const };

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("OAuth state", () => {
  it("round-trips the signed payload with a random nonce", async () => {
    const a = await signOAuthState(base);
    const b = await signOAuthState(base);
    expect(a.nonce).not.toBe(b.nonce);
    const v = await verifyOAuthState(a.token);
    expect(v).toEqual({ ...base, nonce: a.nonce });
  });

  it("rejects tampered, garbage and missing tokens", async () => {
    const { token } = await signOAuthState(base);
    const [h, p, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p!, "base64url").toString()), org: "other" })).toString("base64url");
    expect(await verifyOAuthState(`${h}.${forged}.${sig}`)).toBeNull();
    expect(await verifyOAuthState("nope")).toBeNull();
    expect(await verifyOAuthState(null)).toBeNull();
  });

  it("rejects a token signed with a different SESSION_SECRET", async () => {
    const { token } = await signOAuthState(base);
    vi.stubEnv("SESSION_SECRET", "x".repeat(40));
    expect(await verifyOAuthState(token)).toBeNull();
  });

  it("rejects the right key with the wrong audience (e.g. a session-style token)", async () => {
    const key = new Uint8Array(createHmac("sha256", SECRET).update("google-oauth-state:v1").digest());
    const wrongAud = await new SignJWT({ pid: "p1", org: "o1", prd: "gsc", nonce: "n" })
      .setProtectedHeader({ alg: "HS256" }).setSubject("u1").setAudience("share-link").setExpirationTime("5m").sign(key);
    expect(await verifyOAuthState(wrongAud)).toBeNull();
    const ok = await new SignJWT({ pid: "p1", org: "o1", prd: "gsc", nonce: "n" })
      .setProtectedHeader({ alg: "HS256" }).setSubject("u1").setAudience(STATE_AUDIENCE).setExpirationTime("5m").sign(key);
    expect(await verifyOAuthState(ok)).not.toBeNull();
    // Raw SESSION_SECRET (the session cookie key) must not verify state tokens.
    const sessionKeyed = await new SignJWT({ pid: "p1", org: "o1", prd: "gsc", nonce: "n" })
      .setProtectedHeader({ alg: "HS256" }).setSubject("u1").setAudience(STATE_AUDIENCE).setExpirationTime("5m").sign(new TextEncoder().encode(SECRET));
    expect(await verifyOAuthState(sessionKeyed)).toBeNull();
  });

  it("rejects an unknown product", async () => {
    const key = new Uint8Array(createHmac("sha256", SECRET).update("google-oauth-state:v1").digest());
    const t = await new SignJWT({ pid: "p1", org: "o1", prd: "ads", nonce: "n" })
      .setProtectedHeader({ alg: "HS256" }).setSubject("u1").setAudience(STATE_AUDIENCE).setExpirationTime("5m").sign(key);
    expect(await verifyOAuthState(t)).toBeNull();
  });

  it("expires after 10 minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T10:00:00Z"));
    const { token } = await signOAuthState(base);
    vi.setSystemTime(new Date("2026-10-29T10:09:00Z"));
    expect(await verifyOAuthState(token)).not.toBeNull();
    vi.setSystemTime(new Date("2026-10-29T10:11:00Z"));
    expect(await verifyOAuthState(token)).toBeNull();
  });
});
