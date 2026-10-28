// Free AI-readiness check runner: robots.txt + homepage + up to 4 key internal pages, scored with the
// same pure report checks as the full product. SSRF-safe fetching only (safeFetch), a hard time budget,
// no database access and no LLM calls.
import type { SiteContext } from "@/lib/audit/rules";
import { analyzeAiBots } from "@/lib/audit/ai-bots";
import { crawlPriority, isUtilityUrl } from "@/lib/audit/page-kind";
import { extractPage } from "@/lib/crawler/extract";
import { isSameSite, looksLikePage, normalizeUrl, siteHost, urlKey } from "@/lib/crawler/normalize";
import { analyzeRobots, type RobotsInfo } from "@/lib/crawler/robots";
import { safeFetch, SafeFetchError, type SafeFetchOptions, type SafeFetchResult } from "@/lib/crawler/safe-fetch";
import { parseSitemapXml } from "@/lib/crawler/sitemap";
import { composeReport } from "@/lib/report/compose";
import type { CheckContext, ReportPage } from "@/lib/report/inputs";
import { emptyVisibility } from "@/lib/report/visibility";
import type { ExtractedPage } from "@/lib/types";
import { trimReport } from "@/lib/free-check/trim";
import type { FreeCheckResult } from "@/lib/free-check/types";

export const FREE_CHECK_BUDGET_MS = 25_000;
export const MAX_KEY_PAGES = 4;
const HOME_TIMEOUT_MS = 10_000;
const SIDE_TIMEOUT_MS = 6_000;
const PAGE_TIMEOUT_MS = 8_000;
const PAGE_MAX_BYTES = 2 * 1024 * 1024;
const SAFETY_MARGIN_MS = 1_500;

export type Fetcher = (url: string, opts: SafeFetchOptions) => Promise<SafeFetchResult>;

export class FreeCheckError extends Error {
  constructor(public code: "unreachable" | "not_html" | "timeout" | "blocked_url", message: string) {
    super(message);
    this.name = "FreeCheckError";
  }
}

/** Pick up to `max` key internal pages from the homepage's links (nav + key paths first, no utility/legal pages). */
export function pickKeyPages(home: ExtractedPage, homeUrl: string, hosts: Iterable<string>, isAllowed: (u: string) => boolean, max = MAX_KEY_PAGES): string[] {
  const navKeys = new Set((home.navLinks ?? []).map((l) => urlKey(l)).filter((k): k is string => !!k));
  const homeKey = urlKey(homeUrl);
  const seen = new Set<string>();
  const candidates: { url: string; prio: number; seq: number }[] = [];
  let seq = 0;
  for (const raw of [...(home.navLinks ?? []), ...home.internalLinks]) {
    const n = normalizeUrl(raw);
    const k = n && urlKey(n);
    if (!n || !k || k === homeKey || seen.has(k)) continue;
    seen.add(k);
    if (!isSameSite(n, hosts) || !looksLikePage(n) || n.includes("?")) continue;
    // Contact pages are useful trust signals; other utility pages (login, cart, legal) are not.
    if (isUtilityUrl(n) && !/\/contact/i.test(new URL(n).pathname)) continue;
    if (!isAllowed(n)) continue;
    const prio = crawlPriority(n, navKeys);
    if (prio === 0) continue; // another homepage variant
    candidates.push({ url: n, prio, seq: seq++ });
  }
  return candidates
    .sort((a, b) => a.prio - b.prio || a.seq - b.seq)
    .slice(0, max)
    .map((c) => c.url);
}

/** Brand name the site declares about itself (business markup or og:site_name); null if none. */
export function detectBrand(home: ExtractedPage | null): string | null {
  const name = home?.organization?.name?.trim() || home?.openGraph?.siteName?.trim() || null;
  return name ? name.slice(0, 80) : null;
}

