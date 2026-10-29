// Off-site suggestions (pure). From the third-party domains AI answers already cite in this project's category, list
// the ones the client isn't on yet (not their own domain, not a competitor's site, not already in the tracker).
// Honest framing: these are places worth considering, not a guarantee that a listing will be cited.
import { STARTER_LISTINGS, type OffsiteType, type StarterListing } from "./types";

export interface CitedDomain {
  domain: string;
  count: number;
  owned: boolean;
}

export interface AiCitationSuggestion {
  domain: string;
  /** How many sampled answers cited this domain in the latest real check. */
  count: number;
  type: OffsiteType;
  name: string;
  url: string;
}

export interface StarterSuggestion extends StarterListing {
  tracked: boolean;
}

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
function sameSite(a: string, b: string): boolean {
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

const KNOWN: { match: string; type: OffsiteType; name: string }[] = [
  { match: "justdial.com", type: "directory", name: "Justdial" },
  { match: "indiamart.com", type: "directory", name: "IndiaMART" },
  { match: "sulekha.com", type: "directory", name: "Sulekha" },
  { match: "tradeindia.com", type: "directory", name: "TradeIndia" },
  { match: "yelp.com", type: "directory", name: "Yelp" },
  { match: "yellowpages.com", type: "directory", name: "Yellow Pages" },
  { match: "practo.com", type: "directory", name: "Practo" },
  { match: "zomato.com", type: "directory", name: "Zomato" },
  { match: "tripadvisor.com", type: "review_platform", name: "Tripadvisor" },
  { match: "tripadvisor.in", type: "review_platform", name: "Tripadvisor" },
  { match: "g2.com", type: "review_platform", name: "G2" },
  { match: "capterra.com", type: "review_platform", name: "Capterra" },
  { match: "trustpilot.com", type: "review_platform", name: "Trustpilot" },
  { match: "glassdoor.com", type: "review_platform", name: "Glassdoor" },
  { match: "ambitionbox.com", type: "review_platform", name: "AmbitionBox" },
  { match: "mouthshut.com", type: "review_platform", name: "MouthShut" },
  { match: "getapp.com", type: "review_platform", name: "GetApp" },
  { match: "softwareadvice.com", type: "review_platform", name: "Software Advice" },
  { match: "clutch.co", type: "review_platform", name: "Clutch" },
  { match: "reddit.com", type: "forum_thread", name: "Reddit" },
  { match: "quora.com", type: "forum_thread", name: "Quora" },
  { match: "stackoverflow.com", type: "forum_thread", name: "Stack Overflow" },
  { match: "wikipedia.org", type: "wikidata", name: "Wikipedia" },
  { match: "wikidata.org", type: "wikidata", name: "Wikidata" },
  { match: "crunchbase.com", type: "wikidata", name: "Crunchbase" },
  { match: "linkedin.com", type: "social_profile", name: "LinkedIn" },
  { match: "facebook.com", type: "social_profile", name: "Facebook" },
  { match: "instagram.com", type: "social_profile", name: "Instagram" },
  { match: "youtube.com", type: "social_profile", name: "YouTube" },
  { match: "x.com", type: "social_profile", name: "X (Twitter)" },
  { match: "twitter.com", type: "social_profile", name: "X (Twitter)" },
  { match: "medium.com", type: "pr_mention", name: "Medium" },
  { match: "forbes.com", type: "pr_mention", name: "Forbes" },
  { match: "inc42.com", type: "pr_mention", name: "Inc42" },
  { match: "yourstory.com", type: "pr_mention", name: "YourStory" },
  { match: "economictimes.indiatimes.com", type: "pr_mention", name: "The Economic Times" },
  { match: "livemint.com", type: "pr_mention", name: "Mint" },
  { match: "moneycontrol.com", type: "pr_mention", name: "Moneycontrol" },
];

/** Search engines / AI vendors / generic infrastructure that aren't places you can "be listed". */
const NOT_A_PLACE = ["google.com", "bing.com", "openai.com", "chatgpt.com", "perplexity.ai", "anthropic.com", "gemini.google.com", "vertexaisearch.cloud.google.com", "amazonaws.com", "cloudfront.net", "googleusercontent.com", "gstatic.com"];

export function classifyDomain(domain: string): { type: OffsiteType; name: string } {
  const hit = KNOWN.find((k) => domain === k.match || domain.endsWith(`.${k.match}`));
  // Unknown domains are usually articles, blogs or "best X" round-ups; let the team re-type them.
  return hit ? { type: hit.type, name: hit.name } : { type: "other", name: domain };
}

export interface SuggestionContext {
  /** The client's own website(s). */
  ownedDomains: string[];
  /** Competitor domains (their own sites aren't places the client can be listed). */
  competitorDomains: string[];
  /** Tracker rows already present (by url and name). */
  tracked: { url: string | null; name: string }[];
}

function trackedDomains(tracked: SuggestionContext["tracked"]): { domains: string[]; names: Set<string> } {
  const domains: string[] = [];
  const names = new Set<string>();
  for (const t of tracked) {
    const d = normalizeDomain(t.url);
    if (d) domains.push(d);
    names.add(t.name.trim().toLowerCase());
  }
  return { domains, names };
}

/** Third-party domains AI cites where the client is absent from our tracker (and which aren't owned/competitor sites). */
export function suggestFromCitations(sources: CitedDomain[] | null | undefined, ctx: SuggestionContext, limit = 15): AiCitationSuggestion[] {
  if (!Array.isArray(sources)) return [];
  const owned = ctx.ownedDomains.map(normalizeDomain).filter((d): d is string => !!d);
  const competitors = ctx.competitorDomains.map(normalizeDomain).filter((d): d is string => !!d);
  const { domains: trackedD, names: trackedN } = trackedDomains(ctx.tracked);
  const out: AiCitationSuggestion[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    if (!s || typeof s.domain !== "string" || s.owned) continue;
    const d = normalizeDomain(s.domain);
    if (!d || seen.has(d)) continue;
    if (owned.some((o) => sameSite(d, o))) continue;
    if (competitors.some((c) => sameSite(d, c))) continue;
    if (NOT_A_PLACE.some((n) => sameSite(d, n))) continue;
    const { type, name } = classifyDomain(d);
    if (trackedD.some((t) => sameSite(d, t)) || trackedN.has(name.toLowerCase()) || trackedN.has(d)) continue;
    seen.add(d);
    out.push({ domain: d, count: typeof s.count === "number" ? s.count : 0, type, name, url: `https://${d}/` });
    if (out.length >= limit) break;
  }
  return out;
}

/** The curated starter list, marking entries the tracker already has. */
export function starterSuggestions(tracked: SuggestionContext["tracked"]): StarterSuggestion[] {
  const { domains, names } = trackedDomains(tracked);
  return STARTER_LISTINGS.map((s) => ({
    ...s,
    tracked: names.has(s.name.toLowerCase()) || domains.some((d) => sameSite(d, s.domain)),
  }));
}
