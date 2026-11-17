// Text derived from a SiteReport at the moment it is SHOWN, so reports stored before a wording rule changed still
// read correctly: the headline's "Biggest fix" (one rule, shared with Home) and the limitations list. Pure.
import type { SiteReport } from "@/lib/report/types";
import { scoreLabel } from "@/lib/report/score";
import { biggestFix } from "@/lib/report/counts";
import { templateSummary } from "@/lib/report/summary";

type HeadlineReport = Pick<SiteReport, "overall" | "pillars" | "issues" | "crawl">;

/**
 * "49 / 100 · Poor. Biggest fix: …" — the biggest fix is the problem worth the most points (ties: least time),
 * the same rule Home uses for "Your next 3 fixes".
 */
export function reportHeadline(r: HeadlineReport): string {
  if (!r.crawl.crawlRunId) return "We haven't checked your website yet. Run a website check to get your score.";
  const overall = r.overall.score;
  if (overall === null) return "We couldn't score your site from the last check — the pages may not have loaded. Try checking your website again.";
  const top = biggestFix(r);
  return `${overall} / 100 · ${scoreLabel(overall)}. ${top ? `Biggest fix: ${top.title.replace(/\.$/, "")}.` : "No big problems found on the pages we checked."}`;
}

/** The old line, written into every report whether or not Google's speed test was used. */
const SPEED_PROXY_LINE = /^Page speed is estimated from page size/i;

/** True when this report's speed numbers come from Google PageSpeed Insights (the Core Web Vitals card and check). */
export function usedPageSpeed(r: Pick<SiteReport, "coreWebVitals">): boolean {
  const v = r.coreWebVitals;
  return !!v && v.status === "measured" && v.tested > 0;
}

/** The speed caveat that is true for this report. */
export function speedLimitation(r: Pick<SiteReport, "coreWebVitals">): string {
  const v = r.coreWebVitals;
  if (v && usedPageSpeed(r)) {
    const how =
      v.source === "field" ? "using real visitors' data" : v.source === "lab" ? "using Google's lab test (one test run, not real visitors)" : "using real visitors' data where Google has it and its lab test elsewhere";
    return `Page speed was measured by Google PageSpeed Insights on ${v.tested} ${v.tested === 1 ? "page" : "pages"} (phone view), ${how}. Other pages were not speed-tested, and results change a little from one test to the next.`;
  }
  return "Page speed is estimated from page size and scripts (a proxy) — use Google PageSpeed Insights for a real speed test.";
}

/** The old "pages read" line: a bare "X of at least Y (scan limit Z)" that blamed the limit even when it wasn't reached. */
const OLD_PAGES_LINE = /^We checked (\d+) of at least (\d+) pages we found \(scan limit (\d+)\)/;

/**
 * Limitations as they should be shown: the speed line always matches where the speed numbers came from, and the
 * "pages read" line says why the rest were not read.
 */
export function reportLimitations(r: Pick<SiteReport, "limitations" | "coreWebVitals">): string[] {
  const out = [...(r.limitations ?? [])];
  const at = out.findIndex((l) => SPEED_PROXY_LINE.test(l) || /^Page speed was measured by Google PageSpeed Insights/i.test(l));
  if (at >= 0) out[at] = speedLimitation(r);
  const pg = out.findIndex((l) => OLD_PAGES_LINE.test(l));
  if (pg >= 0) {
    const m = OLD_PAGES_LINE.exec(out[pg])!;
    out[pg] = pagesReadNote({ crawled: Number(m[1]), found: Number(m[2]), limit: Number(m[3]) }) ?? out[pg];
  }
  return out;
}

/**
 * A stored report as it should be shown today: headline, automatic summary and limitations re-derived from the
 * report's own data (cheap, pure, no LLM). An AI-written summary is kept exactly as stored.
 */
export function presentReport<T extends SiteReport>(r: T): T {
  try {
    const out = { ...r, overall: { ...r.overall, headline: reportHeadline(r) }, limitations: reportLimitations(r) };
    if (r.executiveSummarySource === "template" && r.crawl.crawlRunId) out.executiveSummary = templateSummary(out);
    return out;
  } catch {
    return r; // a legacy / partial stored blob must never break a page
  }
}

// ---------------------------------------------------------------------------------------------------------------
// "64 of 111 pages read" — say WHY the rest were not read.

export interface PagesReadFacts {
  /** Pages read (CrawlRun.pagesCrawled). */
  crawled: number;
  /** Addresses found (links + page list). */
  found: number;
  /** Pages allowed per check on the plan, when known. */
  limit?: number | null;
  /** Links the crawler recorded as not read on their own (newer checks only). */
  skipped?: { filter?: number; account?: number; duplicate?: number } | null;
}

const pagesWord = (n: number) => `${n} ${n === 1 ? "page" : "pages"}`;

/**
 * One or two plain sentences for a check that read fewer pages than it found. The reasons come from how the website
 * check works (src/lib/crawler/crawl.ts), not from a guess: it stops at the plan's page limit; below the limit, an
 * address is left out only when it leads to a page already read (a duplicate) or the site's robot rules close it.
 * Null when every page found was read.
 */
export function pagesReadNote(f: PagesReadFacts): string | null {
  const found = Math.max(f.found, f.crawled);
  const rest = found - f.crawled;
  const sk = f.skipped ?? null;
  const parts = sk
    ? [
        sk.filter ? `${sk.filter} filter or sort ${sk.filter === 1 ? "link" : "links"} (the same page shown in a different order)` : "",
        sk.account ? `${sk.account} sign-in, account or basket ${sk.account === 1 ? "screen" : "screens"}` : "",
        sk.duplicate ? `${sk.duplicate} ${sk.duplicate === 1 ? "copy" : "copies"} of a page we had already read` : "",
      ].filter(Boolean)
    : [];
  const skippedLine = parts.length ? ` We left out ${parts.join(", ")}.` : "";
  if (rest <= 0) return parts.length ? `We read ${pagesWord(f.crawled)} — every page we could find.${skippedLine}` : null;
  if (typeof f.limit === "number" && f.limit > 0 && f.crawled >= f.limit) {
    return `We read ${f.crawled} of at least ${pagesWord(found)}: your plan reads up to ${pagesWord(f.limit)} in one check. Your most important pages are read first.${skippedLine}`;
  }
  // Older checks didn't keep the page limit, so we can't tell a full limit from duplicates: say only what we know.
  if (typeof f.limit !== "number" || f.limit <= 0) {
    return `We read ${f.crawled} of at least ${pagesWord(found)} we found. Your most important pages are read first, but results are based on this sample.${skippedLine}`;
  }
  return (
    `We read ${f.crawled} of the ${found} addresses we found. The other ${rest} ${rest === 1 ? "was" : "were"} not read as ${rest === 1 ? "a page" : "pages"} of ${rest === 1 ? "its" : "their"} own: ` +
    `${rest === 1 ? "it leads" : "they lead"} to a page we had already read, or your site's robot rules file asks robots not to open ${rest === 1 ? "it" : "them"}. ` +
    `You have not reached your plan's limit of ${pagesWord(f.limit)} per check.${skippedLine}`
  );
}

/** pagesReadNote from a stored report (older reports carry no "found" count → null). */
export function reportPagesReadNote(r: Pick<SiteReport, "crawl">): string | null {
  const c = r.crawl;
  if (!c.crawlRunId || typeof c.pagesFound !== "number") return null;
  return pagesReadNote({ crawled: c.pagesCrawled, found: c.pagesFound, limit: c.pageLimit ?? null, skipped: c.skipped ?? null });
}
