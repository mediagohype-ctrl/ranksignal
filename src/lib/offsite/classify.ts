// What kind of website is this? (pure, client-safe)
//
// AI answers link to three very different kinds of website, and the advice for each is different:
//   listing     — a real directory, marketplace, review site, social network, Q&A site or news site (allow-list
//                 below). You can create a profile / be listed / join the conversation there.
//   competitor  — another business in the same trade: one of the project's saved competitors, a business the AI
//                 named in its answers, or a site that looks like a business rather than a list. You can NEVER
//                 "get listed on" a competitor, so we never say that.
//   website     — anything else AI links to (a blog, an article, a "best of" list). The honest advice is "see why
//                 AI links to this page", and "ask to be included" only when the page looks like a list or article.
import type { OffsiteType } from "./types";

export type ListingGroup = "directory" | "marketplace" | "review" | "social" | "qa" | "news" | "reference";

export interface ListingSite {
  /** Registrable domain (or host) this entry matches, including subdomains. */
  match: string;
  name: string;
  group: ListingGroup;
  type: OffsiteType;
}

const L = (match: string, name: string, group: ListingGroup, type: OffsiteType): ListingSite => ({ match, name, group, type });

/** Real places a business can have a profile, a listing, reviews or a mention. Anything not here is NOT a listing site. */
export const LISTING_SITES: ListingSite[] = [
  // Google Business Profile (checked before the "google.com is not a place" rule)
  L("business.google.com", "Google Business Profile", "directory", "directory"),
  L("maps.google.com", "Google Business Profile", "directory", "directory"),
  L("g.page", "Google Business Profile", "directory", "directory"),
  // Indian and global directories
  L("justdial.com", "Justdial", "directory", "directory"),
  L("indiamart.com", "IndiaMART", "marketplace", "directory"),
  L("sulekha.com", "Sulekha", "directory", "directory"),
  L("tradeindia.com", "TradeIndia", "marketplace", "directory"),
  L("exportersindia.com", "ExportersIndia", "marketplace", "directory"),
  L("yellowpages.in", "Yellow Pages India", "directory", "directory"),
  L("yellowpages.com", "Yellow Pages", "directory", "directory"),
  L("yelp.com", "Yelp", "directory", "directory"),
  L("bingplaces.com", "Bing Places", "directory", "directory"),
  L("businessconnect.apple.com", "Apple Business Connect", "directory", "directory"),
  L("practo.com", "Practo", "directory", "directory"),
  L("zomato.com", "Zomato", "directory", "directory"),
  L("swiggy.com", "Swiggy", "marketplace", "directory"),
  L("magicbricks.com", "MagicBricks", "marketplace", "directory"),
  L("99acres.com", "99acres", "marketplace", "directory"),
  L("urbancompany.com", "Urban Company", "marketplace", "directory"),
  // Marketplaces
  L("amazon.in", "Amazon", "marketplace", "directory"),
  L("amazon.com", "Amazon", "marketplace", "directory"),
  L("flipkart.com", "Flipkart", "marketplace", "directory"),
  L("meesho.com", "Meesho", "marketplace", "directory"),
  L("myntra.com", "Myntra", "marketplace", "directory"),
  L("nykaa.com", "Nykaa", "marketplace", "directory"),
  L("etsy.com", "Etsy", "marketplace", "directory"),
  L("producthunt.com", "Product Hunt", "directory", "directory"),
  // Agency and software directories / review sites
  L("clutch.co", "Clutch", "review", "review_platform"),
  L("goodfirms.co", "GoodFirms", "review", "review_platform"),
  L("designrush.com", "DesignRush", "review", "review_platform"),
  L("sortlist.com", "Sortlist", "review", "review_platform"),
  L("themanifest.com", "The Manifest", "review", "review_platform"),
  L("g2.com", "G2", "review", "review_platform"),
  L("capterra.com", "Capterra", "review", "review_platform"),
  L("capterra.in", "Capterra", "review", "review_platform"),
  L("getapp.com", "GetApp", "review", "review_platform"),
  L("softwareadvice.com", "Software Advice", "review", "review_platform"),
  L("softwaresuggest.com", "SoftwareSuggest", "review", "review_platform"),
  L("trustpilot.com", "Trustpilot", "review", "review_platform"),
  L("tripadvisor.com", "Tripadvisor", "review", "review_platform"),
  L("tripadvisor.in", "Tripadvisor", "review", "review_platform"),
  L("glassdoor.com", "Glassdoor", "review", "review_platform"),
  L("glassdoor.co.in", "Glassdoor", "review", "review_platform"),
  L("ambitionbox.com", "AmbitionBox", "review", "review_platform"),
  L("mouthshut.com", "MouthShut", "review", "review_platform"),
  // Social and business profiles
  L("linkedin.com", "LinkedIn", "social", "social_profile"),
  L("facebook.com", "Facebook", "social", "social_profile"),
  L("instagram.com", "Instagram", "social", "social_profile"),
  L("youtube.com", "YouTube", "social", "social_profile"),
  L("youtu.be", "YouTube", "social", "social_profile"),
  L("x.com", "X (Twitter)", "social", "social_profile"),
  L("twitter.com", "X (Twitter)", "social", "social_profile"),
  L("pinterest.com", "Pinterest", "social", "social_profile"),
  L("behance.net", "Behance", "social", "social_profile"),
  L("dribbble.com", "Dribbble", "social", "social_profile"),
  L("github.com", "GitHub", "social", "social_profile"),
  // Questions and communities
  L("reddit.com", "Reddit", "qa", "forum_thread"),
  L("quora.com", "Quora", "qa", "forum_thread"),
  L("stackoverflow.com", "Stack Overflow", "qa", "forum_thread"),
  // Reference
  L("wikipedia.org", "Wikipedia", "reference", "wikidata"),
  L("wikidata.org", "Wikidata", "reference", "wikidata"),
  L("crunchbase.com", "Crunchbase", "reference", "wikidata"),
  // News and publications
  L("medium.com", "Medium", "news", "pr_mention"),
  L("forbes.com", "Forbes", "news", "pr_mention"),
  L("inc42.com", "Inc42", "news", "pr_mention"),
  L("yourstory.com", "YourStory", "news", "pr_mention"),
  L("economictimes.indiatimes.com", "The Economic Times", "news", "pr_mention"),
  L("economictimes.com", "The Economic Times", "news", "pr_mention"),
  L("timesofindia.indiatimes.com", "The Times of India", "news", "pr_mention"),
  L("indiatimes.com", "Indiatimes", "news", "pr_mention"),
  L("hindustantimes.com", "Hindustan Times", "news", "pr_mention"),
  L("thehindu.com", "The Hindu", "news", "pr_mention"),
  L("indianexpress.com", "The Indian Express", "news", "pr_mention"),
  L("ndtv.com", "NDTV", "news", "pr_mention"),
  L("livemint.com", "Mint", "news", "pr_mention"),
  L("moneycontrol.com", "Moneycontrol", "news", "pr_mention"),
  L("business-standard.com", "Business Standard", "news", "pr_mention"),
  L("techcrunch.com", "TechCrunch", "news", "pr_mention"),
  L("entrepreneur.com", "Entrepreneur", "news", "pr_mention"),
];

