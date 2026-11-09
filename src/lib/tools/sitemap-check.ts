// XML sitemap checker. Finds a site's sitemaps (robots.txt Sitemap: lines, /sitemap.xml, /sitemap_index.xml), follows a
// sitemap index to at most 10 child sitemaps, and reports on the URLs inside against the sitemaps.org protocol limits
// (50,000 URLs and 50 MB uncompressed per file). Caps: 50,000 URLs and 10 MB read in total, ~17 s for sitemaps, then a
// status check of up to 20 sample URLs. All fetching goes through safeFetch (SSRF-safe); the fetcher is injectable for tests.
import { analyzeRobots } from "@/lib/crawler/robots";
import { safeFetch, SafeFetchError, type SafeFetchOptions, type SafeFetchResult } from "@/lib/crawler/safe-fetch";
import { parseSitemapEntries, type SitemapEntry } from "@/lib/crawler/sitemap";

export const SITEMAP_LIMITS = {
  /** sitemaps.org protocol limits per sitemap file. */
  protocolUrls: 50_000,
  protocolBytes: 50 * 1024 * 1024,
  /** Our own caps for one check. */
  maxChildSitemaps: 10,
  maxTopLevel: 6,
  maxTotalUrls: 50_000,
  maxTotalBytes: 10 * 1024 * 1024,
  budgetMs: 17_000,
  sampleSize: 20,
  sampleBudgetMs: 7_000,
  sampleConcurrency: 5,
  examples: 5,
} as const;

const DAY = 24 * 60 * 60 * 1000;
const STALE_MS = 365 * DAY;

export type Fetcher = (url: string, opts: SafeFetchOptions) => Promise<SafeFetchResult>;

export interface SitemapDoc {
  url: string;
  source: "robots" | "guess" | "index";
  status: number | null;
  finalUrl: string | null;
  kind: "index" | "urlset" | "unknown" | null;
  bytes: number;
  /** <url> (or <sitemap>) entries in the file. */
  entries: number;
  xmlError: string | null;
  error: string | null;
  overUrlLimit: boolean;
  /** Stopped reading at our 10 MB cap; the file may or may not exceed the protocol's 50 MB. */
  tooLargeToRead: boolean;
}

export interface Examples {
  count: number;
  examples: string[];
}

export interface EntryStats {
  total: number;
  withLastmod: number;
  badLastmod: Examples;
  olderThan12Months: number;
  futureLastmod: number;
  nonHttps: Examples;
  otherHost: Examples;
  duplicates: Examples;
  invalid: Examples;
}

export type SampleVerdict = "ok" | "redirect" | "not_found" | "error";

export interface SampleResult {
  url: string;
  status: number | null;
  finalUrl: string | null;
  verdict: SampleVerdict;
  note: string;
}

export type IssueLevel = "fail" | "warn" | "info" | "pass";

export interface SitemapIssue {
  level: IssueLevel;
  title: string;
  fix: string;
}

export interface SitemapCheckReport {
  origin: string;
  siteHost: string;
  robotsStatus: number | null;
  robotsSitemaps: string[];
  docs: SitemapDoc[];
  stats: EntryStats;
  /** We hit a cap (URLs, bytes, child sitemaps or time) and did not read everything. */
  truncated: boolean;
  childSitemapsSkipped: number;
  sample: SampleResult[];
  issues: SitemapIssue[];
}

/* ------------------------------------------------------------------ pure helpers */

function lineAt(xml: string, pos: number): number {
  let n = 1;
  for (let i = xml.indexOf("\n"); i !== -1 && i < pos; i = xml.indexOf("\n", i + 1)) n++;
  return n;
}

const BAD_AMP = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/;

/**
 * Basic XML well-formedness check (one root element, balanced tags, quoted attributes, escaped "&").
 * Returns null when fine, else a short message with the line number. Not a full validating parser.
 */
