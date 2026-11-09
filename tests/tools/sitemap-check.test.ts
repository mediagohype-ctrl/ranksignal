import { describe, expect, it } from "vitest";
import { SafeFetchError, type SafeFetchResult } from "@/lib/crawler/safe-fetch";
import { checkXmlWellFormed, createEntryAudit, pickSample, runSitemapCheck, type Fetcher } from "@/lib/tools/sitemap-check";

const NOW = new Date("2026-11-09T00:00:00Z");

function res(url: string, status: number, body = "", extra: Partial<SafeFetchResult> = {}): SafeFetchResult {
  return { finalUrl: url, status, headers: new Headers({ "content-type": "application/xml" }), body, redirectChain: [], ...extra };
}

function fakeFetcher(map: Record<string, SafeFetchResult | Error>): Fetcher & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    const r = map[url];
    if (!r) return res(url, 404, "<html>not found</html>");
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as Fetcher & { calls: string[] };
  f.calls = calls;
  return f;
}

const urlset = (entries: string) => `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;

describe("checkXmlWellFormed", () => {
  it("accepts good XML and reports common breakage with a line number", () => {
    expect(checkXmlWellFormed(urlset("<url><loc>https://a.test/?a=1&amp;b=2</loc></url><!-- c --><url><loc><![CDATA[https://a.test/x&y]]></loc></url>"))).toBeNull();
    expect(checkXmlWellFormed("<urlset>\n<url><loc>https://a.test/?a=1&b=2</loc></url></urlset>")).toMatch(/not escaped.*line 2/);
    expect(checkXmlWellFormed("<urlset><url><loc>x</loc></urlset>")).toMatch(/closes <url>/);
    expect(checkXmlWellFormed("<urlset><url>")).toMatch(/never closed/);
    expect(checkXmlWellFormed("<a/><b/>")).toMatch(/More than one main element/);
    expect(checkXmlWellFormed("<html><body>hi</body></html>")).toBeNull();
    expect(checkXmlWellFormed("just text")).toMatch(/outside/);
  });
});

describe("createEntryAudit", () => {
  it("counts lastmod coverage, staleness, hosts, http and duplicates", () => {
    const a = createEntryAudit("a.test", NOW);
    a.add([
      { loc: "https://a.test/", lastmod: "2026-10-01" },
      { loc: "https://a.test/old", lastmod: "2024-01-01T10:00:00+05:30" },
      { loc: "http://a.test/insecure", lastmod: null },
      { loc: "https://www.a.test/other", lastmod: "2027-06-01" },
      { loc: "https://a.test/", lastmod: "01/02/2026" },
      { loc: "/relative", lastmod: null },
    ]);
    const s = a.stats();
    expect(s.total).toBe(6);
    expect(s.withLastmod).toBe(4);
    expect(s.olderThan12Months).toBe(1);
    expect(s.futureLastmod).toBe(1);
    expect(s.badLastmod.count).toBe(1);
    expect(s.nonHttps.count).toBe(1);
    expect(s.otherHost.examples).toEqual(["https://www.a.test/other"]);
    expect(s.duplicates.count).toBe(1);
    expect(s.invalid.count).toBe(1);
  });

  it("pickSample spreads evenly and keeps the ends", () => {
    const xs = Array.from({ length: 100 }, (_, i) => i);
    const s = pickSample(xs, 20);
    expect(s).toHaveLength(20);
    expect(s[0]).toBe(0);
    expect(s[19]).toBe(99);
    expect(pickSample([1, 2], 20)).toEqual([1, 2]);
  });
});

describe("runSitemapCheck", () => {
  it("follows robots.txt → index → children and samples URLs", async () => {
    const f = fakeFetcher({
      "https://a.test/robots.txt": res("https://a.test/robots.txt", 200, "User-agent: *\nDisallow:\nSitemap: https://a.test/sitemap_index.xml\n", { headers: new Headers({ "content-type": "text/plain" }) }),
      "https://a.test/sitemap_index.xml": res(
        "https://a.test/sitemap_index.xml",
        200,
        `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://a.test/pages.xml</loc></sitemap><sitemap><loc>https://a.test/missing.xml</loc></sitemap></sitemapindex>`,
      ),
      "https://a.test/pages.xml": res(
        "https://a.test/pages.xml",
        200,
        urlset('<url><loc>https://a.test/</loc><lastmod>2026-10-01</lastmod></url><url><loc>https://a.test/gone</loc></url><url><loc>https://a.test/moved</loc></url>'),
      ),
      "https://a.test/": res("https://a.test/", 200, "<html></html>", { headers: new Headers({ "content-type": "text/html" }) }),
      "https://a.test/gone": res("https://a.test/gone", 404, "nope"),
      "https://a.test/moved": res("https://a.test/new", 200, "", { redirectChain: ["https://a.test/moved"] }),
    });
    const r = await runSitemapCheck("https://a.test", { fetch: f, now: NOW });
    expect(r.robotsSitemaps).toEqual(["https://a.test/sitemap_index.xml"]);
    const kinds = Object.fromEntries(r.docs.map((d) => [d.url, d.kind ?? d.error]));
    expect(kinds).toMatchObject({ "https://a.test/sitemap_index.xml": "index", "https://a.test/pages.xml": "urlset", "https://a.test/missing.xml": "HTTP 404" });
    expect(r.docs.some((d) => d.url === "https://a.test/sitemap.xml")).toBe(false); // missing guess is not reported
    expect(r.stats.total).toBe(3);
    expect(r.sample.map((s) => s.verdict).sort()).toEqual(["not_found", "ok", "redirect"]);
    const titles = r.issues.map((i) => i.title).join("\n");
    expect(titles).toMatch(/missing\.xml could not be read/);
    expect(titles).toMatch(/1 of 3 sampled URLs are missing/);
    expect(titles).toMatch(/1 of 3 sampled URLs redirect/);
    expect(r.issues[0].level).toBe("fail");
  });

  it("reports no sitemap, a missing robots.txt line, invalid XML and the 50,000 URL limit", async () => {
    const none = await runSitemapCheck("https://b.test", { fetch: fakeFetcher({}), now: NOW });
    expect(none.issues[0]).toMatchObject({ level: "fail", title: "We couldn't find a sitemap" });

    const big = urlset(Array.from({ length: 50_001 }, (_, i) => `<url><loc>https://c.test/p${i}</loc></url>`).join(""));
    const f = fakeFetcher({
      "https://c.test/sitemap.xml": res("https://c.test/sitemap.xml", 200, big),
    });
    const r = await runSitemapCheck("https://c.test", { fetch: f, now: NOW });
    const doc = r.docs.find((d) => d.url === "https://c.test/sitemap.xml")!;
    expect(doc).toMatchObject({ kind: "urlset", entries: 50_001, overUrlLimit: true });
    expect(r.stats.total).toBe(50_000);
    expect(r.truncated).toBe(true);
    const titles = r.issues.map((i) => i.title).join("\n");
    expect(titles).toMatch(/lists 50,001 URLs/);
    expect(titles).toMatch(/robots\.txt doesn't list your sitemap/);
    expect(r.sample).toHaveLength(20);

    const bad = await runSitemapCheck("https://e.test", {
      fetch: fakeFetcher({ "https://e.test/sitemap_index.xml": res("https://e.test/sitemap_index.xml", 200, "<sitemapindex><sitemap><loc>https://e.test/a&b.xml</loc></sitemap></sitemapindex>") }),
      now: NOW,
    });
    expect(bad.issues.map((i) => i.title).join("\n")).toMatch(/Invalid XML in https:\/\/e\.test\/sitemap_index\.xml: A "&" is not escaped/);
  }, 20_000);

  it("caps child sitemaps at 10 and survives fetch errors", async () => {
    const children = Array.from({ length: 15 }, (_, i) => `<sitemap><loc>https://d.test/s${i}.xml</loc></sitemap>`).join("");
    const map: Record<string, SafeFetchResult | Error> = {
      "https://d.test/sitemap.xml": res("https://d.test/sitemap.xml", 200, `<sitemapindex>${children}</sitemapindex>`),
      "https://d.test/s0.xml": new SafeFetchError("timeout", "Request timed out"),
    };
    const f = fakeFetcher(map);
    const r = await runSitemapCheck("https://d.test", { fetch: f, now: NOW });
    expect(f.calls.filter((u) => /\/s\d+\.xml$/.test(u))).toHaveLength(10);
    expect(r.childSitemapsSkipped).toBe(5);
    expect(r.truncated).toBe(true);
    expect(r.docs.find((d) => d.url === "https://d.test/s0.xml")!.error).toMatch(/too long/);
  });
});
