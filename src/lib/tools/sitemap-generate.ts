// Sitemap generator (pure, runs in the browser): a pasted list of page addresses → a valid sitemaps.org urlset.
// Every address must be an absolute http(s) URL on the same host as the first valid one; duplicates are dropped.

export const GENERATOR_MAX_URLS = 1_000;
/** sitemaps.org: a <loc> must be shorter than 2,048 characters. */
export const SITEMAP_LOC_MAX = 2_047;

export interface GeneratorRejected {
  line: number;
  value: string;
  reason: string;
}

export interface GeneratedSitemap {
  xml: string | null;
  host: string | null;
  urls: string[];
  rejected: GeneratorRejected[];
  duplicates: number;
  /** Lines past the 1,000-address limit that were left out. */
  overLimit: number;
}

/** Escape the five characters sitemaps.org requires to be entity-escaped inside <loc>. */
export function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;");
}

function normalize(raw: string): { url: URL } | { reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { reason: "Not a full web address. Start it with https://" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { reason: "Only http:// and https:// addresses can go in a sitemap." };
  if (url.username || url.password) return { reason: "Addresses with a username or password can't go in a sitemap." };
  url.hash = "";
  if (url.href.length > SITEMAP_LOC_MAX) return { reason: "Too long: sitemap addresses must be under 2,048 characters." };
  return { url };
}

/**
 * Build sitemap.xml from one address per line (blank lines and lines starting with # are skipped).
 * `lastmod` (YYYY-MM-DD) is added to every entry when given.
 */
export function generateSitemap(input: string, opts: { lastmod?: string } = {}): GeneratedSitemap {
  const lastmod = opts.lastmod && /^\d{4}-\d{2}-\d{2}$/.test(opts.lastmod) ? opts.lastmod : null;
  const urls: string[] = [];
  const seen = new Set<string>();
  const rejected: GeneratorRejected[] = [];
  let host: string | null = null;
  let duplicates = 0;
  let overLimit = 0;

  input.split(/\r\n|\r|\n/).forEach((line, i) => {
    const value = line.trim();
    if (!value || value.startsWith("#")) return;
    const n = normalize(value);
    if ("reason" in n) {
      rejected.push({ line: i + 1, value, reason: n.reason });
      return;
    }
    const h = n.url.host.toLowerCase();
    if (host === null) host = h;
    else if (h !== host) {
      rejected.push({ line: i + 1, value, reason: `Different website (${h}). A sitemap may only list pages on ${host}.` });
      return;
    }
    const href = n.url.href;
    if (seen.has(href)) {
      duplicates++;
      return;
    }
    if (urls.length >= GENERATOR_MAX_URLS) {
      overLimit++;
      return;
    }
    seen.add(href);
    urls.push(href);
  });

  const xml = urls.length
    ? [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map((u) => `  <url>\n    <loc>${xmlEscape(u)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}\n  </url>`),
        "</urlset>",
        "",
      ].join("\n")
    : null;
  return { xml, host, urls, rejected, duplicates, overLimit };
}
