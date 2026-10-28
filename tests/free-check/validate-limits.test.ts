import { describe, expect, it, vi } from "vitest";

// No real DNS in tests.
const dnsTable: Record<string, { address: string; family: number }[]> = {
  "public.example": [{ address: "93.184.216.34", family: 4 }],
  "intranet.example": [{ address: "192.168.1.10", family: 4 }],
  "rebind.example": [{ address: "127.0.0.1", family: 4 }],
};
vi.mock("node:dns/promises", () => {
  const lookup = vi.fn(async (host: string) => {
    const r = dnsTable[host];
    if (!r) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    return r;
  });
  return { lookup, default: { lookup } };
});

import { normalizeInputUrl, validateFreeCheckUrl } from "@/lib/free-check/validate";
import { checkContactLimit, checkFreeCheckLimit, FREE_CHECK_LIMITS } from "@/lib/free-check/limits";

describe("normalizeInputUrl", () => {
  it("adds https:// to bare domains and normalises", () => {
    expect(normalizeInputUrl("  Public.Example ")).toBe("https://public.example/");
    expect(normalizeInputUrl("http://public.example/about?utm_source=x")).toBe("http://public.example/about");
  });
  it("rejects junk, other schemes and single-label hosts", () => {
    for (const bad of ["", "   ", "not a url", "javascript:alert(1)", "data:text/html,hi", "mailto:a@b.co", "ftp://public.example", "localhost", "localhost:3000", "http://intranet/", 42, null, "x".repeat(3000)]) {
      expect(normalizeInputUrl(bad), String(bad).slice(0, 30)).toBeNull();
    }
  });
});

describe("validateFreeCheckUrl (assertPublicUrl)", () => {
  it("accepts a public website", async () => {
    await expect(validateFreeCheckUrl("public.example")).resolves.toEqual({ ok: true, url: "https://public.example/" });
  });
  it.each([
    ["http://127.0.0.1/"],
    ["http://10.0.0.5/"],
    ["http://169.254.169.254/latest/meta-data"],
    ["http://[::1]/"],
    ["https://intranet.example/"],
    ["https://rebind.example/"],
    ["http://printer.local/"],
    ["https://public.example:22/"],
  ])("blocks private or unsafe target %s", async (u) => {
    const r = await validateFreeCheckUrl(u);
    expect(r.ok).toBe(false);
  });
  it("explains unknown domains and invalid input", async () => {
    const dns = await validateFreeCheckUrl("no-such-site.example");
    expect(dns).toMatchObject({ ok: false, code: "invalid_url" });
    expect(dns.ok ? "" : dns.message).toMatch(/couldn't find/i);
    expect(await validateFreeCheckUrl("javascript:alert(1)")).toMatchObject({ ok: false, code: "invalid_url" });
    expect(await validateFreeCheckUrl("http://10.0.0.5/")).toMatchObject({ ok: false, code: "blocked_url" });
  });
});

describe("free-check rate limits", () => {
  it("allows 3 checks per IP per hour, then blocks with retry-after", () => {
    const t0 = 2_000_000_000_000;
    for (let i = 0; i < FREE_CHECK_LIMITS.perIp; i++) expect(checkFreeCheckLimit("1.1.1.1", t0 + i).allowed).toBe(true);
    const blocked = checkFreeCheckLimit("1.1.1.1", t0 + 10);
    expect(blocked).toMatchObject({ allowed: false, scope: "ip" });
    expect(blocked.allowed ? 0 : blocked.retryAfterSec).toBeGreaterThan(3000);
    // Another IP is unaffected; the window resets after an hour.
    expect(checkFreeCheckLimit("2.2.2.2", t0 + 20).allowed).toBe(true);
    expect(checkFreeCheckLimit("1.1.1.1", t0 + FREE_CHECK_LIMITS.windowMs + 1).allowed).toBe(true);
  });

  it("caps everyone at 30 per hour and blocked IPs don't consume the global budget", () => {
    const t0 = 3_000_000_000_000; // fresh windows
    let allowed = 0;
    // 3 attempts from each of 15 IPs = 45 attempts; only 30 may pass globally.
    for (let ip = 0; ip < 15; ip++) {
      for (let k = 0; k < 3; k++) if (checkFreeCheckLimit(`10.9.0.${ip}`, t0 + ip).allowed) allowed++;
    }
    expect(allowed).toBe(FREE_CHECK_LIMITS.global);
    const r = checkFreeCheckLimit("10.9.1.1", t0 + 100);
    expect(r).toMatchObject({ allowed: false, scope: "global" });
  });

  it("limits the contact form separately", () => {
    const t0 = 4_000_000_000_000;
    for (let i = 0; i < 5; i++) expect(checkContactLimit("5.5.5.5", t0).allowed).toBe(true);
    expect(checkContactLimit("5.5.5.5", t0).allowed).toBe(false);
    expect(checkFreeCheckLimit("5.5.5.5", t0).allowed).toBe(true);
  });
});