/** Search engines, AI vendors and plumbing: not places, not competitors, never suggested. */
const NOT_A_PLACE = [
  "google.com", "google.co.in", "bing.com", "duckduckgo.com", "openai.com", "chatgpt.com", "perplexity.ai", "anthropic.com", "claude.ai",
  "x.ai", "vertexaisearch.cloud.google.com", "amazonaws.com", "cloudfront.net", "googleusercontent.com", "gstatic.com", "archive.org",
];

/** "https://www.G2.com/x" / "www.g2.com" → "g2.com". */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let v = String(input).trim().toLowerCase();
  if (!v) return null;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//.test(v)) v = new URL(v).hostname;
  } catch {
    return null;
  }
  v = v.split("/")[0]!.split(":")[0]!.replace(/^www\./, "").replace(/\.$/, "");
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(v) ? v : null;
}

/** a.com matches a.com and any subdomain of it (either direction). */
export function sameSite(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

const under = (domain: string, root: string) => domain === root || domain.endsWith(`.${root}`);

export function listingSiteFor(domain: string): ListingSite | null {
  return LISTING_SITES.find((k) => under(domain, k.match)) ?? null;
}

const TWO_LEVEL_TLD = /\.(?:co|com|net|org|gov|ac|edu)\.[a-z]{2}$/;

/** The business part of a domain: "www.social-beat.co.in" → "social-beat". */
export function siteLabel(domain: string): string {
  const parts = domain.replace(/^www\./, "").split(".");
  const n = TWO_LEVEL_TLD.test(domain) ? 3 : 2;
  return parts[Math.max(0, parts.length - n)] ?? parts[0] ?? "";
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Finds a business name in AI answer text from its domain label, allowing spaces or hyphens between letters:
 * "socialbeat" matches "Social Beat" and returns it as written. Labels shorter than 4 letters are ignored.
 */
export function nameInText(label: string, texts: string[]): string | null {
  const letters = squash(label);
  if (letters.length < 4) return null;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${letters.split("").map(escapeRe).join("[\\s.-]?")}(?![\\p{L}\\p{N}])`, "iu");
  for (const t of texts) {
    const m = typeof t === "string" ? re.exec(t) : null;
    if (m) return m[0].replace(/\s+/g, " ").trim();
  }
  return null;
}

/** "social-beat" → "Social Beat" (used when the AI answers didn't spell the name). */
export function nameFromLabel(label: string): string {
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

const LIST_LIKE =
  /(?:^|[/\-_ .])(?:best|top|lists?|vs|versus|compar\w*|reviews?|rank(?:ed|ing|ings)?|guides?|blogs?|articles?|news|stor(?:y|ies)|posts?|magazine|insights?|resources?|alternatives?|20\d\d)(?:$|[/\-_ .])|\btop[- ]?\d+\b|\b\d+[- ]best\b/i;

/** Does the linked page look like a list or an article (rather than a business's own home / service page)? */
export function looksLikeListOrArticle(url: string | null | undefined, title?: string | null): boolean {
  let path = "";
  if (url) {
    try {
      path = decodeURIComponent(new URL(url).pathname);
    } catch {
      path = "";
    }
  }
  if (path && path !== "/" && LIST_LIKE.test(path)) return true;
  return !!title && LIST_LIKE.test(title);
}

/** The home page or a top-level page ("/", "/services") — what a business's own site is usually linked by. */
export function isHomeOrTopPage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).pathname.split("/").filter(Boolean).length <= 1;
  } catch {
    return false;
  }
}

const TRADE_STOP =new Set(["and", "the", "for", "with", "your", "our", "from", "best", "online", "india", "services", "service", "company", "business", "products", "product"]);

/** Words that describe the trade ("digital marketing agency" → marketing, agency, digital), for matching domain names. */
export function tradeWordsOf(texts: (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const t of texts) {
    for (const w of (t ?? "").toLowerCase().split(/[^a-z]+/)) {
      if (w.length >= 5 && !TRADE_STOP.has(w)) out.add(w);
    }
  }
  return [...out];
}

export interface ClassifyContext {
  /** The business's own website(s). */
  ownedDomains?: string[];
  /** The project's saved competitors. */
  competitors?: { name?: string | null; domain?: string | null; aliases?: string[] | null }[];
  /** Names of businesses the AI recommended in answers to this project's questions. */
  namedBrands?: string[];
  /** The AI answers themselves; a website whose business name appears in them is a business the AI named. */
  answerTexts?: string[];
  /** Words describing what the business sells (see tradeWordsOf). */
  tradeWords?: string[];
}

export type CitedKind = "own" | "listing" | "competitor" | "website" | "ignore";
export type CompetitorReason = "saved" | "named" | "same_trade";

export interface CitedSite {
  domain: string;
  kind: CitedKind;
  /** Display name: the listing site's name, the business's name, or the domain. */
  name: string;
  type: OffsiteType;
  listing?: ListingSite;
  /** Why we treat it as a competitor. */
  reason?: CompetitorReason;
  /** The linked page looks like a list or article (only then is "ask to be included" fair advice). */
  listLike: boolean;
}

export interface CitedPage {
  url?: string | null;
  title?: string | null;
}

/** Classifies one website an AI answer linked to. `pages` are the exact pages that were linked (optional). */
export function classifyCitedSite(input: string, ctx: ClassifyContext = {}, pages: CitedPage[] = []): CitedSite {
  const domain = normalizeDomain(input) ?? String(input ?? "").trim().toLowerCase();
  const listLike = pages.some((p) => looksLikeListOrArticle(p.url, p.title));
  const base = { domain, listLike };
  const dom = (v: string | null | undefined) => normalizeDomain(v);

  if ((ctx.ownedDomains ?? []).some((o) => { const d = dom(o); return !!d && sameSite(domain, d); })) {
    return { ...base, kind: "own", name: domain, type: "other" };
  }
  const label = siteLabel(domain);
  const labelKey = squash(label);

  // 1. A saved competitor (by website, or by name matching the domain) is always a competitor — even if the
  //    domain is also a marketplace (a project competing with Amazon can't "get listed on" its competitor's site).
  for (const c of ctx.competitors ?? []) {
    const cd = dom(c.domain);
    const names = [c.name, ...(c.aliases ?? [])].filter((n): n is string => typeof n === "string" && n.trim().length > 0);
    if ((cd && sameSite(domain, cd)) || (labelKey.length >= 3 && names.some((n) => squash(n) === labelKey))) {
      return { ...base, kind: "competitor", reason: "saved", name: (typeof c.name === "string" && c.name.trim()) || domain, type: "other" };
    }
  }

  // 2. Real listing / directory / marketplace / review / social / Q&A / news sites.
  const listing = listingSiteFor(domain);
  if (listing) return { ...base, kind: "listing", name: listing.name, type: listing.type, listing };
  if (NOT_A_PLACE.some((n) => under(domain, n))) return { ...base, kind: "ignore", name: domain, type: "other" };

  // 3. A business the AI named in its answers.
  const named = (ctx.namedBrands ?? []).find((n) => labelKey.length >= 3 && squash(n) === labelKey);
  if (named) return { ...base, kind: "competitor", reason: "named", name: named.trim(), type: "other" };
  const inText = nameInText(label, ctx.answerTexts ?? []);
  if (inText) return { ...base, kind: "competitor", reason: "named", name: inText, type: "other" };

  // 4. Looks like a business in the same trade rather than a list: the AI linked its home / service page (not an
  //    article), or its name carries a trade word ("…marketing", "…agency").
  const official = /\.(?:gov|edu|ac|nic|org)(?:\.[a-z]{2})?$/.test(domain);
  const linkedBusinessPage = !listLike && pages.some((p) => isHomeOrTopPage(p.url));
  const tradeName = (ctx.tradeWords ?? []).some((w) => w.length >= 5 && labelKey.includes(squash(w)));
  if (!official && (linkedBusinessPage || (tradeName && !listLike))) {
    return { ...base, kind: "competitor", reason: "same_trade", name: nameFromLabel(label) || domain, type: "other" };
  }

  // 5. Everything else: a website AI links to.
  return { ...base, kind: "website", name: domain, type: listLike ? "best_list" : "other" };
}

/** One honest line of advice for a website AI links to. Never "get listed on" a competitor or an unknown site. */
export function adviceFor(site: Pick<CitedSite, "kind" | "listing" | "listLike" | "name">): string {
  if (site.kind === "competitor") return "A business like yours, not a place to be listed. See what their pages say that yours don't.";
  if (site.kind === "listing") {
    switch (site.listing?.group) {
      case "qa":
        return "People ask questions here. Answer the ones about what you sell, honestly and helpfully.";
      case "news":
        return "A news or article site. See which article AI links to; a mention there has to be earned.";
      case "reference":
        return "A reference site. Check whether your business has (or qualifies for) an entry.";
      case "social":
        return "Create or update your business profile here.";
      case "marketplace":
        return "Sell or list your business here, and keep the details the same as on your website.";
      default:
        return "Create or update your listing here, and ask happy customers for reviews.";
    }
  }
  return site.listLike
    ? "See why AI links to this page. If it's a list or article about businesses like yours, ask to be included."
    : "See why AI links to this page.";
}

/** Sites where a business can simply create or claim a profile (so "Get listed on …" is true). */
export function canGetListed(site: Pick<CitedSite, "kind" | "listing">): boolean {
  return site.kind === "listing" && !!site.listing && ["directory", "marketplace", "review", "social"].includes(site.listing.group);
}
