// Pure URL classification shared by the crawler (priority) and the report engine (key pages, trust pages).
import { urlKey } from "@/lib/crawler/normalize";

const LOCALE = "(?:[a-z]{2}(?:-[a-z]{2})?\\/)?";
const KEY_PAGE_RE = new RegExp(
  `^\\/${LOCALE}(about|about-us|company|team|contact|contact-us|pricing|plans|prices|services?|products?|solutions|features|shop|store|blog|news|articles|resources|faq|faqs|help|support|locations?|reviews|testimonials|case-studies|portfolio|work)(?:\\.html?|\\.php)?\\/?$`,
  "i",
);
const UTILITY_RE = /\/(contact|contact-us|privacy|privacy-policy|terms|tos|legal|cookie|cookies|login|log-in|signin|sign-in|signup|sign-up|register|cart|checkout|account|search|404|thank-you|thanks|sitemap)(\/|\.|-|$)/i;
const ARTICLE_RE = /\/(blog|news|articles?|posts?|guides?|insights|resources|learn|stories|library|knowledge|tutorials?)\/[^/]+/i;

const pathOf = (url: string): string | null => {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
};

export function isHomeUrl(url: string): boolean {
  const p = pathOf(url);
  return p !== null && (p === "/" || /^\/(index\.(html?|php))?$/i.test(p) || /^\/[a-z]{2}(-[a-z]{2})?\/?$/i.test(p));
}
/** Key business pages: about, contact, pricing, services/products, blog index, FAQ... */
export function isKeyPageUrl(url: string): boolean {
  const p = pathOf(url);
  return p !== null && KEY_PAGE_RE.test(p);
}
/** Pages that are naturally short (contact, legal, auth, cart) — excluded from thin-content checks. */
export function isUtilityUrl(url: string): boolean {
  const p = pathOf(url);
  return p !== null && UTILITY_RE.test(p);
}
/** Blog post / article-style URL (a page below a blog/news/guides section). */
export function isArticleUrl(url: string): boolean {
  const p = pathOf(url);
  return p !== null && ARTICLE_RE.test(p);
}

/**
 * Crawl priority (lower = sooner): homepage 0, key business pages 1, homepage navigation 2,
 * everything else 3 + path depth (+2 for query strings). Keeps small crawls on the pages owners care about.
 */
export function crawlPriority(url: string, navLinkKeys: Set<string> = new Set()): number {
  const p = pathOf(url);
  if (p === null) return 99;
  if (p === "/" || /^\/(index\.(html?|php))?$/i.test(p)) return 0;
  if (KEY_PAGE_RE.test(p)) return 1;
  const k = urlKey(url);
  if (k && navLinkKeys.has(k)) return 2;
  const depth = p.split("/").filter(Boolean).length;
  return 3 + Math.min(depth, 10) + (url.includes("?") ? 2 : 0);
}
