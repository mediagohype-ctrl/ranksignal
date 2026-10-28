// BFS site crawler. Same-site only, robots-respecting, bounded pages and concurrency,
// polite per-worker delay. Persists CrawlPage + Resource rows and live CrawlRun counters.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ExtractedPage } from "@/lib/types";
import type { AuditPage, SiteContext } from "@/lib/audit/rules";
import { extractPage } from "@/lib/crawler/extract";
import { isSameSite, looksLikePage, normalizeUrl, siteHost, urlKey } from "@/lib/crawler/normalize";
import { fetchRobots } from "@/lib/crawler/robots";
import { analyzeAiBots } from "@/lib/audit/ai-bots";
import { crawlPriority } from "@/lib/audit/page-kind";

export { crawlPriority };
import { assertPublicUrl, safeFetch, SafeFetchError } from "@/lib/crawler/safe-fetch";
import { discoverSitemapUrls } from "@/lib/crawler/sitemap";

/** Default sample when the project sets no limit — enough to cover a small business site's key pages. */
export const DEFAULT_MAX_PAGES = 25;
export const MAX_PAGES_CAP = 500;
const CONCURRENCY = 3;
const MIN_DELAY_MS = 250;

export interface CrawlOptions {
  crawlRunId: string;
  organizationId: string;
  projectId: string;
  websiteUrl: string;
  maxPages: number;
  /** Brand name + aliases, used for brand-mention extraction. */
  brandNames?: string[];
}

export interface CrawlResult {
  pages: (AuditPage & { id: string })[];
  site: SiteContext;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function clampMaxPages(v: unknown, planCap = MAX_PAGES_CAP): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : DEFAULT_MAX_PAGES;
  return Math.max(1, Math.min(n, MAX_PAGES_CAP, planCap));
}

