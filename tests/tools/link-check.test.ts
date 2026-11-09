import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Every target goes through assertPublicUrl; in tests it "resolves" to the local test server (or is blocked).
vi.mock("@/lib/crawler/safe-fetch", async (orig) => {
  const real = await orig<typeof import("@/lib/crawler/safe-fetch")>();
  return {
    ...real,
    assertPublicUrl: vi.fn(async (input: string) => {
      const url = new URL(input);
      if (url.hostname === "internal.test") throw new real.SafeFetchError("blocked", "private");
      if (url.hostname === "gone.test") throw new real.SafeFetchError("dns_failed", "nx");
      return { url, address: "127.0.0.1", family: 4 };
    }),
  };
});

import {
  checkLinks,
  checkTarget,
  classifyStatus,
  extractLinkTargets,
  LinkProbeError,
  probeUrl,
  runLinkCheck,
  type LinkTarget,
  type ProbeFetcher,
} from "@/lib/tools/link-check";

const T = (url: string, extra: Partial<LinkTarget> = {}): LinkTarget => ({ url, text: "", kind: "link", internal: false, ...extra });

/** Fake fetcher from a table of "METHOD url" or "url" → status/location/error. */
function fake(table: Record<string, { status: number; location?: string } | LinkProbeError>, log: string[] = []): ProbeFetcher {
  return async (url, method) => {
    log.push(`${method} ${url}`);
    const hit = table[`${method} ${url}`] ?? table[url];
    if (!hit) return { status: 200, location: null };
    if (hit instanceof LinkProbeError) throw hit;
    return { status: hit.status, location: hit.location ?? null };
  };
}

describe("extractLinkTargets", () => {
  const html = `<html><head><base href="https://site.com/blog/"></head><body>
    <a href="post-1">First post</a>
    <a href="https://site.com/blog/post-1#comments">Again</a>
    <a href="https://WWW.site.com/about"> About   us </a>
    <a href="https://other.org/x"><img src="/logo.png" alt="Other logo"></a>
    <a href="mailto:hi@site.com">Mail</a><a href="tel:+1">Call</a><a href="javascript:void(0)">JS</a><a href="#top">Top</a>
    <a href="ftp://files.site.com/a">FTP</a><a href="">empty</a>
    <img src="data:image/png;base64,AAAA"><img src="/hero.jpg" alt="Hero">
  </body></html>`;

  it("resolves, dedupes, skips non-web links and labels internal/external", () => {
    const r = extractLinkTargets(html, "https://site.com/blog/");
    expect(r.targets.map((t) => t.url)).toEqual([
      "https://site.com/blog/post-1",
      "https://www.site.com/about",
      "https://other.org/x",
      "https://site.com/logo.png",
      "https://site.com/hero.jpg",
    ]);
    expect(r.targets[0]).toMatchObject({ text: "First post", internal: true, kind: "link" });
    expect(r.targets[1]).toMatchObject({ text: "About us", internal: true });
    expect(r.targets[2]).toMatchObject({ text: "[image: Other logo]", internal: false });
    expect(r.targets[4]).toMatchObject({ kind: "image", text: "Hero" });
    expect(r.skipped).toBe(7);
    expect(r.capped).toBe(false);
  });

  it("caps the number of targets", () => {
    const many = Array.from({ length: 200 }, (_, i) => `<a href="/p${i}">p</a>`).join("");
    const r = extractLinkTargets(many, "https://site.com/");
    expect(r.targets).toHaveLength(150);
    expect(r.found).toBe(200);
    expect(r.capped).toBe(true);
  });
});

describe("classification", () => {
  it("maps statuses to classes", () => {
    expect(classifyStatus(200)).toBe("ok");
    expect(classifyStatus(204)).toBe("ok");
    expect(classifyStatus(404)).toBe("broken");
    expect(classifyStatus(410)).toBe("broken");
    expect(classifyStatus(500)).toBe("broken");
    for (const s of [401, 403, 429, 999]) expect(classifyStatus(s)).toBe("blocked");
  });
});

