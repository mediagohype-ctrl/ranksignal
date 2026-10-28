// HTML → ExtractedPage. All extracted text is untrusted customer/third-party content.
// v2 adds optional AEO/GEO/brand signals (question headings, concise answers, dates, authors,
// Organization schema, Open Graph, trust-page links, citations, statistics, brand mentions).
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { ExtractedPage } from "@/lib/types";
import { isSameSite, normalizeUrl } from "@/lib/crawler/normalize";

export const EXTRACTOR_VERSION = 2;
const MAX_LINKS = 500;
const MAX_IMAGES = 300;
const MAX_JSONLD_BLOCKS = 20;
const MAX_JSONLD_CHARS = 200_000;
const TEXT_SAMPLE_CHARS = 2000;
/** Concise "direct answer" length window (featured-snippet style answers are ~40–60 words). */
export const ANSWER_MIN_WORDS = 25;
export const ANSWER_MAX_WORDS = 90;

const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();
export const countWords = (s: string) => (s ? s.split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0);

export const QUESTION_START = /^(what|how|why|when|where|which|who|can|could|does|do|did|is|are|should|will|would)\b/i;
export function isQuestionHeading(text: string): boolean {
  const t = text.trim();
  return t.length >= 6 && (t.endsWith("?") || QUESTION_START.test(t));
}

const ORG_TYPE_RE =
  /(Organization|Organisation|Business|Corporation|Store|Restaurant|Agency|NGO|Clinic|Hotel|Dentist|Attorney|LegalService|ProfessionalService|FinancialService)$/;
// Common LocalBusiness subtypes whose names don't end in a generic suffix.
const LOCAL_BUSINESS_TYPES = new Set([
  "Plumber", "Electrician", "Locksmith", "RoofingContractor", "HVACBusiness", "GeneralContractor", "HousePainter",
  "MovingCompany", "Dentist", "Physician", "Optician", "Pharmacy", "VeterinaryCare", "Bakery", "CafeOrCoffeeShop",
  "BarOrPub", "Winery", "Brewery", "BeautySalon", "HairSalon", "NailSalon", "DaySpa", "HealthClub", "Gym",
  "AutoRepair", "AutoDealer", "AutoBodyShop", "Notary", "AccountingService", "InsuranceAgency", "RealEstateAgent",
  "TravelAgency", "Library", "Museum", "Hospital", "School", "CollegeOrUniversity", "Preschool", "ChildCare",
  "LodgingBusiness", "BedAndBreakfast", "Motel", "Resort", "FoodEstablishment", "Florist", "Attorney", "Airline",
]);
export function isOrgType(t: string): boolean {
  return ORG_TYPE_RE.test(t) || LOCAL_BUSINESS_TYPES.has(t);
}

const SOCIAL_HOSTS = [
  "facebook.com", "instagram.com", "linkedin.com", "twitter.com", "x.com", "youtube.com", "tiktok.com",
  "pinterest.com", "github.com", "threads.net", "wikipedia.org", "wikidata.org", "crunchbase.com", "medium.com",
];
const AUTHORITATIVE_HOSTS = [
  "wikipedia.org", "who.int", "un.org", "europa.eu", "oecd.org", "worldbank.org", "imf.org", "doi.org",
  "ncbi.nlm.nih.gov", "nature.com", "science.org", "sciencedirect.com", "springer.com",
  "wiley.com", "jstor.org", "arxiv.org", "nejm.org", "thelancet.com", "bmj.com", "w3.org", "ietf.org", "iso.org",
  "statista.com", "pewresearch.org", "gartner.com", "mckinsey.com", "reuters.com", "apnews.com",
  "bbc.co.uk", "bbc.com", "nytimes.com", "ft.com", "economist.com", "wsj.com", "hbr.org",
  "developer.mozilla.org", "schema.org",
];
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
};
const hostMatches = (host: string, list: string[]) => list.some((h) => host === h || host.endsWith(`.${h}`));
export function isSocialUrl(u: string): boolean {
  return hostMatches(hostOf(u), SOCIAL_HOSTS);
}
/** Heuristic list of authoritative citation targets (government, academic, standards, research, major press). */
export function isAuthoritativeUrl(u: string): boolean {
  const host = hostOf(u);
  if (!host) return false;
  if (/\.(gov|edu|mil|int)(\.[a-z]{2})?$/.test(host) || /\.(gov|ac|edu|nic)\.[a-z]{2}$/.test(host)) return true;
  return hostMatches(host, AUTHORITATIVE_HOSTS);
}

