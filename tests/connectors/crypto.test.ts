import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

beforeAll(() => {
  process.env.CREDENTIALS_KEY = "a".repeat(64);
});

describe("credential crypto", () => {
  it("round-trips with v1:iv:tag:ct format and random IVs", () => {
    const plain = JSON.stringify({ u: "x", p: "secret pass" });
    const a = encryptSecret(plain);
    const b = encryptSecret(plain);
    expect(a.split(":")).toHaveLength(4);
    expect(a.startsWith("v1:")).toBe(true);
    expect(Buffer.from(a.split(":")[1], "base64")).toHaveLength(12);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(plain);
  });

  it("rejects tampered ciphertext and tags", () => {
    const c = encryptSecret("hello world");
    const [v, iv, tag, ct] = c.split(":");
    const flipped = Buffer.from(ct, "base64");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64")].join(":"))).toThrow();
    const badTag = Buffer.from(tag, "base64");
    badTag[0] ^= 1;
    expect(() => decryptSecret([v, iv, badTag.toString("base64"), ct].join(":"))).toThrow();
    expect(() => decryptSecret("v2:" + c.slice(3))).toThrow();
  });

  it("fails with the wrong key", () => {
    const c = encryptSecret("hello");
    process.env.CREDENTIALS_KEY = "b".repeat(64);
    expect(() => decryptSecret(c)).toThrow();
    process.env.CREDENTIALS_KEY = "a".repeat(64);
  });

  it("requires a valid key", () => {
    const old = process.env.CREDENTIALS_KEY;
    process.env.CREDENTIALS_KEY = "short";
    expect(() => encryptSecret("x")).toThrow(/CREDENTIALS_KEY/);
    process.env.CREDENTIALS_KEY = old;
  });
});
