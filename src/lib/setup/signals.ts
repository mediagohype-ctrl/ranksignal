// Pure homepage → signals → heuristic facts (no network). Used by understand.ts; unit-tested on its own.
// All extracted text is untrusted third-party content: it is only shown back to the owner for editing and passed
// to the LLM inside the untrusted-input wrapper.
import * as cheerio from "cheerio";
import { countryCode, countryFromLang, languageCode, nameFromHost, type BusinessFacts } from "./facts";

export interface SiteSignals {
  url: string;
  host: string;
  title: string;
  description: string;
  siteName: string;
  h1: string;
  lang: string;
  /** From JSON-LD Organization / LocalBusiness (first one with a name). */
  org: { name: string; description: string; city: string; country: string; types: string[] } | null;
  /** First ~2500 chars of visible body text. */
  text: string;
}

const MAX_JSONLD_BLOCKS = 20;
const MAX_JSONLD_CHARS = 200_000;
const TEXT_CHARS = 2500;

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");

const ORG_TYPE =
  /(Organization|Organisation|Business|Corporation|Store|Shop|Restaurant|Bakery|Cafe|Agency|Clinic|Hotel|Dentist|Physician|Attorney|Service|School|Salon|Spa|Gym|Center|Centre|Brand)$/i;

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
}

function flattenLd(v: unknown, out: Record<string, unknown>[], depth = 0): void {
  if (depth > 4 || out.length > 200) return;
  for (const item of asArray(v)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    out.push(o);
    if (o["@graph"]) flattenLd(o["@graph"], out, depth + 1);
    for (const k of ["publisher", "provider", "brand", "seller", "author", "organization", "parentOrganization"]) {
      if (o[k] && typeof o[k] === "object") flattenLd(o[k], out, depth + 1);
    }
  }
}

function addressParts(addr: unknown): { city: string; country: string } {
  for (const a of asArray(addr)) {
    if (typeof a === "string") {
      // "12 MG Road, Pune, Maharashtra 411001, India" — last part is often the country, an earlier one the city.
      const parts = a.split(",").map((p) => p.trim()).filter(Boolean);
      const country = parts.length ? (countryCode(parts[parts.length - 1]) ?? "") : "";
      const rest = country ? parts.slice(0, -1) : parts;
      // "City, State 411001": skip the trailing part that carries the postal code.
      const tail = rest.length > 1 && /\d{4,}/.test(rest[rest.length - 1]) ? rest.slice(0, -1) : rest;
      const cityPart = findCity(a) || (tail.length >= 2 ? tail[tail.length - 1] : "");
      return { city: clean(cityPart.replace(/\d{4,}/g, "")), country };
    }
    if (a && typeof a === "object") {
      const o = a as Record<string, unknown>;
      const c = o.addressCountry;
      const countryRaw = typeof c === "string" ? c : c && typeof c === "object" ? (c as Record<string, unknown>).name ?? (c as Record<string, unknown>).identifier : "";
      return { city: clean(o.addressLocality) || clean(o.addressRegion), country: countryCode(countryRaw) ?? "" };
    }
  }
  return { city: "", country: "" };
}

export function extractJsonLdOrg(blocks: string[]): SiteSignals["org"] {
  const nodes: Record<string, unknown>[] = [];
  for (const raw of blocks.slice(0, MAX_JSONLD_BLOCKS)) {
    if (raw.length > MAX_JSONLD_CHARS) continue;
    try {
      flattenLd(JSON.parse(raw), nodes);
    } catch {
      /* malformed block: skip */
    }
  }
  const orgs = nodes.filter((n) => asArray(n["@type"]).some((t) => typeof t === "string" && ORG_TYPE.test(t)));
  // Prefer a node with an address (LocalBusiness), then any named org.
  const best = orgs.find((n) => n.address && clean(n.name)) ?? orgs.find((n) => clean(n.name));
  if (!best) return null;
  const { city, country } = addressParts(best.address ?? best.location);
  return {
    name: clean(best.name).slice(0, 120),
    description: clean(best.description).slice(0, 300),
    city: city.slice(0, 120),
    country,
    types: asArray(best["@type"]).filter((t): t is string => typeof t === "string").slice(0, 5),
  };
}