function typesOf(obj: Record<string, unknown>): string[] {
  const t = obj["@type"];
  const arr = typeof t === "string" ? [t] : Array.isArray(t) ? t.filter((x): x is string => typeof x === "string") : [];
  return arr.map((x) => x.replace(/^https?:\/\/schema\.org\//, ""));
}

/** Flatten JSON-LD into its object nodes (depth/size limited). */
function collectNodes(nodes: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 8 || v === null || typeof v !== "object" || out.length > 2000) return;
    if (Array.isArray(v)) {
      for (const item of v.slice(0, 200)) walk(item, depth + 1);
      return;
    }
    const obj = v as Record<string, unknown>;
    out.push(obj);
    for (const [k, val] of Object.entries(obj)) if (k !== "@context") walk(val, depth + 1);
  };
  walk(nodes, 0);
  return out;
}

/** Collect every @type (incl. nested and @graph) from parsed JSON-LD, depth-limited. */
export function collectSchemaTypes(nodes: unknown[]): string[] {
  const types = new Set<string>();
  for (const obj of collectNodes(nodes)) for (const t of typesOf(obj)) types.add(t);
  return Array.from(types).sort();
}

export function fingerprintText(text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

// ---------- readability / statistics (pure, exported for tests) ----------
export function countSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'“(])/)
    .map((s) => s.trim())
    .filter((s) => countWords(s) >= 3);
}

/** Flesch reading ease (0–100+, higher = easier). Null when there is too little text. */
export function fleschReadingEase(sentences: string[]): number | null {
  const words = sentences.flatMap((s) => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)));
  if (words.length < 100 || sentences.length < 3) return null;
  const syllables = words.reduce((a, w) => a + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  return Math.round(Math.max(0, Math.min(120, score)) * 10) / 10;
}

const STAT_RE =
  /(\d+(?:\.\d+)?\s?%|\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\s?(?:percent|million|billion|thousand|lakh|crore|x|times|hours?|days?|minutes?|years?|customers|users|people|clients|projects|countries)\b|[$€£₹]\s?\d|\b\d+(?:\.\d+)?\s?(?:k|m|bn)\b|\b\d{3,}\b)/i;
/** A sentence carrying a concrete number/percentage/amount — a "quotable fact" signal. */
export function isStatSentence(s: string): boolean {
  return countWords(s) >= 6 && STAT_RE.test(s);
}

function toIso(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v.trim());
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  if (d.getUTCFullYear() < 1995 || t > Date.now() + 86_400_000 * 2) return null;
  return d.toISOString();
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export function brandRegex(name: string): RegExp | null {
  const n = name.trim();
  if (n.length < 2) return null;
  const pre = /^[\p{L}\p{N}]/u.test(n) ? "(?<![\\p{L}\\p{N}])" : "";
  const post = /[\p{L}\p{N}]$/u.test(n) ? "(?![\\p{L}\\p{N}])" : "";
  return new RegExp(`${pre}${escapeRe(n)}${post}`, "giu");
}
/** Case-insensitive, whole-word brand occurrences across all names/aliases. */
export function countBrand(text: string, names: string[]): number {
  let n = 0;
  for (const name of names) {
    const re = brandRegex(name);
    if (re) n += (text.match(re) ?? []).length;
  }
  return n;
}
export function mentionsBrand(text: string | null | undefined, names: string[]): boolean {
  return !!text && countBrand(text, names) > 0;
}

export interface ExtractOptions {
  /** Brand name + aliases; enables brandMentions. */
  brandNames?: string[];
}

/**
 * Extract SEO/AI-readiness signals from HTML.
 * @param siteHosts hosts considered "internal" (www-insensitive)
 */