describe("checkTarget", () => {
  it("OK on a 2xx HEAD without a GET", async () => {
    const log: string[] = [];
    const r = await checkTarget(T("https://a.com/"), fake({}, log));
    expect(r).toMatchObject({ class: "ok", status: 200, chain: [] });
    expect(log).toEqual(["HEAD https://a.com/"]);
  });

  it("falls back to GET when HEAD is refused", async () => {
    const log: string[] = [];
    const r = await checkTarget(T("https://a.com/x"), fake({ "HEAD https://a.com/x": { status: 405 }, "GET https://a.com/x": { status: 200 } }, log));
    expect(r.class).toBe("ok");
    expect(log).toEqual(["HEAD https://a.com/x", "GET https://a.com/x"]);
  });

  it("falls back to GET when HEAD drops the connection, but not on timeout", async () => {
    const r = await checkTarget(T("https://a.com/x"), fake({ "HEAD https://a.com/x": new LinkProbeError("network", "ECONNRESET") }));
    expect(r.class).toBe("ok");
    const log: string[] = [];
    const t = await checkTarget(T("https://a.com/y"), fake({ "HEAD https://a.com/y": new LinkProbeError("timeout", "slow") }, log));
    expect(t.class).toBe("timeout");
    expect(log).toHaveLength(1);
  });

  it("reports 404 as broken (after GET confirms it)", async () => {
    const r = await checkTarget(T("https://a.com/gone"), fake({ "https://a.com/gone": { status: 404 } }));
    expect(r).toMatchObject({ class: "broken", status: 404 });
    expect(r.note).toContain("404 Not Found");
  });

  it("follows redirects, reports the chain and http→https", async () => {
    const r = await checkTarget(
      T("http://a.com/old"),
      fake({
        "http://a.com/old": { status: 301, location: "https://a.com/old" },
        "https://a.com/old": { status: 302, location: "/new" },
      }),
    );
    expect(r.class).toBe("redirect");
    expect(r.finalUrl).toBe("https://a.com/new");
    expect(r.chain).toEqual([
      { url: "http://a.com/old", status: 301 },
      { url: "https://a.com/old", status: 302 },
    ]);
    expect(r.httpToHttps).toBe(true);
    expect(r.note).toMatch(/redirect chain/);
    expect(r.note).toMatch(/301/);
  });

  it("a redirect that ends in 404 is broken", async () => {
    const r = await checkTarget(T("https://a.com/r"), fake({ "https://a.com/r": { status: 301, location: "/missing" }, "https://a.com/missing": { status: 404 } }));
    expect(r).toMatchObject({ class: "broken", status: 404 });
    expect(r.chain).toHaveLength(1);
  });

  it("stops redirect loops after 5 hops", async () => {
    const r = await checkTarget(T("https://a.com/loop"), fake({ "https://a.com/loop": { status: 302, location: "/loop" } }));
    expect(r.class).toBe("broken");
    expect(r.note).toMatch(/loop/);
  });

  it("blocked-by-site and connection errors", async () => {
    expect((await checkTarget(T("https://li.com/"), fake({ "https://li.com/": { status: 999 } }))).class).toBe("blocked");
    expect((await checkTarget(T("https://a.com/"), fake({ "https://a.com/": { status: 403 } }))).class).toBe("blocked");
    const dns = await checkTarget(T("https://nx.com/"), fake({ "https://nx.com/": new LinkProbeError("dns", "") }));
    expect(dns.class).toBe("error");
    const tls = await checkTarget(T("https://bad.com/"), fake({ "https://bad.com/": new LinkProbeError("tls", "CERT_HAS_EXPIRED") }));
    expect(tls.note).toMatch(/certificate/);
  });
});

