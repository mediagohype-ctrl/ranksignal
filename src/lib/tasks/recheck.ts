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
  const result = (fixed: boolean | null): TaskRecheck => ({ url: o.url, at: now.toISOString(), fixed });
  const checkId = checkIdOfIssue(o.issueId);
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
