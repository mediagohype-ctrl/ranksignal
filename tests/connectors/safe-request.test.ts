import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  __testing, hostAllowed, redactHeaders, safeRequest, safeRequestJson, SafeRequestError,
} from "@/lib/net/safe-request";

let server: http.Server;
let port = 0;
const seen: { method?: string; url?: string; host?: string; auth?: string; body: string }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      seen.push({ method: req.method, url: req.url, host: req.headers.host, auth: req.headers.authorization, body });
      if (req.url === "/redirect") {
        res.writeHead(302, { location: `http://other.test:${port}/echo` });
        return res.end();
      }
      if (req.url === "/big") {
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end("x".repeat(5000));
      }
      if (req.url === "/hang") return; // never responds
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ method: req.method, body, host: req.headers.host, auth: req.headers.authorization ?? null }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  __testing.setResolver(null);
  server.closeAllConnections?.();
  await new Promise<void>((r) => server.close(() => r()));
});

afterEach(() => {
  __testing.setResolver(null);
  seen.length = 0;
});

/** Point every hostname at the local test server (as if DNS resolved it to a public IP). */
function pinToLocal() {
  __testing.setResolver(async (u) => ({ url: new URL(u), address: "127.0.0.1", family: 4 }));
}

describe("safeRequest SSRF guard (default resolver)", () => {
  it.each([
    "http://127.0.0.1/",
    "http://10.1.2.3/",
    "http://192.168.0.10/admin",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://localhost/",
    "http://printer.local/",
  ])("rejects non-public target %s", async (url) => {
    await expect(safeRequest(url, { method: "POST", body: "{}" })).rejects.toMatchObject({ code: "blocked" });
  });

  it("rejects non-http schemes and credentials in URLs", async () => {
    await expect(safeRequest("file:///etc/passwd")).rejects.toMatchObject({ code: "invalid_url" });
    await expect(safeRequest("https://user:pass@example.com/")).rejects.toMatchObject({ code: "invalid_url" });
  });

  it("enforces the host allow-list before connecting", async () => {
    pinToLocal();
    await expect(
      safeRequest(`http://evil.test:${port}/echo`, { allowedHosts: ["api.github.com"] }),
    ).rejects.toBeInstanceOf(SafeRequestError);
    expect(seen).toHaveLength(0);
  });
});

describe("safeRequest transport", () => {
  it("sends method, body and headers to the pinned address with the real Host header", async () => {
    pinToLocal();
    const r = await safeRequestJson<{ method: string; body: string; host: string; auth: string }>(
      `http://api.example.test:${port}/echo`,
      { method: "PUT", json: { a: 1 }, headers: { Authorization: "Bearer secret-token" } },
    );
    expect(r.ok).toBe(true);
    expect(r.data).toMatchObject({ method: "PUT", body: '{"a":1}', host: `api.example.test:${port}`, auth: "Bearer secret-token" });
  });

  it("does not follow redirects by default", async () => {
    pinToLocal();
    const r = await safeRequest(`http://api.example.test:${port}/redirect`);
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toContain("/echo");
    expect(seen).toHaveLength(1);
  });

  it("follows opted-in redirects and drops credentials across origins", async () => {
    pinToLocal();
    const r = await safeRequestJson<{ method: string; auth: string | null }>(`http://api.example.test:${port}/redirect`, {
      method: "POST", json: { x: 1 }, maxRedirects: 2, headers: { authorization: "Bearer secret-token" },
    });
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ method: "GET", auth: null });
    expect(seen[1].auth).toBeUndefined();
  });

  it("caps the response body", async () => {
    pinToLocal();
    await expect(safeRequest(`http://api.example.test:${port}/big`, { maxBytes: 100 })).rejects.toMatchObject({ code: "too_large" });
  });

  it("times out", async () => {
    pinToLocal();
    await expect(safeRequest(`http://api.example.test:${port}/hang`, { timeoutMs: 200 })).rejects.toMatchObject({ code: "timeout" });
  });

  it("never includes auth headers in error messages", async () => {
    pinToLocal();
    try {
      await safeRequest(`http://api.example.test:${port}/hang`, { timeoutMs: 100, headers: { authorization: "Bearer secret-token" } });
    } catch (e) {
      expect(String((e as Error).message)).not.toContain("secret-token");
    }
  });
});

describe("helpers", () => {
  it("redacts auth-like headers", () => {
    expect(redactHeaders({ Authorization: "Bearer x", "X-Shopify-Access-Token": "y", accept: "application/json" })).toEqual({
      Authorization: "[redacted]", "X-Shopify-Access-Token": "[redacted]", accept: "application/json",
    });
  });

  it("matches wildcard allow-lists", () => {
    expect(hostAllowed("shop.myshopify.com", ["*.myshopify.com"])).toBe(true);
    expect(hostAllowed("myshopify.com", ["*.myshopify.com"])).toBe(false);
    expect(hostAllowed("evilmyshopify.com", ["*.myshopify.com"])).toBe(false);
    expect(hostAllowed("API.GITHUB.COM", ["api.github.com"])).toBe(true);
    expect(hostAllowed("anything.com", undefined)).toBe(true);
  });
});
