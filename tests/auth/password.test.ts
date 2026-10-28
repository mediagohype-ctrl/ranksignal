import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { BCRYPT_COST, UNUSABLE_PASSWORD, hashPassword, verifyPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/auth/rate-limit";

describe("password hashing", () => {
  it("hashes with bcrypt cost 12 and verifies", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(bcrypt.getRounds(hash)).toBe(BCRYPT_COST);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong horse battery", hash)).toBe(false);
  }, 20_000);

  it("produces distinct salted hashes for the same password", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password-1"), hashPassword("same-password-1")]);
    expect(a).not.toBe(b);
  }, 20_000);

  it("rejects passwords shorter than 10 characters", async () => {
    await expect(hashPassword("short")).rejects.toThrow();
  });

  it("never verifies against missing, placeholder, or malformed hashes", async () => {
    expect(await verifyPassword("anything-at-all", null)).toBe(false);
    expect(await verifyPassword("anything-at-all", UNUSABLE_PASSWORD)).toBe(false);
    expect(await verifyPassword("anything-at-all", "$2b$garbage")).toBe(false);
  }, 20_000);
});

describe("rate limiter", () => {
  it("blocks after the limit within a window and resets after it", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) expect(checkRateLimit("t:k", 5, 1000, now).allowed).toBe(true);
    expect(checkRateLimit("t:k", 5, 1000, now).allowed).toBe(false);
    expect(checkRateLimit("t:k", 5, 1000, now + 1001).allowed).toBe(true);
  });
});