export function extractPage(html: string, pageUrl: string, siteHosts: Iterable<string>, opts: ExtractOptions = {}): ExtractedPage {
  const $ = cheerio.load(html);
  const hosts = Array.from(siteHosts);

  // Respect <base href> for link resolution when present and absolute http(s).
  let baseUrl = pageUrl;
  const baseHref = $("base[href]").first().attr("href");
  if (baseHref) {
    const b = normalizeUrl(baseHref, pageUrl, { trailingSlash: "keep" });
    if (b) baseUrl = b;
  }
  const resolve = (href: string | null) => {
    if (!href) return null;
    try {
      return new URL(href, baseUrl).toString().slice(0, 1000);
    } catch {
      return null;
    }
  };

  const title = clean($("title").first().text()) || null;

  const metaBy = (attr: "name" | "property", name: string): string | null => {
    let value: string | null = null;
    $(`meta[${attr}]`).each((_, el) => {
      if (value !== null) return;
      if (($(el).attr(attr) ?? "").toLowerCase() === name) value = clean($(el).attr("content")) || null;
    });
    return value;
  };
  const metaByName = (name: string) => metaBy("name", name);
  const metaAny = (name: string) => metaBy("property", name) ?? metaBy("name", name);
  const description = metaByName("description");
  const robotsMeta = metaByName("robots");
  const viewport = metaByName("viewport");

  const headingSel = "h1, h2, h3, h4, h5, h6";
  const headings: { level: number; text: string }[] = [];
  const questionHeadings: string[] = [];
  let questionsWithConciseAnswer = 0;
  $(headingSel).each((_, el) => {
    const tag = (el as { tagName?: string }).tagName ?? "";
    const level = Number(tag.slice(1));
    if (!(level >= 1 && level <= 6)) return;
    const text = clean($(el).text()).slice(0, 300);
    headings.push({ level, text });
    if ((level === 2 || level === 3) && isQuestionHeading(text)) {
      questionHeadings.push(text);
      // First content block after the heading (look past a wrapper element when needed).
      let answerWords = 0;
      const scan = (start: ReturnType<typeof $>) => {
        let node = start.next();
        for (let steps = 0; node.length && steps < 4; steps++) {
          if (node.is(headingSel) || node.find(headingSel).length) return true;
          const t = clean(node.text());
          if (t) {
            answerWords = countWords(t);
            return true;
          }
          node = node.next();
        }
        return false;
      };
      if (!scan($(el))) scan($(el).parent());
      if (answerWords >= ANSWER_MIN_WORDS && answerWords <= ANSWER_MAX_WORDS) questionsWithConciseAnswer++;
    }
  });
  const h1 = headings.filter((h) => h.level === 1).map((h) => h.text);

  let canonical: string | null = null;
  $("link[rel]").each((_, el) => {
    if (canonical) return;
    const rels = ($(el).attr("rel") ?? "").toLowerCase().split(/\s+/);
    const href = $(el).attr("href");
    if (rels.includes("canonical") && href) canonical = normalizeUrl(href, baseUrl, { trailingSlash: "keep" });
  });

  const lang = clean($("html").attr("lang")) || null;

  const internal = new Set<string>();
  const external = new Set<string>();
  const navLinks = new Set<string>();
  const social = new Set<string>();
  const citations = new Set<string>();
  const pageLinks: NonNullable<ExtractedPage["pageLinks"]> = { about: null, contact: null, privacy: null, terms: null };
  let hasPhoneLink = false;
  let hasEmailLink = false;
  let relAuthor = false;
  $("a[href]").each((_, el) => {
    const rel = ($(el).attr("rel") ?? "").toLowerCase();
    const href = ($(el).attr("href") ?? "").trim();
    if (/^tel:/i.test(href)) hasPhoneLink = true;
    if (/^mailto:/i.test(href)) hasEmailLink = true;
    if (/\bauthor\b/.test(rel)) relAuthor = true;
    if (!href || /^(mailto:|tel:|javascript:|data:|#)/i.test(href)) return;
    const abs = normalizeUrl(href, baseUrl, { trailingSlash: "keep" });
    if (!abs) return;
    if (isSameSite(abs, hosts)) {
      if (internal.size < MAX_LINKS && !rel.includes("nofollow")) internal.add(abs);
      if (navLinks.size < 100 && $(el).closest("nav, header, [role=navigation]").length) navLinks.add(abs);
      let path = "";
      try {
        path = new URL(abs).pathname.toLowerCase();
      } catch {
        /* ignore */
      }
      const text = clean($(el).text()).toLowerCase();
      if (!pageLinks.about && (/\/(about|about-us|who-we-are|our-story|company|team)(\/|\.|$|-)/.test(path) || /^about( us)?$/.test(text))) pageLinks.about = abs;
      if (!pageLinks.contact && (/\/(contact|contact-us|get-in-touch|reach-us)(\/|\.|$|-)/.test(path) || /^contact( us)?$/.test(text))) pageLinks.contact = abs;
      const shallow = path.split("/").filter(Boolean).length <= 2;
      if (!pageLinks.privacy && ((shallow && /\/(privacy|privacy[-_]?(policy|notice|statement)|datenschutz)(\/|\.|$)/.test(path)) || /privacy (policy|notice|statement)|^privacy$/.test(text))) pageLinks.privacy = abs;
      if (!pageLinks.terms && (/\/(terms|tos|terms-of-service|terms-and-conditions|legal)(\/|\.|$|-)/.test(path) || /^terms/.test(text))) pageLinks.terms = abs;
    } else {
      if (external.size < MAX_LINKS) external.add(abs);
      // Legal pages are often hosted elsewhere (policies.example.org, a CMP); match by link text only.
      const text = clean($(el).text()).toLowerCase();
      if (!pageLinks.privacy && /privacy (policy|notice|statement)|^privacy$/.test(text)) pageLinks.privacy = abs;
      if (!pageLinks.terms && /^terms|terms of (use|service)/.test(text)) pageLinks.terms = abs;
      if (isSocialUrl(abs)) {
        if (social.size < 50) social.add(abs);
      } else if (citations.size < 100 && isAuthoritativeUrl(abs)) citations.add(abs);
    }
  });

  const images: { src: string; alt: string | null }[] = [];
  $("img").each((_, el) => {
    if (images.length >= MAX_IMAGES) return false;
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
    let resolved = src;
    try {
      resolved = src && !src.startsWith("data:") ? new URL(src, baseUrl).toString() : src.slice(0, 64);
    } catch {
      /* keep raw */
    }
    const alt = $(el).attr("alt");
    images.push({ src: resolved.slice(0, 1000), alt: alt === undefined ? null : clean(alt) });
  });

  const jsonLd: unknown[] = [];
  $('script[type="application/ld+json" i]').each((_, el) => {
    if (jsonLd.length >= MAX_JSONLD_BLOCKS) return false;
    const raw = $(el).contents().text().trim();
    if (!raw || raw.length > MAX_JSONLD_CHARS) return;
    try {
      jsonLd.push(JSON.parse(raw));
    } catch {
      jsonLd.push({ "@invalid": true }); // keep a marker so audits can flag invalid JSON-LD
    }
  });
  const nodes = collectNodes(jsonLd);
  const schemaTypes = collectSchemaTypes(jsonLd);

  // Dates (meta → JSON-LD → <time>).
  const published: string[] = [];
  const modified: string[] = [];
  const pushIso = (arr: string[], v: unknown) => {
    const iso = toIso(v);
    if (iso) arr.push(iso);
  };
  pushIso(published, metaAny("article:published_time"));
  pushIso(published, metaByName("date"));
  pushIso(modified, metaAny("article:modified_time"));
  pushIso(modified, metaAny("og:updated_time"));
  pushIso(modified, metaByName("last-modified"));
  for (const n of nodes) {
    pushIso(published, n.datePublished);
    pushIso(modified, n.dateModified);
  }
  if (!published.length) $("time[datetime]").slice(0, 5).each((_, el) => pushIso(published, $(el).attr("datetime")));
  const datePublished = published.sort()[0] ?? null;
  const dateModified = modified.sort().at(-1) ?? null;

  // Author signals.
  const authorSignals: string[] = [];
  let author: string | null = null;
  const metaAuthor = metaByName("author") ?? metaBy("property", "article:author");
  if (metaAuthor) {
    authorSignals.push("meta");
    author = metaAuthor.slice(0, 120);
  }
  for (const n of nodes) {
    const a = n.author;
    const first = Array.isArray(a) ? a[0] : a;
    const name = typeof first === "string" ? first : first && typeof first === "object" ? (first as Record<string, unknown>).name : null;
    if (typeof name === "string" && name.trim()) {
      authorSignals.push("jsonld");
      author ??= clean(name).slice(0, 120);
      break;
    }
  }
  if (relAuthor) authorSignals.push("rel_author");
  const bylineText = clean($('[itemprop="author"], [class*="byline" i], [class*="author-name" i]').first().text());
  if (bylineText.length >= 3 && bylineText.length <= 100) {
    authorSignals.push("byline");
    author ??= bylineText.replace(/^by\s+/i, "").slice(0, 120);
  }

  // Organization / LocalBusiness entity — keep the richest node.
  type Org = NonNullable<ExtractedPage["organization"]>;
  let organization: Org | null = null;
  const richness = (o: Org) => (o.name ? 1 : 0) + (o.logo ? 1 : 0) + o.sameAs.length + (o.hasAddress ? 1 : 0) + (o.hasContactPoint ? 1 : 0);
  for (const n of nodes) {
    const types = typesOf(n);
    if (!types.some(isOrgType)) continue;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? clean(v).slice(0, 500) : null);
    const logoRaw = n.logo;
    const logoObj = logoRaw && typeof logoRaw === "object" && !Array.isArray(logoRaw) ? (logoRaw as Record<string, unknown>) : null;
    const logo = str(logoRaw) ?? (logoObj ? (str(logoObj.url) ?? str(logoObj.contentUrl)) : null);
    const sameAs = (Array.isArray(n.sameAs) ? n.sameAs : [n.sameAs])
      .filter((s): s is string => typeof s === "string" && /^https?:/i.test(s))
      .slice(0, 30);
    const candidate: Org = {
      types,
      name: str(n.name),
      url: str(n.url),
      logo,
      sameAs,
      hasContactPoint: n.contactPoint !== undefined && n.contactPoint !== null,
      hasAddress: n.address !== undefined && n.address !== null,
      telephone: str(n.telephone),
      email: str(n.email),
    };
    if (!organization || richness(candidate) > richness(organization)) organization = candidate;
  }

  const openGraph = {
    title: metaAny("og:title"),
    description: metaAny("og:description"),
    image: resolve(metaAny("og:image")),
    type: metaAny("og:type"),
    siteName: metaAny("og:site_name"),
  };
  const twitter = { card: metaAny("twitter:card"), title: metaAny("twitter:title"), image: resolve(metaAny("twitter:image")) };

  // Page-speed proxies (static HTML only; not a lab measurement).
  let renderBlockingScripts = 0;
  $("head script[src]").each((_, el) => {
    const type = ($(el).attr("type") ?? "").toLowerCase();
    if ($(el).attr("async") === undefined && $(el).attr("defer") === undefined && type !== "module") renderBlockingScripts++;
  });
  const stylesheetCount = $('link[rel~="stylesheet" i]').length;
  const listCount = $("ul, ol").filter((_, el) => $(el).closest("nav, header, footer").length === 0 && $(el).children("li").length >= 2).length;
  const tableCount = $("table").filter((_, el) => $(el).find("tr").length >= 2).length;

  // Visible text (strip non-content elements).
  $("script, style, noscript, template, svg, iframe, head").remove();
  const text = clean($("body").length ? $("body").text() : $.root().text());
  const wordCount = countWords(text);

  // Body copy: paragraphs/list items/cells outside site chrome.
  const blocks: string[] = [];
  $("p, li, td, blockquote, dd").each((_, el) => {
    if (blocks.length > 3000) return false;
    if ($(el).closest("nav, header, footer, [role=navigation]").length) return;
    if ($(el).find("p, li").length) return; // avoid double counting nested blocks
    const t = clean($(el).text());
    if (countWords(t) >= 4) blocks.push(t);
  });
  const sentences = blocks.flatMap((b) => {
    const s = splitSentences(b);
    return s.length ? s : [b];
  });
  const contentWordCount = blocks.reduce((a, b) => a + countWords(b), 0);
  const english = !lang || /^en\b/i.test(lang);
  const readingEase = english ? fleschReadingEase(sentences) : null;
  const statSentences = sentences.filter(isStatSentence);

  const brandNames = (opts.brandNames ?? []).filter((b) => b.trim().length >= 2);
  const brandMentions = brandNames.length
    ? { inTitle: mentionsBrand(title, brandNames), inH1: h1.some((h) => mentionsBrand(h, brandNames)), bodyCount: countBrand(text, brandNames) }
    : undefined;

  return {
    title,
    description,
    h1,
    headings: headings.slice(0, 200),
    canonical,
    robotsMeta,
    lang,
    internalLinks: Array.from(internal),
    externalLinks: Array.from(external),
    images,
    jsonLd,
    schemaTypes,
    wordCount,
    textSample: text.slice(0, TEXT_SAMPLE_CHARS),
    hasFaq: schemaTypes.includes("FAQPage") || schemaTypes.includes("QAPage"),
    contentFingerprint: fingerprintText(text),
    extractorVersion: EXTRACTOR_VERSION,
    questionHeadings: questionHeadings.slice(0, 50),
    questionsWithConciseAnswer,
    listCount,
    tableCount,
    contentWordCount,
    sentenceCount: sentences.length,
    readingEase,
    statSentenceCount: statSentences.length,
    statExamples: statSentences.slice(0, 3).map((s) => s.slice(0, 200)),
    datePublished,
    dateModified,
    author,
    authorSignals,
    organization,
    openGraph,
    twitter,
    pageLinks,
    navLinks: Array.from(navLinks),
    socialLinks: Array.from(social),
    citationLinks: Array.from(citations),
    hasPhoneLink,
    hasEmailLink,
    viewport,
    renderBlockingScripts,
    stylesheetCount,
    ...(brandMentions ? { brandMentions } : {}),
  };
}
