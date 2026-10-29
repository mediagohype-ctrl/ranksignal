import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp, clientIpFromHeaders, trustedProxyHops } from "@/lib/auth/rate-limit";
import {
  ACCOUNT_LOCK_AFTER_FAILURES, ACCOUNT_LOCK_MS, clearLoginFailures, isAccountLocked, recordLoginFailure,
} from "@/lib/auth/login-guard";

afterEach(() => vi.unstubAllEnvs());

const req = (headers: Record<string, string>) => new Request("http://localhost/x", { headers });

describe("clientIp (X-Forwarded-For spoofing)", () => {
  it("uses the RIGHTMOST hop (added by our proxy), ignoring client-supplied entries on the left", () => {
    vi.stubEnv("TRUST_PROXY_HOPS", "");
    expect(trustedProxyHops()).toBe(1);
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(req({ "x-forwarded-for": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("an attacker rotating the leftmost value still maps to one IP", () => {
    const ips = new Set(Array.from({ length: 20 }, (_, i) => clientIp(req({ "x-forwarded-for": `10.0.0.${i}, 203.0.113.5` }))));
    expect([...ips]).toEqual(["203.0.113.5"]);
  });

  it("honours TRUST_PROXY_HOPS for multi-proxy setups", () => {
    vi.stubEnv("TRUST_PROXY_HOPS", "2");
    expect(clientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.5, 10.1.1.1" }))).toBe("203.0.113.5");
    // Fewer entries than hops: best effort (leftmost).
    expect(clientIp(req({ "x-forwarded-for": "203.0.113.5" }))).toBe("203.0.113.5");
    vi.stubEnv("TRUST_PROXY_HOPS", "nonsense");
    expect(trustedProxyHops()).toBe(1);
  });

  it("TRUST_PROXY_HOPS=0 ignores X-Forwarded-For entirely", () => {
    vi.stubEnv("TRUST_PROXY_HOPS", "0");
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then 'unknown'; rejects garbage values", () => {
    expect(clientIp(req({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(req({ "x-forwarded-for": "1.1.1.1, not-an-ip", "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(req({}))).toBe("unknown");
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "1.1.1.1, 2001:DB8::1" }))).toBe("2001:db8::1");
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.5:4431" }))).toBe("203.0.113.5");
  });
});

describe("per-account login lockout", () => {
  it(`locks an email after ${ACCOUNT_LOCK_AFTER_FAILURES} failures from any IPs, for 15 minutes`, () => {
    const email = "lock-target@example.com";
    const t0 = Date.now();
    clearLoginFailures("x", email);
    for (let i = 0; i < ACCOUNT_LOCK_AFTER_FAILURES - 1; i++) recordLoginFailure(`198.51.100.${i}`, email, t0 + i);
    expect(isAccountLocked(email, t0 + 100)).toBe(false);
    recordLoginFailure("192.0.2.200", email, t0 + 200);
    expect(isAccountLocked(email, t0 + 300)).toBe(true);
    // Other emails are unaffected.
    expect(isAccountLocked("someone-else@example.com", t0 + 300)).toBe(false);
    // Lock expires after ACCOUNT_LOCK_MS.
    expect(isAccountLocked(email, t0 + 200 + ACCOUNT_LOCK_MS + 1)).toBe(false);
  });

  it("failures older than the 15-minute window do not count", () => {
    const email = "slow-guess@example.com";
    const t0 = Date.now();
    for (let i = 0; i < ACCOUNT_LOCK_AFTER_FAILURES - 1; i++) recordLoginFailure("192.0.2.1", email, t0);
    recordLoginFailure("192.0.2.1", email, t0 + 16 * 60 * 1000);
    expect(isAccountLocked(email, t0 + 16 * 60 * 1000)).toBe(false);
  });
});