export async function crawlSite(opts: CrawlOptions): Promise<CrawlResult> {
  const seed = normalizeUrl(opts.websiteUrl);
  if (!seed) throw new SafeFetchError("invalid_url", "Project website URL is invalid");
  await assertPublicUrl(seed); // fail fast with a permanent error (SSRF / invalid)

  // Fetch homepage first so redirects (e.g. http→https, apex→www, domain move) define the site.
  const homeRes = await safeFetch(seed); // errors here propagate (classified by caller)
  const homeUrl = normalizeUrl(homeRes.finalUrl) ?? seed;
  const hosts = new Set<string>([siteHost(new URL(seed).hostname), siteHost(new URL(homeUrl).hostname)]);
  const origin = new URL(homeUrl).origin;

  const robots = await fetchRobots(origin);
  const sitemap = await discoverSitemapUrls(origin, robots.sitemaps, Array.from(hosts), { maxUrls: opts.maxPages * 4 });
  const llmsTxt = await checkLlmsTxt(origin);
  const llmsTxtFound = llmsTxt.found;
  const aiRobots = analyzeAiBots(robots.url, robots.raw, robots.status);
  const homeIsHttps = homeUrl.startsWith("https:");
  const httpRedirectsToHttps = homeIsHttps ? await checkHttpRedirect(homeUrl) : false;
  const delayMs = Math.max(MIN_DELAY_MS, robots.crawlDelayMs);

  const seen = new Set<string>();
  const queue: { url: string; prio: number; seq: number }[] = [];
  const navKeys = new Set<string>();
  let seq = 0;
  const discoverLimit = opts.maxPages * 5;
  const enqueueUrl = (u: string) => {
    const n = normalizeUrl(u);
    const k = n && urlKey(n);
    if (!n || !k || seen.has(k) || seen.size >= discoverLimit) return;
    if (!isSameSite(n, hosts) || !looksLikePage(n)) return;
    seen.add(k);
    queue.push({ url: n, prio: crawlPriority(n, navKeys), seq: seq++ });
  };
  const nextUrl = (): string | undefined => {
    if (!queue.length) return undefined;
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i];
      const b = queue[best];
      if (a.prio < b.prio || (a.prio === b.prio && a.seq < b.seq)) best = i;
    }
    return queue.splice(best, 1)[0].url;
  };
  seen.add(urlKey(seed)!);
  if (urlKey(homeUrl)) seen.add(urlKey(homeUrl)!);

  const pages: (AuditPage & { id: string })[] = [];
  const crawledFinal = new Set<string>([urlKey(homeUrl) ?? homeUrl]);
  let crawled = 0;

  const persist = async (p: AuditPage, responseBytes: number | null) => {
    const row = await db.crawlPage.create({
      data: {
        organizationId: opts.organizationId,
        crawlRunId: opts.crawlRunId,
        url: p.url,
        finalUrl: p.finalUrl,
        statusCode: p.statusCode,
        redirectChain: p.redirectChain as Prisma.InputJsonValue,
        contentType: p.contentType,
        responseBytes,
        extracted: p.extracted ? (p.extracted as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        error: p.error ?? null,
      },
    });
    pages.push({ ...p, id: row.id });
    if (p.statusCode === 200 && p.extracted) {
      const canonicalUrl = urlKey(p.finalUrl) ?? p.finalUrl;
      await db.resource.upsert({
        where: { projectId_canonicalUrl: { projectId: opts.projectId, canonicalUrl } },
        create: { organizationId: opts.organizationId, projectId: opts.projectId, canonicalUrl, contentFingerprint: p.extracted.contentFingerprint, lastSeen: new Date() },
        update: { contentFingerprint: p.extracted.contentFingerprint, lastSeen: new Date(), status: "active" },
      });
    }
    crawled++;
    await db.crawlRun.update({ where: { id: opts.crawlRunId }, data: { pagesCrawled: crawled, pagesFound: Math.max(seen.size, crawled) } });
  };

  const toAuditPage = (url: string, res: { finalUrl: string; status: number; headers: Headers; body: string; redirectChain: string[] }) => {
    const contentType = res.headers.get("content-type");
    let extracted: ExtractedPage | null = null;
    if (res.status === 200 && res.body && (!contentType || /html/i.test(contentType))) {
      extracted = extractPage(res.body, res.finalUrl, hosts, { brandNames: opts.brandNames });
    }
    return { page: { url, finalUrl: res.finalUrl, statusCode: res.status, redirectChain: res.redirectChain, contentType, extracted } as AuditPage, bytes: Buffer.byteLength(res.body) };
  };

  // Homepage (already fetched).
  {
    const { page, bytes } = toAuditPage(seed, homeRes);
    await persist(page, bytes);
    // Homepage nav links first (they are the site's own idea of its key pages), then sitemap URLs.
    for (const l of page.extracted?.navLinks ?? []) {
      const k = urlKey(l);
      if (k) navKeys.add(k);
    }
    page.extracted?.internalLinks.forEach(enqueueUrl);
    sitemap.urls.forEach(enqueueUrl);
  }

  let inFlight = 0;
  const worker = async () => {
    for (;;) {
      if (crawled + inFlight >= opts.maxPages) return;
      const url = nextUrl();
      if (!url) {
        if (inFlight === 0) return;
        await sleep(100); // other workers may still discover links
        continue;
      }
      if (!robots.isAllowed(url)) continue;
      inFlight++;
      try {
        let page: AuditPage;
        let bytes: number | null = null;
        try {
          const res = await safeFetch(url);
          // A redirect onto a page we already crawled (e.g. "/" → "/en/") adds nothing — skip it.
          const finalKey = urlKey(res.finalUrl);
          if (finalKey && crawledFinal.has(finalKey)) continue;
          if (finalKey) crawledFinal.add(finalKey);
          ({ page, bytes } = toAuditPage(url, res));
          if (page.extracted && isSameSite(res.finalUrl, hosts)) page.extracted.internalLinks.forEach(enqueueUrl);
        } catch (e) {
          const msg = e instanceof SafeFetchError ? `${e.code}: ${e.message}` : "fetch failed";
          page = { url, finalUrl: url, statusCode: null, redirectChain: [], contentType: null, extracted: null, error: msg };
        }
        await persist(page, bytes);
      } finally {
        inFlight--;
      }
      await sleep(delayMs);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  return {
    pages,
    site: {
      homepageUrl: homeUrl,
      robots: {
        fetched: robots.fetched,
        status: robots.status,
        blockedAiCrawlers: robots.blockedAiCrawlers,
        aiBots: aiRobots.aiBots,
        blocksEveryone: aiRobots.blocksEveryone,
      },
      sitemapsFound: sitemap.sitemapsFound,
      llmsTxtFound,
      llmsTxt: { status: llmsTxt.status, bytes: llmsTxt.bytes },
      sitemapUrlCount: sitemap.urls.length,
      https: homeIsHttps,
      httpRedirectsToHttps,
      maxPages: opts.maxPages,
      pagesDiscovered: Math.max(seen.size, pages.length),
      checkedAt: new Date().toISOString(),
    },
  };
}

async function checkLlmsTxt(origin: string): Promise<{ found: boolean; status: number | null; bytes: number }> {
  try {
    const res = await safeFetch(`${origin}/llms.txt`, { maxBytes: 256 * 1024, timeoutMs: 8_000 });
    const ct = res.headers.get("content-type") ?? "";
    // Soft-404s often serve HTML with 200; require a non-HTML body.
    const found = res.status === 200 && !/html/i.test(ct) && res.body.trim().length > 0;
    return { found, status: res.status, bytes: found ? Buffer.byteLength(res.body) : 0 };
  } catch {
    return { found: false, status: null, bytes: 0 };
  }
}

/** Does the plain-http homepage redirect to https? null when it could not be checked. */
async function checkHttpRedirect(httpsHome: string): Promise<boolean | null> {
  try {
    const u = new URL(httpsHome);
    u.protocol = "http:";
    const res = await safeFetch(u.toString(), { maxBytes: 64 * 1024, timeoutMs: 8_000 });
    return res.finalUrl.startsWith("https:");
  } catch {
    return null;
  }
}