export function extractSiteSignals(html: string, url: string): SiteSignals {
  const $ = cheerio.load(html);
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    /* keep empty */
  }
  const meta = (sel: string) => clean($(sel).first().attr("content"));
  const ld = $('script[type="application/ld+json"]')
    .toArray()
    .map((el) => $(el).text());
  const org = extractJsonLdOrg(ld);
  $("script, style, noscript, template, svg, iframe").remove();
  return {
    url,
    host,
    title: clean($("title").first().text()).slice(0, 200),
    description: (meta('meta[name="description"]') || meta('meta[property="og:description"]')).slice(0, 400),
    siteName: meta('meta[property="og:site_name"]').slice(0, 120),
    h1: clean($("h1").first().text()).slice(0, 200),
    lang: clean($("html").attr("lang")).slice(0, 20),
    org,
    text: clean($("body").text()).slice(0, TEXT_CHARS),
  };
}

export function tldCountry(host: string): string | null {
  const m = /\.(in|uk|ae|sg|au|ca|de|fr|nl|za|nz|ie|my|sa|np|lk|bd)$/i.exec(host);
  if (!m) return null;
  const t = m[1].toUpperCase();
  return t === "UK" ? "GB" : t;
}

const TITLE_SEP = /\s+[|–—•·:-]\s+|\s+-\s+/;
const GENERIC_PART = /^(home|homepage|welcome|official (web)?site|index|main page)$/i;

/** The title segment most like the domain ("Home | Sharma Sweets – Best mithai" → "Sharma Sweets"). */
export function nameFromTitle(title: string, host: string): string {
  const parts = title
    .split(TITLE_SEP)
    .map((p) => p.trim())
    .filter((p) => p && !GENERIC_PART.test(p) && p.length <= 60);
  if (!parts.length) return "";
  const hostKey = (host.split(".")[0] ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const key = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const match = hostKey ? parts.find((p) => key(p).includes(hostKey) || (key(p).length >= 4 && hostKey.includes(key(p)))) : undefined;
  return match ?? (parts.length > 1 ? parts.reduce((a, b) => (b.length < a.length ? b : a)) : parts[0]);
}

/** Major Indian cities (and a few others) we can spot in a title/description when there is no structured address. */
const CITIES = [
  "Mumbai", "Delhi", "New Delhi", "Bengaluru", "Bangalore", "Hyderabad", "Ahmedabad", "Chennai", "Kolkata", "Pune", "Jaipur",
  "Surat", "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal", "Visakhapatnam", "Patna", "Vadodara", "Ghaziabad",
  "Ludhiana", "Agra", "Nashik", "Noida", "Gurugram", "Gurgaon", "Faridabad", "Rajkot", "Coimbatore", "Kochi", "Cochin",
  "Chandigarh", "Mysuru", "Mysore", "Goa", "Dehradun", "Amritsar", "Varanasi", "Madurai", "Thiruvananthapuram", "Guwahati",
  "Bhubaneswar", "Raipur", "Ranchi", "Jodhpur", "Udaipur", "Mangaluru", "Navi Mumbai", "Dubai", "Abu Dhabi", "Singapore",
  "London", "Kathmandu", "Colombo", "Dhaka",
];
const CITY_RE = new RegExp(`\\b(${CITIES.map((c) => c.replace(/\s/g, "\\s+")).join("|")})\\b`, "i");

export function findCity(...texts: string[]): string {
  for (const t of texts) {
    const m = CITY_RE.exec(t);
    if (m) return CITIES.find((c) => c.toLowerCase() === m[1].replace(/\s+/g, " ").toLowerCase()) ?? m[1];
  }
  return "";
}

/** First sentence, capped (meta descriptions are often long marketing copy). */
function firstSentence(s: string, max = 140): string {
  const t = clean(s);
  if (!t) return "";
  const cut = t.split(/(?<=[.!?])\s+/)[0] ?? t;
  return cut.length > max ? `${cut.slice(0, max - 1).replace(/\s+\S*$/, "")}…` : cut;
}

/** Deterministic guess used when no AI provider is configured (and as hints for the AI). */
export function heuristicFacts(s: SiteSignals): BusinessFacts {
  const name = (s.org?.name || s.siteName || nameFromTitle(s.title, s.host) || clean(s.h1).slice(0, 60) || nameFromHost(s.host)).slice(0, 120);
  const sells = firstSentence(s.org?.description || s.description || s.h1);
  const country = s.org?.country || countryFromLang(s.lang) || tldCountry(s.host) || "IN";
  const language = languageCode(s.lang) ?? "en";
  const city = s.org?.city || findCity(s.title, s.description, s.h1);
  return { name, sells, customers: "", city, country, language };
}
