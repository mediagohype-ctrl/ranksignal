import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createPasswordResetToken, passwordFingerprint, verifyPasswordResetToken } from "@/lib/auth/password-reset";
import { createEmailVerificationToken, readEmailVerificationToken } from "@/lib/auth/email-verification";
import { derivedKey, readToken } from "@/lib/auth/tokens";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-0123456789";
});

const HASH_A = "$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "$2b$12$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("password reset tokens", () => {
  it("fingerprint is the first 16 hex chars of sha256(hash)", () => {
    expect(passwordFingerprint(HASH_A)).toMatch(/^[0-9a-f]{16}$/);
    expect(passwordFingerprint(HASH_A)).not.toBe(passwordFingerprint(HASH_B));
  });

  it("verifies while the password hash is unchanged", async () => {
    const token = await createPasswordResetToken("user_1", HASH_A);
    const res = await verifyPasswordResetToken(token, async () => HASH_A);
    expect(res).toEqual({ userId: "user_1", passwordHash: HASH_A });
  });

  it("is single-use: rejected once the password hash changes (pwf mismatch)", async () => {
    const token = await createPasswordResetToken("user_1", HASH_A);
    expect(await verifyPasswordResetToken(token, async () => HASH_B)).toBeNull();
  });

  it("rejects unknown users, tampered tokens and other audiences", async () => {
    const token = await createPasswordResetToken("user_1", HASH_A);
    expect(await verifyPasswordResetToken(token, async () => null)).toBeNull();
    expect(await verifyPasswordResetToken(token.slice(0, -3) + "abc", async () => HASH_A)).toBeNull();

    // An email-verification token must not work as a reset token (distinct key + aud).
    const verify = await createEmailVerificationToken("user_1", "a@b.com");
    expect(await verifyPasswordResetToken(verify, async () => HASH_A)).toBeNull();
    expect(await readEmailVerificationToken(verify)).toEqual({ userId: "user_1", email: "a@b.com" });
    expect(await readEmailVerificationToken(token)).toBeNull();
  });

  it("rejects a token signed with the raw SESSION_SECRET (e.g. a session cookie)", async () => {
    const forged = await new SignJWT({ pwf: passwordFingerprint(HASH_A) })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("password-reset")
      .setSubject("user_1")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.SESSION_SECRET));
    expect(await verifyPasswordResetToken(forged, async () => HASH_A)).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const expired = await new SignJWT({ pwf: passwordFingerprint(HASH_A) })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("password-reset")
      .setSubject("user_1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(derivedKey("password-reset"));
    expect(await readToken("password-reset", expired)).toBeNull();
    expect(await verifyPasswordResetToken(expired, async () => HASH_A)).toBeNull();
  });
});
