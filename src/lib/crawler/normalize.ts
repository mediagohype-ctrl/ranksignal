// Canonical URL normalisation used for crawl dedupe, Resource.canonicalUrl and link matching.

const TRACKING_PARAMS = new Set([
  "gclid", "fbclid", "msclkid", "dclid", "yclid", "gbraid", "wbraid", "igshid", "mc_cid", "mc_eid",
  "_ga", "_gl", "_hsenc", "_hsmi", "ref_src", "twclid", "li_fat_id",
]);

export type TrailingSlashPolicy = "keep" | "strip";

export interface NormalizeOptions {
  /** "strip" removes a trailing slash from non-root paths (dedupe key); "keep" leaves paths as-is. */
  trailingSlash?: TrailingSlashPolicy;
}

/**
 * Normalise an absolute or relative URL. Returns null for non-http(s) or unparsable input.
 * - lowercases scheme/host (WHATWG URL), drops default ports and fragments
 * - removes utm_* and click-id tracking params, sorts remaining query params
 * - collapses duplicate slashes in the path; optional trailing-slash stripping
 */
export function normalizeUrl(input: string, base?: string, opts: NormalizeOptions = {}): string | null {
  let url: URL;
  try {
    url = base ? new URL(input.trim(), base) : new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.hash = "";
  url.username = "";
  url.password = "";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) url.port = "";

  let path = url.pathname.replace(/\/{2,}/g, "/");
  if (opts.trailingSlash === "strip" && path.length > 1 && path.endsWith("/")) path = path.replace(/\/+$/, "") || "/";
  url.pathname = path;

  const kept: [string, string][] = [];
  url.searchParams.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k.startsWith("utm_") || TRACKING_PARAMS.has(k)) return;
    kept.push([key, value]);
  });
  kept.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1));
  url.search = "";
  for (const [k, v] of kept) url.searchParams.append(k, v);
  return url.toString();
}

/** Dedupe key: normalised with trailing slash stripped. */
export function urlKey(input: string, base?: string): string | null {
  return normalizeUrl(input, base, { trailingSlash: "strip" });
}

/** Host with a leading "www." removed — treats example.com and www.example.com as one site. */
export function siteHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

/** True when `url` belongs to one of the allowed site hosts (www-insensitive). */
export function isSameSite(url: string, allowedHosts: Iterable<string>): boolean {
  let host: string;
  try {
    host = siteHost(new URL(url).hostname);
  } catch {
    return false;
  }
  for (const h of allowedHosts) if (siteHost(h) === host) return true;
  return false;
}

const SKIP_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|pdf|zip|gz|tgz|rar|7z|mp3|mp4|m4a|mov|avi|wmv|webm|ogg|wav|woff2?|ttf|eot|otf|css|js|mjs|map|json|xml|rss|atom|exe|dmg|apk|iso|docx?|xlsx?|pptx?|csv)$/i;