describe("checkLinks scheduler", () => {
  it("keeps input order and respects global and per-host caps", async () => {
    let active = 0;
    let maxActive = 0;
    const perHost = new Map<string, number>();
    let maxPerHost = 0;
    const fetcher: ProbeFetcher = async (url) => {
      const h = new URL(url).hostname;
      active++;
      perHost.set(h, (perHost.get(h) ?? 0) + 1);
      maxActive = Math.max(maxActive, active);
      maxPerHost = Math.max(maxPerHost, perHost.get(h)!);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      perHost.set(h, perHost.get(h)! - 1);
      return { status: 200, location: null };
    };
    const targets = [
      ...Array.from({ length: 12 }, (_, i) => T(`https://one.com/${i}`)),
      ...Array.from({ length: 12 }, (_, i) => T(`https://h${i}.com/`)),
    ];
    const { results, unchecked } = await checkLinks(targets, { fetcher });
    expect(unchecked).toBe(0);
    expect(results.map((r) => r.url)).toEqual(targets.map((t) => t.url));
    expect(maxActive).toBeLessThanOrEqual(8);
    expect(maxPerHost).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(3);
  });

  it("stops at the deadline and reports what it didn't check", async () => {
    const fetcher: ProbeFetcher = (_url, _m, timeoutMs) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => resolve({ status: 200, location: null }), 30);
        if (timeoutMs < 30) {
          clearTimeout(t);
          setTimeout(() => reject(new LinkProbeError("timeout", "")), timeoutMs);
        }
      });
    const targets = Array.from({ length: 40 }, (_, i) => T(`https://h${i}.com/`));
    const { results, unchecked } = await checkLinks(targets, { fetcher, deadline: Date.now() + 80 });
    expect(results.length).toBeGreaterThan(0);
    expect(unchecked).toBeGreaterThan(0);
    expect(results.length + unchecked).toBe(40);
    // A budget-cut timeout is "not checked", never reported as a slow site.
    expect(results.every((r) => r.class === "ok")).toBe(true);
  });

  it("runLinkCheck reports counts", async () => {
    const html = `<a href="/ok">ok</a><a href="/404">bad</a><a href="https://x.com/">x</a>`;
    const report = await runLinkCheck(
      { url: "https://site.com/", finalUrl: "https://site.com/", html },
      { fetcher: fake({ "https://site.com/404": { status: 404 }, "https://x.com/": { status: 301, location: "https://www.x.com/" } }) },
    );
    expect(report.checked).toBe(3);
    expect(report.counts).toMatchObject({ ok: 1, broken: 1, redirect: 1 });
  });
});

describe("probeUrl (real HTTP, pinned to a local server)", () => {
  let server: http.Server;
  let port = 0;
  const seen: { method: string; url: string; ua: string }[] = [];
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      seen.push({ method: req.method ?? "", url: req.url ?? "", ua: String(req.headers["user-agent"]) });
      if (req.url === "/no-head" && req.method === "HEAD") return void res.writeHead(405).end();
      if (req.url === "/moved") return void res.writeHead(301, { location: "/no-head" }).end();
      if (req.url === "/hang") return; // never answers
      if (req.url === "/big") {
        res.writeHead(200, { "content-type": "application/octet-stream" });
        const chunk = Buffer.alloc(64 * 1024);
        const pump = () => res.write(chunk) && setImmediate(pump);
        return void pump();
      }
      res.writeHead(req.url === "/missing" ? 404 : 200, { "content-type": "text/html" }).end("<p>hi</p>");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });
  beforeEach(() => {
    seen.length = 0;
  });
  const u = (p: string) => `http://example.test:${port}${p}`;

  it("HEAD → GET fallback and redirects through the real fetcher", async () => {
    const r = await checkTarget(T(u("/moved")), probeUrl);
    expect(r).toMatchObject({ class: "redirect", status: 200, finalUrl: u("/no-head") });
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual(["HEAD /moved", "HEAD /no-head", "GET /no-head"]);
    expect(seen[0].ua).toMatch(/MyWebRankBot/);
  });

  it("does not download bodies", async () => {
    const started = Date.now();
    const res = await probeUrl(u("/big"), "GET", 2000);
    expect(res.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it("times out, reports 404, and refuses internal/unknown hosts", async () => {
    await expect(probeUrl(u("/hang"), "HEAD", 100)).rejects.toMatchObject({ code: "timeout" });
    expect((await checkTarget(T(u("/missing")), probeUrl)).class).toBe("broken");
    await expect(probeUrl("http://internal.test/", "HEAD", 1000)).rejects.toMatchObject({ code: "blocked" });
    await expect(probeUrl("http://gone.test/", "HEAD", 1000)).rejects.toMatchObject({ code: "dns" });
    const blocked = await checkTarget(T("http://internal.test/admin"), probeUrl);
    expect(blocked.class).toBe("error");
    expect(blocked.note).toMatch(/private or internal/);
  });
});
