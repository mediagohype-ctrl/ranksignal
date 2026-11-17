// Looks at ONE page again after a fix ("Fixed — we can see it" / "We can't see this change yet").
// Fetches the page with the SSRF-safe fetcher, re-extracts it, swaps it into the last website check's pages and
// re-runs the same report checks. Only page-level checks can be confirmed this way; site-wide ones (robot rules,
// AI answers…) wait for the next full website check (fixed = null).
import { db } from "@/lib/db";
import { extractPage } from "@/lib/crawler/extract";
import { isSameSite, siteHost, urlKey } from "@/lib/crawler/normalize";
import { safeFetch, type SafeFetchOptions, type SafeFetchResult } from "@/lib/crawler/safe-fetch";
import { runAllChecks } from "@/lib/report/checks";
import { PILLAR_ORDER } from "@/lib/report/score";
import { checkIdOfIssue } from "@/lib/report/page-notes";
import { emptyVisibility } from "@/lib/report/visibility";
import type { CheckContext, EvaluatedCheck, ReportPage } from "@/lib/report/inputs";
import type { ExtractedPage } from "@/lib/types";
import type { TaskRecheck } from "./types";

/** Checks whose result for a page depends on that page's own HTML (so one fetch can confirm a fix). */
export const RECHECKABLE_CHECKS = new Set([
  "seo.titles", "seo.meta_description", "seo.h1", "seo.canonical", "seo.indexability", "seo.image_alt",
  "seo.thin_content", "seo.mobile_viewport", "seo.open_graph", "seo.duplicate_content",
  "aeo.question_headings", "aeo.direct_answers", "aeo.lists_tables", "aeo.readability", "aeo.structured_data",
  "aeo.faq_schema", "aeo.content_depth",
  "geo.quotable_facts", "geo.cited_sources", "geo.freshness", "geo.author_signals",
  "brand.name_consistency",
]);

/**
 * Site-wide problems that are one FILE on the website, so we can confirm them by opening that file:
 * the AI guide file (/llms.txt) and the page list for Google (/sitemap.xml, or the one named in the robot rules file).
 */
export const FILE_CHECKS = new Set(["geo.llms_txt", "seo.sitemap"]);

/** Can "I've done it" be confirmed within seconds by reading the website again? (Otherwise: next website check.) */
export function canVerifyNow(issueId: string): boolean {
  const id = checkIdOfIssue(issueId);
  return !!id && (RECHECKABLE_CHECKS.has(id) || FILE_CHECKS.has(id));
}

/** What a page-level problem is called when we say what we looked for. */
const LOOKED_FOR: Record<string, string> = {
  "seo.titles": "a Google headline of its own (10–60 characters)",
  "seo.meta_description": "a Google summary of its own",
  "seo.h1": "exactly one main heading",
  "seo.canonical": "the line that says which version of the page is the main one",
  "seo.indexability": "that the page can appear on Google",
  "seo.image_alt": "a description on every picture",
  "seo.thin_content": "enough words on the page",
  "seo.mobile_viewport": "the phone-screen setting",
  "seo.open_graph": "a share preview title and picture",
  "seo.duplicate_content": "text that is different from your other pages",
  "aeo.faq_schema": "FAQ info for Google and AI",
  "aeo.structured_data": "info for Google and AI on the page",
  "brand.name_consistency": "your business name in the Google headline",
};

function pathLabel(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? "your home page" : u.pathname;
  } catch {
    return url;
  }
}

/** Looks like a page list for Google (sitemap), not an error page. */
export function looksLikeSitemap(body: string): boolean {
  return /<(urlset|sitemapindex)[\s>]/i.test(body.slice(0, 20_000));
}

/** "Sitemap: https://…" lines of a robot rules file. */
export function sitemapsInRobots(body: string): string[] {
  const out: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const m = /^\s*sitemap\s*:\s*(\S+)/i.exec(line);
    if (m) out.push(m[1]);
  }
  return out.slice(0, 5);
}

const FILE_BYTES = 512 * 1024;
const FILE_TIMEOUT_MS = 8_000;

/** Opens the one file a site-wide problem is about and says whether it is there now. */
export async function recheckSiteFile(checkId: string, websiteUrl: string, fetcher: Fetcher, now: Date = new Date()): Promise<TaskRecheck> {
  let origin: string;
  try {
    origin = new URL(websiteUrl).origin;
  } catch {
    return { url: websiteUrl, at: now.toISOString(), fixed: null };
  }
  const open = async (url: string) => {
    try {
      // Only this website is opened: a redirect to another site doesn't count as the file being there.
      const res = await fetcher(url, { timeoutMs: FILE_TIMEOUT_MS, maxBytes: FILE_BYTES, maxRedirects: 5 });
      return isSameSite(res.finalUrl, [siteHost(new URL(origin).hostname)]) ? res : null;
    } catch {
      return null;
    }
  };
  if (checkId === "geo.llms_txt") {
    const url = `${origin}/llms.txt`;
    const res = await open(url);
    // Same rule as the website check: a 200 that is really an HTML error page doesn't count.
    const found = !!res && res.status === 200 && !/html/i.test(res.headers.get("content-type") ?? "") && res.body.trim().length > 0 && !/^\s*<(!doctype|html)/i.test(res.body);
    return { url, at: now.toISOString(), fixed: found, looked: `We looked for your AI guide file at ${url}.` };
  }
  if (checkId === "seo.sitemap") {
    const url = `${origin}/sitemap.xml`;
    const looked = `We looked for your page list for Google at ${url} and in your robot rules file.`;
    const direct = await open(url);
    if (direct && direct.status === 200 && looksLikeSitemap(direct.body)) return { url, at: now.toISOString(), fixed: true, looked };
    const robots = await open(`${origin}/robots.txt`);
    for (const s of robots && robots.status === 200 ? sitemapsInRobots(robots.body) : []) {
      if (!isSameSite(s, [siteHost(new URL(origin).hostname)])) continue;
      const res = await open(s);
      if (res && res.status === 200 && looksLikeSitemap(res.body)) return { url: s, at: now.toISOString(), fixed: true, looked };
    }
    return { url, at: now.toISOString(), fixed: false, looked };
  }
  return { url: websiteUrl, at: now.toISOString(), fixed: null };
}

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

