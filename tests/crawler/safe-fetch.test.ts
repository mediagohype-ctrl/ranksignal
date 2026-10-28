import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";

// --- mocks: DNS + http transport (no real network in tests) ---
const dnsTable: Record<string, { address: string; family: number }[]> = {};
vi.mock("node:dns/promises", () => {
  const lookup = vi.fn(async (host: string) => {
    const r = dnsTable[host];
    if (!r) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    return r;
  });
  return { lookup, default: { lookup } };
});

type FakeResponse = { status: number; headers?: Record<string, string>; body?: string };
const routes: Record<string, FakeResponse> = {};
const requests: { host: string; path: string; pinned?: string }[] = [];

function fakeRequest(opts: Record<string, unknown>, cb: (res: unknown) => void) {
  const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: () => void };
  req.destroy = () => {};
  req.end = () => {
    const host = String(opts.hostname);
    const path = String(opts.path);
    let pinned: string | undefined;
    const lookup = opts.lookup as ((h: string, o: object, cb: (e: null, a: string) => void) => void) | undefined;
    lookup?.(host, {}, (_e, a) => (pinned = a));
    requests.push({ host, path, pinned });
    const route = routes[`${opts.protocol}//${host}${path}`];
    setImmediate(() => {
      if (!route) return req.emit("error", Object.assign(new Error("ECONNREFUSED"), { code: "ECONNREFUSED" }));
      const res = Readable.from([Buffer.from(route.body ?? "")]) as Readable & { statusCode: number; headers: Record<string, string> };
      res.statusCode = route.status;
      res.headers = route.headers ?? { "content-type": "text/html" };
      cb(res);
    });
  };
  return req;
}
vi.mock("node:http", () => ({ default: { request: fakeRequest }, request: fakeRequest }));
vi.mock("node:https", () => ({ default: { request: fakeRequest }, request: fakeRequest }));

import { assertPublicUrl, isBlockedIp, safeFetch, SafeFetchError } from "@/lib/crawler/safe-fetch";

async function expectBlocked(p: Promise<unknown>, code?: string) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(SafeFetchError);
  if (code) expect((err as SafeFetchError).code).toBe(code);
}

beforeEach(() => {
  for (const k of Object.keys(dnsTable)) delete dnsTable[k];
  for (const k of Object.keys(routes)) delete routes[k];
  requests.length = 0;
});

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
    "224.0.0.1", "255.255.255.255", "::1", "::", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "fe80::1", "fc00::1",
    "fd00:ec2::254", "fec0::1", "64:ff9b::7f00:1", "2002:7f00:1::", "not-an-ip", "fe80::1%eth0",
  ])("blocks %s", (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) =>
    expect(isBlockedIp(ip)).toBe(false),
  );
});

describe("assertPublicUrl", () => {
  it.each([
    "http://127.0.0.1/",
    "http://10.1.2.3/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://0.0.0.0/",
    "http://2130706433/", // decimal 127.0.0.1
    "http://0x7f.1/", // hex/short form
    "http://localhost/",
    "http://foo.localhost/",
    "http://printer.local/",
  ])("blocks %s", async (u) => expectBlocked(assertPublicUrl(u), "blocked"));

  it.each(["file:///etc/passwd", "ftp://example.com/", "gopher://example.com/", "javascript:alert(1)", "not a url", "http://user:pass@example.com/"])(
    "rejects invalid/non-http %s",
    async (u) => expectBlocked(assertPublicUrl(u), "invalid_url"),
  );

  it("blocks non-standard ports", async () => expectBlocked(assertPublicUrl("http://8.8.8.8:8080/"), "blocked"));

  it("rejects hostnames that resolve to private addresses (incl. mixed records)", async () => {
    dnsTable["internal.example.com"] = [{ address: "10.0.0.8", family: 4 }];
    dnsTable["mixed.example.com"] = [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }];
    await expectBlocked(assertPublicUrl("https://internal.example.com/"), "blocked");
    await expectBlocked(assertPublicUrl("https://mixed.example.com/"), "blocked");
  });

  it("accepts public hosts and returns the validated address", async () => {
    dnsTable["example.com"] = [{ address: "93.184.216.34", family: 4 }];
    const t = await assertPublicUrl("https://example.com/a");
    expect(t.address).toBe("93.184.216.34");
  });
});

describe("safeFetch", () => {
  it("fetches public pages with the connection pinned to the validated IP", async () => {
    dnsTable["example.com"] = [{ address: "93.184.216.34", family: 4 }];
    routes["https://example.com/"] = { status: 200, body: "<html>hi</html>" };
    const r = await safeFetch("https://example.com/");
    expect(r.status).toBe(200);
    expect(r.body).toContain("hi");
    expect(requests[0].pinned).toBe("93.184.216.34");
  });

  it("re-validates redirects and blocks redirect to a private address", async () => {
    dnsTable["example.com"] = [{ address: "93.184.216.34", family: 4 }];
    routes["https://example.com/go"] = { status: 302, headers: { location: "http://127.0.0.1/admin" } };
    await expectBlocked(safeFetch("https://example.com/go"), "blocked");
    expect(requests.some((r) => r.host === "127.0.0.1")).toBe(false);
  });

  it("blocks redirect to cloud metadata via hostname", async () => {
    dnsTable["example.com"] = [{ address: "93.184.216.34", family: 4 }];
    dnsTable["evil.example.net"] = [{ address: "169.254.169.254", family: 4 }];
    routes["https://example.com/go"] = { status: 301, headers: { location: "http://evil.example.net/" } };
    await expectBlocked(safeFetch("https://example.com/go"), "blocked");
  });

  it("follows redirects and records the chain", async () => {
    dnsTable["example.com"] = [{ address: "93.184.216.34", family: 4 }];
    routes["http://example.com/"] = { status: 301, headers: { location: "https://example.com/" } };
    routes["https://example.com/"] = { status: 301, headers: { location: "/home" } };
    routes["https://example.com/home"] = { status: 200, body: "ok" };
    const r = await safeFetch("http://example.com/");
    expect(r.finalUrl).toBe("https://example.com/home");
    expect(r.redirectChain).toEqual(["http://example.com/", "https://example.com/"]);
  });

  it("enforces max redirects", async () => {
    dnsTable["example.com"] = [{ address: "93.184.216.34", family: 4 }];
    routes["https://example.com/loop"] = { status: 302, headers: { location: "/loop" } };
    await expectBlocked(safeFetch("https://example.com/loop", { maxRedirects: 3 }), "too_many_redirects");
  });

  it("aborts bodies over maxBytes", async () => {
    dnsTable["example.com"] = [{ address: "93.184.216.34", family: 4 }];
    routes["https://example.com/big"] = { status: 200, body: "x".repeat(5000) };
    await expectBlocked(safeFetch("https://example.com/big", { maxBytes: 1000 }), "too_large");
  });

  it("does not decode binary content types", async () => {
    dnsTable["example.com"] = [{ address: "93.184.216.34", family: 4 }];
    routes["https://example.com/img"] = { status: 200, headers: { "content-type": "image/png" }, body: "PNGDATA" };
    const r = await safeFetch("https://example.com/img");
    expect(r.body).toBe("");
  });
});
