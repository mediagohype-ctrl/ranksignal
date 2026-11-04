import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  nextAfterGoogleLogin,
  profileFromIdToken,
  resolveGoogleLogin,
  signLoginState,
  verifyLoginState,
  type GoogleProfile,
  type LinkCandidate,
} from "@/lib/auth/google-login";
import { signOAuthState } from "@/lib/google/state";

const profile: GoogleProfile = { sub: "g-123", email: "priya@example.com", emailVerified: true, name: "Priya" };
const user = (o: Partial<LinkCandidate> = {}): LinkCandidate => ({ id: "u1", googleId: null, emailVerified: true, hasUnprovenPassword: false, ...o });

describe("resolveGoogleLogin (account linking)", () => {
  it("signs in the user already linked by googleId", () => {
    expect(resolveGoogleLogin(profile, user({ id: "u9", googleId: "g-123" }), user())).toEqual({ kind: "signin", userId: "u9" });
  });
  it("still signs in a linked user even if Google no longer says verified", () => {
    expect(resolveGoogleLogin({ ...profile, emailVerified: false }, user({ googleId: "g-123" }), null).kind).toBe("signin");
  });
  it("refuses to link or create without a Google-verified email", () => {
    expect(resolveGoogleLogin({ ...profile, emailVerified: false }, null, user())).toEqual({ kind: "reject", reason: "email_unverified" });
    expect(resolveGoogleLogin({ ...profile, emailVerified: false }, null, null)).toEqual({ kind: "reject", reason: "email_unverified" });
  });
  it("links an existing verified email account without touching its password", () => {
    expect(resolveGoogleLogin(profile, null, user())).toEqual({ kind: "link", userId: "u1", resetPassword: false });
  });
  it("rotates the password of an unproven account when linking (pre-registration takeover)", () => {
    expect(resolveGoogleLogin(profile, null, user({ emailVerified: false, hasUnprovenPassword: true }))).toEqual({
      kind: "link",
      userId: "u1",
      resetPassword: true,
    });
  });
  it("never re-links an email that belongs to another Google account", () => {
    expect(resolveGoogleLogin(profile, null, user({ googleId: "g-other" }))).toEqual({ kind: "reject", reason: "google_mismatch" });
  });
  it("creates a new account when nobody matches", () => {
    expect(resolveGoogleLogin(profile, null, null)).toEqual({ kind: "create" });
  });
});

describe("profileFromIdToken", () => {
  const now = 1_800_000_000;
  const claims = {
    iss: "https://accounts.google.com",
    aud: "client-1",
    exp: now + 300,
    nonce: "n1",
    sub: "g-1",
    email: "A@Example.com",
    email_verified: true,
    name: " Asha ",
  };
  const exp = { clientId: "client-1", nonce: "n1", nowSec: now };
  it("accepts valid claims and normalises the email", () => {
    expect(profileFromIdToken(claims, exp)).toEqual({ sub: "g-1", email: "a@example.com", emailVerified: true, name: "Asha" });
  });
  it("rejects wrong issuer, audience, nonce or an expired token", () => {
    expect(profileFromIdToken({ ...claims, iss: "https://evil.example" }, exp)).toBeNull();
    expect(profileFromIdToken({ ...claims, aud: "other" }, exp)).toBeNull();
    expect(profileFromIdToken({ ...claims, nonce: "n2" }, exp)).toBeNull();
    expect(profileFromIdToken({ ...claims, exp: now - 3600 }, exp)).toBeNull();
    expect(profileFromIdToken({ ...claims, email: undefined }, exp)).toBeNull();
  });
  it("reports unverified emails", () => {
    expect(profileFromIdToken({ ...claims, email_verified: false }, exp)?.emailVerified).toBe(false);
  });
});

describe("login state", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "s".repeat(40));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips next + ref with a fresh nonce", async () => {
    const a = await signLoginState({ next: "/app/onboarding?website=https%3A%2F%2Facme.in", ref: "FRIEND1" });
    expect(await verifyLoginState(a.token)).toEqual({ next: "/app/onboarding?website=https%3A%2F%2Facme.in", ref: "FRIEND1", nonce: a.nonce });
    expect((await signLoginState({ next: "/app" })).nonce).not.toBe(a.nonce);
  });
  it("rejects Search Console state tokens and garbage", async () => {
    const { token } = await signOAuthState({ projectId: "p", orgId: "o", userId: "u", product: "gsc" });
    expect(await verifyLoginState(token)).toBeNull();
    expect(await verifyLoginState("nope")).toBeNull();
    expect(await verifyLoginState(null)).toBeNull();
  });
});

describe("nextAfterGoogleLogin", () => {
  it("sends new accounts to setup, keeping a website handoff or invitation", () => {
    expect(nextAfterGoogleLogin("/app", true)).toBe("/app/onboarding");
    expect(nextAfterGoogleLogin("/app/onboarding?website=x", true)).toBe("/app/onboarding?website=x");
    expect(nextAfterGoogleLogin("/accept-invite?token=abc", true)).toBe("/accept-invite?token=abc");
    expect(nextAfterGoogleLogin("/app/projects/1", false)).toBe("/app/projects/1");
  });
});