export type Fetcher = (url: string, opts: SafeFetchOptions) => Promise<SafeFetchResult>;

/** true = this page is still listed for the check, false = no longer, null = the check isn't there to judge. */
export function stillAffected(checks: Pick<EvaluatedCheck, "id" | "status" | "affectedUrls">[], checkId: string, url: string): boolean | null {
  const c = checks.find((x) => x.id === checkId);
  if (!c || c.status === "not_measured") return null;
  if (c.status === "pass") return false;
  const k = urlKey(url) ?? url;
  return c.affectedUrls.some((u) => (urlKey(u) ?? u) === k);
}

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export interface RecheckInput {
  organizationId: string;
  projectId: string;
  /** The website check the problem came from (its other pages give context, e.g. for duplicates). */
  crawlRunId: string | null;
  websiteUrl: string;
  brandNames: string[];
  competitors: { name: string; domain?: string }[];
  issueId: string;
  url: string;
  fetcher?: Fetcher;
  now?: Date;
}

export async function recheckIssuePage(o: RecheckInput): Promise<TaskRecheck> {
  const now = o.now ?? new Date();
  const checkId = checkIdOfIssue(o.issueId);
  if (checkId && FILE_CHECKS.has(checkId)) return recheckSiteFile(checkId, o.websiteUrl, o.fetcher ?? safeFetch, now);
  const what = checkId ? LOOKED_FOR[checkId] : undefined;
  const looked = `We read ${pathLabel(o.url)} again${what ? ` and looked for ${what}` : ""}.`;
  const result = (fixed: boolean | null): TaskRecheck => ({ url: o.url, at: now.toISOString(), fixed, ...(fixed === null ? {} : { looked }) });
  if (!checkId || !RECHECKABLE_CHECKS.has(checkId)) return result(null);

  let hosts: string[];
  try {
    hosts = [siteHost(new URL(o.websiteUrl).hostname)];
  } catch {
    return result(null);
  }
  // Only this project's own website is ever fetched.
  if (!isSameSite(o.url, hosts)) return result(null);

  let res: SafeFetchResult;
  try {
    res = await (o.fetcher ?? safeFetch)(o.url, { timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES, maxRedirects: 5 });
  } catch {
    return result(false); // couldn't open it, so we can't see the change
  }
  const contentType = res.headers.get("content-type");
  const fresh: ReportPage = {
    url: o.url,
    finalUrl: res.finalUrl,
    statusCode: res.status,
    redirectChain: res.redirectChain,
    contentType,
    responseBytes: Buffer.byteLength(res.body),
    extracted: res.status === 200 && res.body && (!contentType || /html/i.test(contentType)) ? extractPage(res.body, res.finalUrl, hosts, { brandNames: o.brandNames }) : null,
    error: null,
  };

  const rows = o.crawlRunId
    ? await db.crawlPage.findMany({
        where: { organizationId: o.organizationId, crawlRunId: o.crawlRunId },
        select: { url: true, finalUrl: true, statusCode: true, redirectChain: true, contentType: true, responseBytes: true, extracted: true, error: true },
        orderBy: { crawledAt: "asc" },
        take: 1000,
      })
    : [];
  const key = urlKey(o.url) ?? o.url;
  const others: ReportPage[] = rows
    .filter((r) => (urlKey(r.url) ?? r.url) !== key && (urlKey(r.finalUrl ?? r.url) ?? r.finalUrl) !== key)
    .map((r) => ({
      url: r.url,
      finalUrl: r.finalUrl ?? r.url,
      statusCode: r.statusCode,
      redirectChain: strArr(r.redirectChain),
      contentType: r.contentType,
      responseBytes: r.responseBytes,
      extracted: (r.extracted as ExtractedPage | null) ?? null,
      error: r.error,
    }));

  const ctx: CheckContext = {
    websiteUrl: o.websiteUrl,
    brandNames: o.brandNames,
    competitors: o.competitors,
    pages: [fresh, ...others],
    site: null,
    findings: [],
    ai: emptyVisibility(),
    now,
  };
  const byPillar = runAllChecks(ctx);
  const checks = PILLAR_ORDER.flatMap((p) => byPillar[p]);
  // Checks list pages by the address they ended up on, so look for both.
  const a = stillAffected(checks, checkId, res.finalUrl);
  const b = stillAffected(checks, checkId, o.url);
  if (a === null && b === null) return result(null);
  return result(!(a || b));
}