export function checkXmlWellFormed(input: string): string | null {
  const xml = input.replace(/^﻿/, "");
  const stack: string[] = [];
  let roots = 0;
  let pos = 0;
  const fail = (msg: string, at: number) => `${msg} (line ${lineAt(xml, at)})`;
  while (pos < xml.length) {
    const lt = xml.indexOf("<", pos);
    const text = xml.slice(pos, lt === -1 ? xml.length : lt);
    if (text.trim()) {
      if (stack.length === 0) return fail("Text outside the main element", pos);
      const m = BAD_AMP.exec(text);
      if (m) return fail('A "&" is not escaped. Write it as &amp;', pos + m.index);
    }
    if (lt === -1) break;
    const rest = (s: string, at: number) => xml.startsWith(s, at);
    let end: number;
    if (rest("<!--", lt)) {
      end = xml.indexOf("-->", lt + 4);
      if (end === -1) return fail("A comment is never closed", lt);
      pos = end + 3;
    } else if (rest("<![CDATA[", lt)) {
      end = xml.indexOf("]]>", lt + 9);
      if (end === -1) return fail("A CDATA section is never closed", lt);
      pos = end + 3;
    } else if (rest("<?", lt)) {
      end = xml.indexOf("?>", lt + 2);
      if (end === -1) return fail("A <? ?> instruction is never closed", lt);
      pos = end + 2;
    } else if (rest("<!", lt)) {
      end = xml.indexOf(">", lt + 2);
      if (end === -1) return fail("A <! declaration is never closed", lt);
      pos = end + 1;
    } else if (rest("</", lt)) {
      end = xml.indexOf(">", lt + 2);
      if (end === -1) return fail("A closing tag is never finished", lt);
      const name = xml.slice(lt + 2, end).trim();
      const open = stack.pop();
      if (open !== name) return fail(open ? `</${name}> closes <${open}>` : `</${name}> has no opening tag`, lt);
      pos = end + 1;
    } else {
      // Opening tag: scan to ">" outside quotes.
      let i = lt + 1;
      let quote: string | null = null;
      for (; i < xml.length; i++) {
        const c = xml[i];
        if (quote) {
          if (c === quote) quote = null;
          else if (c === "<") return fail("A \"<\" inside an attribute value", i);
        } else if (c === '"' || c === "'") quote = c;
        else if (c === ">") break;
        else if (c === "<") return fail("A tag is never finished", lt);
      }
      if (i >= xml.length) return fail("A tag is never finished", lt);
      const inner = xml.slice(lt + 1, i);
      const selfClosing = inner.endsWith("/");
      const m = /^([A-Za-z_][\w.:-]*)/.exec(inner);
      if (!m) return fail('A "<" that does not start a tag. Write it as &lt;', lt);
      const attrs = inner.slice(m[1].length, selfClosing ? -1 : undefined);
      if (attrs.trim() && !/^(\s+[^\s=/>]+\s*=\s*("[^"]*"|'[^']*'))*\s*$/.test(attrs)) {
        return fail(`An attribute on <${m[1]}> is not written as name="value"`, lt);
      }
      const amp = BAD_AMP.exec(attrs);
      if (amp) return fail('A "&" is not escaped. Write it as &amp;', lt);
      if (stack.length === 0) {
        roots++;
        if (roots > 1) return fail("More than one main element", lt);
      }
      if (!selfClosing) stack.push(m[1]);
      pos = i + 1;
    }
  }
  if (roots === 0) return "No XML elements found";
  if (stack.length) return `<${stack[stack.length - 1]}> is never closed`;
  return null;
}

const W3C_DATE = /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/;

/** Accumulates per-URL findings across all urlset files of one check. */
export function createEntryAudit(siteHost: string, now: Date = new Date()) {
  const host = siteHost.toLowerCase();
  const seen = new Set<string>();
  const ex = (): Examples => ({ count: 0, examples: [] });
  const stats: EntryStats = {
    total: 0,
    withLastmod: 0,
    badLastmod: ex(),
    olderThan12Months: 0,
    futureLastmod: 0,
    nonHttps: ex(),
    otherHost: ex(),
    duplicates: ex(),
    invalid: ex(),
  };
  const note = (e: Examples, v: string) => {
    e.count++;
    if (e.examples.length < SITEMAP_LIMITS.examples) e.examples.push(v);
  };
  const pageUrls: string[] = [];
  return {
    add(entries: SitemapEntry[]) {
      for (const { loc, lastmod } of entries) {
        stats.total++;
        let u: URL | null = null;
        try {
          u = new URL(loc);
        } catch {
          /* invalid */
        }
        if (!u || (u.protocol !== "http:" && u.protocol !== "https:")) note(stats.invalid, loc);
        else {
          if (u.protocol !== "https:") note(stats.nonHttps, loc);
          if (u.host.toLowerCase() !== host) note(stats.otherHost, loc);
          pageUrls.push(u.href);
        }
        const key = u ? u.href : loc;
        if (seen.has(key)) note(stats.duplicates, loc);
        else seen.add(key);
        if (lastmod) {
          stats.withLastmod++;
          const t = Date.parse(lastmod);
          if (!W3C_DATE.test(lastmod) || Number.isNaN(t)) note(stats.badLastmod, lastmod);
          else if (t > now.getTime() + DAY) stats.futureLastmod++;
          else if (now.getTime() - t > STALE_MS) stats.olderThan12Months++;
        }
      }
    },
    stats: () => stats,
    pageUrls: () => pageUrls,
  };
}

/** Up to `n` URLs spread evenly through the list (first, last and in between). */
export function pickSample<T>(items: T[], n: number = SITEMAP_LIMITS.sampleSize): T[] {
  if (items.length <= n) return items.slice();
  const out: T[] = [];
  const step = (items.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(items[Math.round(i * step)]);
  return out;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** Plain-English findings, worst first. */
export function sitemapIssues(r: Omit<SitemapCheckReport, "issues">): SitemapIssue[] {
  const out: SitemapIssue[] = [];
  const found = r.docs.filter((d) => d.kind === "urlset" || d.kind === "index");
  if (!found.length) {
    out.push({
      level: "fail",
      title: "We couldn't find a sitemap",
      fix: "Most website builders make one for you (check your SEO plugin or settings). Or make one in the Generator tab, upload it as /sitemap.xml and add a Sitemap: line to robots.txt.",
    });
  }
  for (const d of r.docs) {
    if (d.source === "guess" && (d.kind === null || d.kind === "unknown")) continue;
    if (d.error) out.push({ level: "fail", title: `${d.url} could not be read: ${d.error}`, fix: "Open it in your browser. A sitemap must load with status 200 and contain XML." });
    else if (d.kind === "unknown") out.push({ level: "fail", title: `${d.url} is not a sitemap`, fix: "It loaded, but has no <urlset> or <sitemapindex>. Point to the real sitemap file instead." });
    if (d.xmlError) out.push({ level: "fail", title: `Invalid XML in ${d.url}: ${d.xmlError}`, fix: "Crawlers may reject a broken file. Fix the line shown, or regenerate the sitemap with your SEO plugin." });
    if (d.overUrlLimit) out.push({ level: "fail", title: `${d.url} lists ${plural(d.entries, "URL")}`, fix: "The limit is 50,000 URLs per file. Split it into several sitemaps and list them in a sitemap index." });
    if (d.tooLargeToRead) out.push({ level: "warn", title: `${d.url} is over 10 MB, so we stopped reading it`, fix: "The protocol limit is 50 MB uncompressed. Smaller files (split by section) are easier to check and quicker to fetch." });
  }
  if (found.length && r.robotsSitemaps.length === 0) {
    out.push({ level: "warn", title: "robots.txt doesn't list your sitemap", fix: `Add this line to robots.txt: Sitemap: ${found[0].finalUrl ?? found[0].url}` });
  }
  const s = r.stats;
  if (s.invalid.count) out.push({ level: "fail", title: `${plural(s.invalid.count, "entry is", "entries are")} not a full web address`, fix: "Every <loc> must be a complete address starting with https://." });
  if (s.otherHost.count) out.push({ level: "warn", title: `${plural(s.otherHost.count, "URL")} on a different host than ${r.siteHost}`, fix: "List only pages on this exact host (www and non-www count as different). Use the version your site redirects to." });
  if (s.nonHttps.count) out.push({ level: "warn", title: `${plural(s.nonHttps.count, "URL")} use http:// instead of https://`, fix: "List the https:// address of each page, the one visitors actually land on." });
  if (s.duplicates.count) out.push({ level: "warn", title: `${plural(s.duplicates.count, "duplicate URL")}`, fix: "List each page once. Duplicates waste crawl time and suggest the sitemap is built from mixed sources." });
  if (s.badLastmod.count) out.push({ level: "warn", title: `${plural(s.badLastmod.count, "lastmod date")} in the wrong format`, fix: "Use W3C dates such as 2026-11-09 or 2026-11-09T10:30:00+05:30." });
  if (s.futureLastmod) out.push({ level: "warn", title: `${plural(s.futureLastmod, "lastmod date")} in the future`, fix: "Set lastmod to when the page really last changed. Google ignores lastmod values it can't trust." });
  if (s.total && s.withLastmod < s.total) {
    const pct = Math.round((s.withLastmod / s.total) * 100);
    out.push({ level: pct < 50 ? "warn" : "info", title: `${pct}% of URLs have a lastmod date`, fix: "Google uses lastmod when it is consistently accurate. Add it from your page's real last-changed date." });
  }
  if (s.olderThan12Months) out.push({ level: "info", title: `${plural(s.olderThan12Months, "URL")} not updated in over 12 months`, fix: "Not an error. Review old pages that still matter: refresh facts and prices, then update lastmod." });
  const nf = r.sample.filter((x) => x.verdict === "not_found");
  const rd = r.sample.filter((x) => x.verdict === "redirect");
  const er = r.sample.filter((x) => x.verdict === "error");
  if (nf.length) out.push({ level: "fail", title: `${nf.length} of ${r.sample.length} sampled URLs are missing (404/410)`, fix: "Remove deleted pages from the sitemap, or restore them. A sitemap should only list live pages." });
  if (rd.length) out.push({ level: "warn", title: `${rd.length} of ${r.sample.length} sampled URLs redirect`, fix: "List the final address each page redirects to, not the old one." });
  if (er.length) out.push({ level: "warn", title: `${er.length} of ${r.sample.length} sampled URLs gave an error or didn't load`, fix: "Open them in your browser. Pages in a sitemap should load with status 200." });
  if (r.truncated) out.push({ level: "info", title: "We checked part of your sitemaps", fix: `We stop at ${plural(SITEMAP_LIMITS.maxChildSitemaps, "child sitemap")}, 50,000 URLs, 10 MB or 17 seconds. The full free check covers more.` });
  if (found.length && !out.some((i) => i.level === "fail" || i.level === "warn")) {
    out.push({ level: "pass", title: "Your sitemap looks healthy", fix: "Nothing to fix. Keep it updated when you add or remove pages." });
  }
  const order: Record<IssueLevel, number> = { fail: 0, warn: 1, info: 2, pass: 3 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

/* ------------------------------------------------------------------ network */

function errorText(e: unknown): string {
  if (e instanceof SafeFetchError) {
    if (e.code === "timeout") return "it took too long to load";
    if (e.code === "too_large") return "it is too large";
    if (e.code === "blocked" || e.code === "invalid_url") return "it is not a public web address";
    if (e.code === "dns_failed") return "the address could not be found";
    if (e.code === "too_many_redirects") return "it redirects too many times";
  }
  return "the request failed";
}

async function checkSampleUrl(fetcher: Fetcher, url: string, deadline: number): Promise<SampleResult> {
  const timeoutMs = Math.min(6_000, deadline - Date.now());
  if (timeoutMs < 300) return { url, status: null, finalUrl: null, verdict: "error", note: "Not checked (time limit reached)" };
  try {
    const res = await fetcher(url, { maxBytes: 1024 * 1024, timeoutMs, maxRedirects: 5 });
    const redirected = res.redirectChain.length > 0 && res.finalUrl !== url;
    if (res.status === 404 || res.status === 410) return { url, status: res.status, finalUrl: res.finalUrl, verdict: "not_found", note: `Missing (HTTP ${res.status})` };
    if (res.status >= 400) return { url, status: res.status, finalUrl: res.finalUrl, verdict: "error", note: `Error (HTTP ${res.status})` };
    if (redirected) return { url, status: res.status, finalUrl: res.finalUrl, verdict: "redirect", note: `Redirects to ${res.finalUrl}` };
    return { url, status: res.status, finalUrl: res.finalUrl, verdict: "ok", note: `OK (HTTP ${res.status})` };
  } catch (e) {
    // A page over our 1 MB read cap did load; we just stopped reading it.
    if (e instanceof SafeFetchError && e.code === "too_large") return { url, status: null, finalUrl: null, verdict: "ok", note: "Loads (large page, over 1 MB)" };
    return { url, status: null, finalUrl: null, verdict: "error", note: `Didn't load: ${errorText(e)}` };
  }
}

/** Run a full sitemap check for one site origin (e.g. "https://example.com"). */
export async function runSitemapCheck(origin: string, deps: { fetch?: Fetcher; now?: Date } = {}): Promise<SitemapCheckReport> {
  const fetcher = deps.fetch ?? safeFetch;
  const base = origin.replace(/\/$/, "");
  const start = Date.now();
  const deadline = start + SITEMAP_LIMITS.budgetMs;

  // 1. robots.txt Sitemap: lines (also tells us the host the site really lives on after redirects).
  let robotsStatus: number | null = null;
  let robotsSitemaps: string[] = [];
  let siteHost = new URL(base).host;
  try {
    const res = await fetcher(`${base}/robots.txt`, { maxBytes: 512 * 1024, timeoutMs: 5_000 });
    robotsStatus = res.status;
    if (res.status >= 200 && res.status < 300) {
      siteHost = new URL(res.finalUrl).host;
      robotsSitemaps = analyzeRobots(res.finalUrl, res.body, res.status).sitemaps;
    }
  } catch {
    /* no robots.txt → guesses only */
  }

  type Item = { url: string; source: SitemapDoc["source"] };
  const queue: Item[] = [];
  const seen = new Set<string>();
  const enqueue = (url: string, source: Item["source"]) => {
    let u: string;
    try {
      const parsed = new URL(url, `${base}/`);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
      parsed.hash = "";
      u = parsed.href;
    } catch {
      return false;
    }
    if (seen.has(u)) return false;
    seen.add(u);
    queue.push({ url: u, source });
    return true;
  };
  robotsSitemaps.slice(0, SITEMAP_LIMITS.maxTopLevel - 2).forEach((u) => enqueue(u, "robots"));
  const siteBase = `${new URL(base).protocol}//${siteHost}`;
  enqueue(`${siteBase}/sitemap.xml`, "guess");
  enqueue(`${siteBase}/sitemap_index.xml`, "guess");

  const audit = createEntryAudit(siteHost, deps.now ?? new Date());
  const docs: SitemapDoc[] = [];
  let bytesUsed = 0;
  let children = 0;
  let childSkipped = 0;
  let truncated = false;

  while (queue.length) {
    const item = queue.shift()!;
    const remainingMs = deadline - Date.now();
    const remainingBytes = SITEMAP_LIMITS.maxTotalBytes - bytesUsed;
    const remainingUrls = SITEMAP_LIMITS.maxTotalUrls - audit.stats().total;
    if (remainingMs < 500 || remainingBytes < 1024 || remainingUrls <= 0) {
      truncated = true;
      break;
    }
    const doc: SitemapDoc = {
      url: item.url, source: item.source, status: null, finalUrl: null, kind: null, bytes: 0, entries: 0,
      xmlError: null, error: null, overUrlLimit: false, tooLargeToRead: false,
    };
    try {
      const res = await fetcher(item.url, { maxBytes: remainingBytes, timeoutMs: Math.min(10_000, remainingMs) });
      doc.status = res.status;
      doc.finalUrl = res.finalUrl;
      if (res.status < 200 || res.status >= 300) {
        doc.error = `HTTP ${res.status}`;
      } else if (!res.body) {
        const type = res.headers.get("content-type") ?? "";
        doc.error = /gzip|octet-stream/i.test(type) || /\.gz$/i.test(res.finalUrl)
          ? "it is a compressed (.gz) file, which this tool can't open. Check the uncompressed version"
          : "the file is empty or not text";
      } else {
        doc.bytes = new TextEncoder().encode(res.body).length;
        bytesUsed += doc.bytes;
        const looksXml = /^\s*(﻿)?\s*<(\?xml|urlset|sitemapindex|[\w-]+:urlset)/i.test(res.body);
        const parsed = parseSitemapEntries(res.body, Math.max(0, remainingUrls));
        doc.kind = parsed.kind;
        doc.entries = parsed.total;
        doc.overUrlLimit = parsed.total > SITEMAP_LIMITS.protocolUrls;
        if (parsed.kind !== "unknown" || looksXml) doc.xmlError = checkXmlWellFormed(res.body);
        if (parsed.kind === "urlset") {
          audit.add(parsed.entries);
          if (parsed.total > parsed.entries.length) truncated = true;
        } else if (parsed.kind === "index") {
          for (const e of parsed.entries) {
            if (children >= SITEMAP_LIMITS.maxChildSitemaps) {
              childSkipped++;
              truncated = true;
            } else if (enqueue(e.loc, "index")) children++;
          }
        }
      }
    } catch (e) {
      if (e instanceof SafeFetchError && e.code === "too_large") {
        doc.tooLargeToRead = true;
        truncated = true;
      }
      doc.error = errorText(e);
    }
    // Guessed locations that don't exist are not news; anything else is reported.
    if (item.source === "guess" && (doc.kind === null || doc.kind === "unknown") && !doc.tooLargeToRead) continue;
    docs.push(doc);
  }
  if (queue.length) truncated = true;

  // 2. Sample status check of up to 20 page URLs.
  const sampleDeadline = Date.now() + SITEMAP_LIMITS.sampleBudgetMs;
  const targets = pickSample(Array.from(new Set(audit.pageUrls())), SITEMAP_LIMITS.sampleSize);
  const sample: SampleResult[] = new Array(targets.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(SITEMAP_LIMITS.sampleConcurrency, targets.length) }, async () => {
      while (next < targets.length) {
        const i = next++;
        sample[i] = await checkSampleUrl(fetcher, targets[i], sampleDeadline);
      }
    }),
  );

  const partial = { origin: base, siteHost, robotsStatus, robotsSitemaps, docs, stats: audit.stats(), truncated, childSitemapsSkipped: childSkipped, sample };
  return { ...partial, issues: sitemapIssues(partial) };
}
