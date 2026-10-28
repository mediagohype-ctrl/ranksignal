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
