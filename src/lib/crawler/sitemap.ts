// Sitemap discovery: robots.txt Sitemap: lines + /sitemap.xml, with sitemap-index support.
import * as cheerio from "cheerio";
import { safeFetch } from "@/lib/crawler/safe-fetch";
import { isSameSite, normalizeUrl } from "@/lib/crawler/normalize";

export interface ParsedSitemap {
  kind: "urlset" | "index" | "unknown";
  locs: string[];
}

export function parseSitemapXml(xml: string, limit = 50_000): ParsedSitemap {
  const $ = cheerio.load(xml, { xml: true });
  const locs: string[] = [];
  const isIndex = $("sitemapindex").length > 0;
  const sel = isIndex ? "sitemapindex > sitemap > loc" : "urlset > url > loc";
  $(sel).each((_, el) => {
    if (locs.length >= limit) return false;
    const loc = $(el).text().trim();
    if (loc) locs.push(loc);
  });
  const kind = isIndex ? "index" : $("urlset").length > 0 ? "urlset" : "unknown";
  return { kind, locs };
}

export interface SitemapDiscovery {
  sitemapsFound: string[];
  urls: string[];
}

/**
 * Discover page URLs from sitemaps. Only same-site sitemap/page URLs are followed.
 * Caps: maxUrls page URLs, maxSitemaps sitemap documents fetched.
 */
export async function discoverSitemapUrls(
  origin: string,
  robotsSitemaps: string[],
  siteHosts: string[],
  opts: { maxUrls?: number; maxSitemaps?: number } = {},
): Promise<SitemapDiscovery> {
  const maxUrls = opts.maxUrls ?? 1000;
  const maxSitemaps = opts.maxSitemaps ?? 10;
  const queue: string[] = [];
  const seen = new Set<string>();
  const push = (u: string) => {
    const n = normalizeUrl(u, origin);
    if (n && !seen.has(n) && isSameSite(n, siteHosts)) {
      seen.add(n);
      queue.push(n);
    }
  };
  robotsSitemaps.forEach(push);
  push(`${origin.replace(/\/$/, "")}/sitemap.xml`);

  const found: string[] = [];
  const urls = new Set<string>();
  let fetched = 0;
  while (queue.length && fetched < maxSitemaps && urls.size < maxUrls) {
    const sm = queue.shift()!;
    fetched++;
    try {
      const res = await safeFetch(sm, { maxBytes: 5 * 1024 * 1024, timeoutMs: 15_000 });
      if (res.status !== 200 || !res.body) continue;
      const parsed = parseSitemapXml(res.body, maxUrls * 2);
      if (parsed.kind === "unknown") continue;
      found.push(sm);
      if (parsed.kind === "index") parsed.locs.forEach(push);
      else {
        for (const loc of parsed.locs) {
          if (urls.size >= maxUrls) break;
          const n = normalizeUrl(loc, origin);
          if (n && isSameSite(n, siteHosts)) urls.add(n);
        }
      }
    } catch {
      /* unreachable sitemap → skip */
    }
  }
  return { sitemapsFound: found, urls: Array.from(urls) };
}