export async function runFreeCheck(seedUrl: string, opts: { fetcher?: Fetcher; budgetMs?: number; now?: () => number } = {}): Promise<FreeCheckResult> {
  const fetcher = opts.fetcher ?? safeFetch;
  const now = opts.now ?? Date.now;
  const deadline = now() + (opts.budgetMs ?? FREE_CHECK_BUDGET_MS);
  const remaining = (cap: number) => Math.max(0, Math.min(cap, deadline - now() - SAFETY_MARGIN_MS));

  const timed = async (url: string, cap: number, maxBytes = PAGE_MAX_BYTES): Promise<SafeFetchResult | null> => {
    const timeoutMs = remaining(cap);
    if (timeoutMs < 500) return null;
    try {
      return await fetcher(url, { timeoutMs, maxBytes, maxRedirects: 5 });
    } catch {
      return null;
    }
  };

  // 1. Homepage — defines the site (redirects such as apex → www are followed).
  let homeRes: SafeFetchResult;
  try {
    homeRes = await fetcher(seedUrl, { timeoutMs: remaining(HOME_TIMEOUT_MS), maxBytes: PAGE_MAX_BYTES, maxRedirects: 5 });
  } catch (e) {
    if (e instanceof SafeFetchError && (e.code === "blocked" || e.code === "invalid_url")) {
      throw new FreeCheckError("blocked_url", "That address isn't a public website we can check.");
    }
    if (e instanceof SafeFetchError && e.code === "timeout") {
      throw new FreeCheckError("timeout", "Your homepage took too long to respond. Try again in a minute.");
    }
    throw new FreeCheckError("unreachable", "We couldn't load that website. Check the address and try again.");
  }
  const homeUrl = normalizeUrl(homeRes.finalUrl) ?? seedUrl;
  const homeType = homeRes.headers.get("content-type");
  if (homeRes.status >= 400) {
    throw new FreeCheckError("unreachable", `Your homepage returned an error (HTTP ${homeRes.status}), so we couldn't check it.`);
  }
  if (homeType && !/html/i.test(homeType)) throw new FreeCheckError("not_html", "That address doesn't return a web page.");
  const hosts = new Set([siteHost(new URL(seedUrl).hostname), siteHost(new URL(homeUrl).hostname)]);
  const origin = new URL(homeUrl).origin;

  const toPage = (url: string, res: SafeFetchResult | null, brandNames: string[]): ReportPage => {
    if (!res) return { url, finalUrl: url, statusCode: null, redirectChain: [], contentType: null, extracted: null, error: "fetch failed", responseBytes: null };
    const contentType = res.headers.get("content-type");
    const extracted =
      res.status === 200 && res.body && (!contentType || /html/i.test(contentType)) ? extractPage(res.body, res.finalUrl, hosts, { brandNames }) : null;
    return { url, finalUrl: res.finalUrl, statusCode: res.status, redirectChain: res.redirectChain, contentType, extracted, responseBytes: Buffer.byteLength(res.body) };
  };

  // Brand is detected from the homepage first, then pages are extracted with it (brand mention signals).
  const brand = detectBrand(homeRes.status === 200 && homeRes.body ? extractPage(homeRes.body, homeRes.finalUrl, hosts) : null);
  const brandNames = brand ? [brand] : [];
  const homePage = toPage(seedUrl, homeRes, brandNames);

  // 2. Site-level facts in parallel: robots.txt, llms.txt, http→https.
  const [robotsRes, llmsRes, httpRes] = await Promise.all([
    timed(`${origin}/robots.txt`, SIDE_TIMEOUT_MS, 512 * 1024),
    timed(`${origin}/llms.txt`, SIDE_TIMEOUT_MS, 256 * 1024),
    homeUrl.startsWith("https:") ? timed(homeUrl.replace(/^https:/, "http:"), SIDE_TIMEOUT_MS, 64 * 1024) : Promise.resolve(null),
  ]);
  const robotsUrl = `${origin}/robots.txt`;
  const robots: RobotsInfo = analyzeRobots(robotsUrl, robotsRes?.body ?? null, robotsRes?.status ?? null);
  const aiRobots = analyzeAiBots(robotsUrl, robots.raw, robots.status);

  // 3. Sitemap (first declared one, else /sitemap.xml) and key pages in parallel.
  const keyPages = homePage.extracted ? pickKeyPages(homePage.extracted, homeUrl, hosts, robots.isAllowed) : [];
  const sitemapUrl = robots.sitemaps.find((s) => isSameSite(s, hosts)) ?? `${origin}/sitemap.xml`;
  const [sitemapRes, ...pageRes] = await Promise.all([
    timed(sitemapUrl, SIDE_TIMEOUT_MS, 5 * 1024 * 1024),
    ...keyPages.map((u) => timed(u, PAGE_TIMEOUT_MS)),
  ]);
  let sitemapUrlCount = 0;
  let sitemapFound = false;
  if (sitemapRes && sitemapRes.status === 200 && sitemapRes.body) {
    const parsed = parseSitemapXml(sitemapRes.body, 50_000);
    sitemapFound = parsed.kind !== "unknown";
    sitemapUrlCount = parsed.kind === "urlset" ? parsed.locs.length : 0;
  }

  const seenFinal = new Set([urlKey(homeUrl) ?? homeUrl]);
  const pages: ReportPage[] = [homePage];
  keyPages.forEach((u, i) => {
    const res = pageRes[i] ?? null;
    const fk = res ? urlKey(res.finalUrl) : null;
    if (fk && seenFinal.has(fk)) return; // redirected onto a page we already have
    if (fk) seenFinal.add(fk);
    pages.push(toPage(u, res, brandNames));
  });

  const llmsType = llmsRes?.headers.get("content-type") ?? "";
  const llmsFound = !!llmsRes && llmsRes.status === 200 && !/html/i.test(llmsType) && llmsRes.body.trim().length > 0;
  const site: SiteContext = {
    homepageUrl: homeUrl,
    robots: {
      fetched: robots.fetched,
      status: robots.status,
      blockedAiCrawlers: robots.blockedAiCrawlers,
      aiBots: aiRobots.aiBots,
      blocksEveryone: aiRobots.blocksEveryone,
    },
    sitemapsFound: sitemapFound ? [sitemapUrl] : [],
    llmsTxtFound: llmsFound,
    llmsTxt: { status: llmsRes?.status ?? null, bytes: llmsFound ? Buffer.byteLength(llmsRes!.body) : 0 },
    sitemapUrlCount,
    https: homeUrl.startsWith("https:"),
    httpRedirectsToHttps: homeUrl.startsWith("https:") ? (httpRes ? httpRes.finalUrl.startsWith("https:") : null) : false,
    maxPages: pages.length,
    pagesDiscovered: pages.length,
    checkedAt: new Date(now()).toISOString(),
  };

  const ctx: CheckContext = {
    websiteUrl: homeUrl,
    brandNames,
    competitors: [],
    pages,
    site,
    findings: [],
    ai: emptyVisibility(),
    now: new Date(now()),
  };
  const report = composeReport({
    projectId: "free-check",
    brand: brand ?? new URL(homeUrl).hostname.replace(/^www\./, ""),
    websiteUrl: homeUrl,
    generatedAt: new Date(now()),
    crawl: { crawlRunId: "free-check", pagesCrawled: pages.length, pagesFound: pages.length, finishedAt: new Date(now()) },
    ctx,
  });
  return trimReport(report, { brand, pagesChecked: pages.filter((p) => p.statusCode === 200).map((p) => p.finalUrl) });
}