/** Heuristic: is this URL likely an HTML page worth crawling? */
export function looksLikePage(url: string): boolean {
  try {
    return !SKIP_EXTENSIONS.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// What counts as a page of its own in a website check (audit fix 25). Shop filters, sort orders, searches and
// account screens are the same page with a different view; they must not be read (or get Google headlines) as
// separate pages. Used by the crawl frontier only — normalizeUrl() itself is unchanged.

/** Query parameters that only change how a page is shown (never which page it is). Lowercase. */
const VIEW_PARAMS = new Set([
  "sort", "sortby", "sort_by", "sort-by", "order", "orderby", "order_by", "dir", "direction",
  "category", "categories", "tag", "tags", "color", "colour", "size", "brand", "material", "rating", "availability",
  "view", "tab", "q", "query", "search", "s", "keyword", "keywords",
  "pagesize", "page-size", "page_size", "per_page", "perpage", "per-page", "limit",
  "ref", "referrer", "variant", "currency", "minprice", "maxprice", "min_price", "max_price",
  "add-to-cart", "add_to_cart", "replytocom", "print", "amp", "sessionid", "sid", "phpsessid", "srsltid",
]);
/** Prefixes of view-only parameters: filter[color], filter_size, price_min, pf_t_… (Shopify), utm_… */
const VIEW_PARAM_PREFIX = /^(filter|price|pf_|facet|refine|utm_|sort\[)/;

/**
 * Parameters that pick real content and are always kept, whatever else is on the address:
 * ?page=2 (pagination), ?p=123 / ?page_id=7 (old WordPress), ?id=, ?post=, ?product=, ?article=, ?lang=.
 */
const CONTENT_PARAMS = new Set(["page", "paged", "p", "page_id", "id", "post", "post_id", "product", "product_id", "article", "item", "lang", "language", "v", "cat"]);

export function isViewParam(name: string): boolean {
  const k = name.toLowerCase();
  if (CONTENT_PARAMS.has(k)) return false;
  return VIEW_PARAMS.has(k) || VIEW_PARAM_PREFIX.test(k);
}

/**
 * The page behind a filter / sort / search link: "/shop?category=Fans&sort=newest&page=2" → "/shop?page=2".
 * Returns the input unchanged (normalised) when nothing was dropped; null for an unusable address.
 */
export function stripViewParams(input: string, base?: string): string | null {
  const n = normalizeUrl(input, base);
  if (!n) return null;
  const url = new URL(n);
  if (!url.search) return n;
  const kept: [string, string][] = [];
  let dropped = false;
  url.searchParams.forEach((value, key) => {
    if (isViewParam(key)) dropped = true;
    else kept.push([key, value]);
  });
  if (!dropped) return n;
  url.search = "";
  for (const [k, v] of kept) url.searchParams.append(k, v);
  return url.toString();
}

/** Screens only a signed-in visitor uses: never a page Google should list. First path part, after an optional language part. */
const PRIVATE_AREA =
  /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:account|accounts|my-account|myaccount|cart|basket|checkout|checkouts|login|log-in|signin|sign-in|logout|log-out|signout|sign-out|register|signup|sign-up|wishlist|wishlists|orders|order-tracking|track-order|password|forgot-password|reset-password|lost-password|wp-admin|wp-login\.php|admin)(?:[/.]|$)/i;

export function isPrivateAreaUrl(url: string): boolean {
  try {
    return PRIVATE_AREA.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

export type CrawlSkipReason = "filter" | "account" | "duplicate";
/** Links a website check did not read as pages of their own, by reason (stored in SiteContext.skipped). */
export type CrawlSkipCounts = Record<CrawlSkipReason, number>;

export type CrawlTarget = { url: string; skipped: null | "filter" } | { url: null; skipped: "account" };

/**
 * Decide what the crawler does with a discovered same-site link:
 * - account / cart / checkout / login screens → not read at all ("account");
 * - filter / sort / search links → read the page behind them once ("filter", with the base page's address);
 * - everything else → read as it is.
 */
export function crawlTarget(input: string, base?: string): CrawlTarget | null {
  const n = normalizeUrl(input, base);
  if (!n) return null;
  if (isPrivateAreaUrl(n)) return { url: null, skipped: "account" };
  const stripped = stripViewParams(n) ?? n;
  return { url: stripped, skipped: stripped === n ? null : "filter" };
}

/**
 * The page says its main version is the SAME path without (some of) its query string, e.g.
 * /shop?colour=red → canonical /shop. A safe duplicate: reading it as its own page adds nothing.
 */
export function isQueryVariantOf(pageUrl: string, canonical: string | null | undefined): boolean {
  if (!canonical) return false;
  try {
    const page = new URL(pageUrl);
    const target = new URL(canonical, pageUrl);
    if (!page.search || siteHost(page.hostname) !== siteHost(target.hostname)) return false;
    const path = (u: URL) => u.pathname.replace(/\/+$/, "") || "/";
    if (path(page) !== path(target)) return false;
    return (urlKey(target.toString()) ?? "").replace(/^https?:/, "") !== (urlKey(page.toString()) ?? "").replace(/^https?:/, "");
  } catch {
    return false;
  }
}
