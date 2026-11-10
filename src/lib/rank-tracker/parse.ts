// Pure parsing of a DataForSEO SERP (Google organic, live/advanced) result into one rank check: where the project's
// domain ranks among organic results (null = not in the top 100), which URL ranked, which SERP features showed and
// the top 3 other domains ranking above it. Defensive: DataForSEO shapes vary, so no field is trusted to exist.
import { arr, isObj, num, str } from "@/lib/dataforseo/client";
import { normaliseDomain } from "@/lib/dataforseo/locations";

export interface Competitor {
  domain: string;
  position: number;
}

export interface ParsedRank {
  position: number | null;
  url: string | null;
  features: string[];
  competitors: Competitor[];
  /** The customer's page holds the featured snippet. */
  ownsFeaturedSnippet: boolean;
}

/** SERP features we show, keyed by DataForSEO item type, with plain-English labels. */
export const SERP_FEATURE_LABELS: Record<string, string> = {
  ai_overview: "AI Overview",
  featured_snippet: "Featured snippet",
  answer_box: "Answer box",
  local_pack: "Map pack (local results)",
  map: "Map",
  people_also_ask: "People also ask",
  knowledge_graph: "Knowledge panel",
  top_stories: "Top stories",
  video: "Videos",
  short_videos: "Short videos",
  images: "Images",
  shopping: "Shopping results",
  popular_products: "Popular products",
  discussions_and_forums: "Discussions and forums",
  perspectives: "Perspectives",
  hotels_pack: "Hotels",
  jobs: "Jobs",
  events: "Events",
};

export function featureLabel(id: string): string {
  return SERP_FEATURE_LABELS[id] ?? id.replace(/_/g, " ");
}

/** The comparable host of a domain or URL ("https://www.Acme.in/x" → "acme.in"). */
export function hostKey(input: string | null | undefined): string | null {
  if (!input) return null;
  return normaliseDomain(input);
}

/** True when `host` is the project's domain, its www form or a subdomain of it. */
export function matchesDomain(host: string | null | undefined, projectDomain: string): boolean {
  const h = hostKey(host);
  if (!h) return false;
  return h === projectDomain || h.endsWith(`.${projectDomain}`);
}

function itemHost(item: Record<string, unknown>): string | null {
  return hostKey(str(item.domain) ?? str(item.url));
}

/** Parse `result` (the dfsPost result array) for the project's domain (already normalised, e.g. "acme.in"). */
export function parseSerpResult(result: unknown[], projectDomain: string): ParsedRank {
  const first = result.find(isObj);
  const items = first ? arr(first.items).filter(isObj) : [];
  const itemTypes = first ? arr(first.item_types).map((t) => (typeof t === "string" ? t : "")).filter(Boolean) : [];

  const featureSet = new Set<string>();
  for (const t of [...itemTypes, ...items.map((i) => str(i.type) ?? "")]) {
    if (t && t in SERP_FEATURE_LABELS) featureSet.add(t);
  }

  let ownsFeaturedSnippet = false;
  const organic: { host: string; position: number; url: string | null }[] = [];
  for (const it of items) {
    const type = str(it.type);
    const host = itemHost(it);
    if (type === "featured_snippet" && host && matchesDomain(host, projectDomain)) ownsFeaturedSnippet = true;
    if (type !== "organic" || !host) continue;
    const position = num(it.rank_group) ?? num(it.rank_absolute);
    if (position === null || position < 1) continue;
    organic.push({ host, position: Math.round(position), url: str(it.url) });
  }
  organic.sort((a, b) => a.position - b.position);

  const mine = organic.find((o) => matchesDomain(o.host, projectDomain)) ?? null;
  const position = mine && mine.position <= 100 ? mine.position : null;

  // Up to 3 other domains above us (or simply the top 3 when we don't rank), one entry per domain.
  const competitors: Competitor[] = [];
  const seen = new Set<string>();
  for (const o of organic) {
    if (position !== null && o.position >= position) break;
    if (matchesDomain(o.host, projectDomain) || seen.has(o.host)) continue;
    seen.add(o.host);
    competitors.push({ domain: o.host, position: o.position });
    if (competitors.length >= 3) break;
  }

  return {
    position,
    url: position !== null ? (mine?.url ?? null) : null,
    features: [...featureSet].sort(),
    competitors,
    ownsFeaturedSnippet,
  };
}

/** Read back stored JSON (RankCheck.serpFeatures / competitors) safely. */
export function readFeatures(v: unknown): string[] {
  return arr(v).filter((x): x is string => typeof x === "string").slice(0, 30);
}
export function readCompetitors(v: unknown): Competitor[] {
  return arr(v)
    .filter(isObj)
    .map((c) => ({ domain: str(c.domain) ?? "", position: num(c.position) ?? 0 }))
    .filter((c) => c.domain && c.position > 0)
    .slice(0, 3);
}
