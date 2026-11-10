// SERP checker (DataForSEO SERP API, Google organic "advanced"): request building, a defensive parser for the top 10
// and the SERP features, and highlighting of the customer's own domain and saved competitors. Pure module.
import { arr, isObj, num, str } from "./json";

export const SERP_PATH = "/v3/serp/google/organic/live/advanced";
/** Ask for 20 results so the top 10 ordinary results survive features (maps, videos…) taking some of the first slots. */
export const SERP_DEPTH = 20;
/** High estimate for one live advanced SERP call (micro-USD). */
export const SERP_ESTIMATE_MICROS = 4_000;
/** Google's results change daily: the same check is reused (free) for 24 hours. */
export const SERP_CACHE_MS = 24 * 60 * 60 * 1000;
export const SERP_TOP_N = 10;

export type Device = "mobile" | "desktop";

/** Plain-English names for the boxes Google shows besides the ten ordinary results. */
export const SERP_FEATURE_INFO: Record<string, { label: string; explain: string }> = {
  ai_overview: { label: "AI Overview", explain: "Google's AI-written answer at the top. Sites it quotes get seen first." },
  featured_snippet: { label: "Featured snippet", explain: "A highlighted answer box quoted from one website." },
  answer_box: { label: "Answer box", explain: "Google answers directly on the results page." },
  local_pack: { label: "Map pack", explain: "Map with nearby businesses from Google Business Profiles." },
  map: { label: "Map", explain: "A Google Maps result." },
  people_also_ask: { label: "People also ask", explain: "Expandable related questions, each answered from a website." },
  video: { label: "Videos", explain: "Video results, mostly YouTube." },
  short_videos: { label: "Short videos", explain: "Short vertical videos (Shorts, Reels)." },
  images: { label: "Images", explain: "A row of image results." },
  top_stories: { label: "Top stories", explain: "News articles." },
  knowledge_graph: { label: "Knowledge panel", explain: "A fact box about a business, person or thing." },
  shopping: { label: "Shopping", explain: "Product listings with prices." },
  popular_products: { label: "Popular products", explain: "Product listings with prices." },
  paid: { label: "Ads", explain: "Paid Google Ads above or below the results." },
  related_searches: { label: "Related searches", explain: "Other searches people make, at the bottom of the page." },
  people_also_search: { label: "People also search for", explain: "Other searches people make." },
  discussions_and_forums: { label: "Discussions and forums", explain: "Posts from Reddit, Quora and other forums." },
  perspectives: { label: "Perspectives", explain: "Posts and videos from people sharing their experience." },
  twitter: { label: "X (Twitter) posts", explain: "Recent posts from X." },
  carousel: { label: "Carousel", explain: "A scrolling row of results." },
  hotels_pack: { label: "Hotels", explain: "Hotel prices and availability." },
  jobs: { label: "Jobs", explain: "Job listings." },
  events: { label: "Events", explain: "Upcoming events." },
  scholarly_articles: { label: "Scholarly articles", explain: "Research papers." },
  local_services: { label: "Local services ads", explain: "Paid “Google guaranteed” local business ads." },
};
/** Features shown first because they matter most to small businesses. */
const FEATURE_ORDER = ["ai_overview", "local_pack", "featured_snippet", "people_also_ask", "video", "short_videos", "paid", "images", "knowledge_graph", "discussions_and_forums"];
/** Item types that are not "features" from the customer's point of view. */
const NOT_FEATURES = new Set(["organic"]);

export function buildSerpTask(keyword: string, location: Record<string, unknown>, languageId: string, device: Device): Record<string, unknown> {
  return { keyword, ...location, language_code: languageId, device, os: device === "mobile" ? "android" : "windows", depth: SERP_DEPTH };
}

/** Normalised cache key: keyword + location (city-level) + language + device. */
export function serpRequestKey(keyword: string, locationId: string, languageId: string, device: Device): string {
  return `serp:v1:${locationId}:${languageId}:${device}:${keyword}`;
}

export interface SerpRow {
  position: number;
  title: string;
  url: string;
  domain: string;
  description: string | null;
}
export interface SerpFeature {
  id: string;
  label: string;
  explain: string;
}
export interface SerpResult {
  keyword: string;
  locationId: string;
  languageId: string;
  device: Device;
  /** Approximate number of results Google reports. */
  totalResults: number | null;
  organic: SerpRow[];
  features: SerpFeature[];
  /** People also ask questions. */
  questions: string[];
  /** Domains quoted in Google's AI Overview. */
  aiOverviewSources: string[];
  featuredSnippet: { domain: string; url: string; title: string } | null;
  localPack: { title: string; domain: string | null }[];
}

export function cleanDomain(d: string | null | undefined): string | null {
  if (!d) return null;
  const host = d.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/^www\./, "").replace(/\.$/, "");
  return host && /^[a-z0-9.-]+$/.test(host) ? host : null;
}

function domainOf(item: Record<string, unknown>): string | null {
  const d = cleanDomain(str(item.domain));
  if (d) return d;
  const u = str(item.url);
  if (!u) return null;
  try {
    return cleanDomain(new URL(u).hostname);
  } catch {
    return null;
  }
}

function safeUrl(u: string | null): string | null {
  if (!u) return null;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.toString() : null;
  } catch {
    return null;
  }
}

function collectReferenceDomains(node: unknown, out: Set<string>, depth = 0) {
  if (depth > 4) return;
  if (Array.isArray(node)) {
    for (const n of node) collectReferenceDomains(n, out, depth + 1);
    return;
  }
  if (!isObj(node)) return;
  for (const r of arr(node.references)) {
    if (!isObj(r)) continue;
    const d = domainOf(r);
    if (d) out.add(d);
  }
  if (Array.isArray(node.items)) collectReferenceDomains(node.items, out, depth + 1);
}

/** Parse `tasks[0].result` of /serp/google/organic/live/advanced. Never throws; unknown fields are ignored. */
export function parseSerp(result: unknown[], meta: { keyword: string; locationId: string; languageId: string; device: Device }): SerpResult {
  const first = result.find(isObj) ?? {};
  const items = arr(first.items).filter(isObj);

  const featureIds = new Set<string>();
  for (const t of arr(first.item_types)) {
    const id = str(t);
    if (id && !NOT_FEATURES.has(id)) featureIds.add(id);
  }

  const organic: SerpRow[] = [];
  const questions: string[] = [];
  const aiSources = new Set<string>();
  const localPack: { title: string; domain: string | null }[] = [];
  let featuredSnippet: SerpResult["featuredSnippet"] = null;

  for (const it of items) {
    const type = str(it.type);
    if (!type) continue;
    if (!NOT_FEATURES.has(type)) featureIds.add(type);
    if (type === "organic") {
      const url = safeUrl(str(it.url));
      const domain = domainOf(it);
      if (!url || !domain) continue;
      organic.push({
        position: num(it.rank_group) ?? num(it.rank_absolute) ?? organic.length + 1,
        title: (str(it.title) ?? domain).slice(0, 300),
        url,
        domain,
        description: str(it.description)?.slice(0, 400) ?? null,
      });
      if (it.is_featured_snippet === true) featureIds.add("featured_snippet");
    } else if (type === "people_also_ask") {
      for (const q of arr(it.items)) {
        const title = isObj(q) ? str(q.title) : null;
        if (title && questions.length < 10 && !questions.includes(title)) questions.push(title.slice(0, 300));
      }
    } else if (type === "ai_overview") {
      collectReferenceDomains(it, aiSources);
    } else if (type === "featured_snippet" && !featuredSnippet) {
      const domain = domainOf(it);
      const url = safeUrl(str(it.url));
      if (domain && url) featuredSnippet = { domain, url, title: (str(it.title) ?? domain).slice(0, 300) };
    } else if (type === "local_pack" && localPack.length < 5) {
      const title = str(it.title);
      if (title) localPack.push({ title: title.slice(0, 200), domain: domainOf(it) });
    }
  }

  organic.sort((a, b) => a.position - b.position);
  const top = organic.slice(0, SERP_TOP_N);

  const order = (id: string) => {
    const i = FEATURE_ORDER.indexOf(id);
    return i === -1 ? FEATURE_ORDER.length : i;
  };
  const features = [...featureIds]
    .filter((id) => /^[a-z_]{2,40}$/.test(id))
    .sort((a, b) => order(a) - order(b) || a.localeCompare(b))
    .map((id) => ({ id, ...(SERP_FEATURE_INFO[id] ?? { label: id.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), explain: "Another kind of Google result box." }) }));

  return {
    ...meta,
    totalResults: num(first.se_results_count),
    organic: top,
    features,
    questions,
    aiOverviewSources: [...aiSources].slice(0, 20),
    featuredSnippet,
    localPack,
  };
}

// ---- highlighting ------------------------------------------------------------------------------------------------

export type RowMatch = "you" | "competitor" | null;
export interface AnnotatedSerp extends SerpResult {
  organic: (SerpRow & { match: RowMatch; competitorName?: string })[];
  you: { domain: string | null; position: number | null; inAiOverview: boolean; hasFeaturedSnippet: boolean };
  competitorsFound: { name: string; domain: string; position: number }[];
}

/** True when `host` is `target` or one of its subdomains (blog.acme.in matches acme.in). */
export function sameSite(host: string, target: string): boolean {
  return host === target || host.endsWith(`.${target}`);
}

/** The saved competitors on a project (Project.competitors = [{ name, domain, aliases }]), cleaned and de-duplicated. */
export function projectCompetitors(raw: unknown): { name: string; domain: string }[] {
  const out: { name: string; domain: string }[] = [];
  for (const c of arr(raw)) {
    if (!isObj(c)) continue;
    const domain = cleanDomain(str(c.domain));
    if (!domain || out.some((o) => o.domain === domain)) continue;
    out.push({ name: (str(c.name) ?? domain).slice(0, 100), domain });
  }
  return out.slice(0, 25);
}

export function annotateSerp(serp: SerpResult, ownDomain: string | null, competitors: { name: string; domain: string }[]): AnnotatedSerp {
  const own = cleanDomain(ownDomain);
  const organic = serp.organic.map((r) => {
    if (own && sameSite(r.domain, own)) return { ...r, match: "you" as const };
    const c = competitors.find((x) => sameSite(r.domain, x.domain));
    return c ? { ...r, match: "competitor" as const, competitorName: c.name } : { ...r, match: null };
  });
  const competitorsFound: AnnotatedSerp["competitorsFound"] = [];
  for (const r of organic) {
    if (r.match === "competitor" && !competitorsFound.some((c) => c.name === r.competitorName)) {
      competitorsFound.push({ name: r.competitorName!, domain: r.domain, position: r.position });
    }
  }
  return {
    ...serp,
    organic,
    you: {
      domain: own,
      position: organic.find((r) => r.match === "you")?.position ?? null,
      inAiOverview: !!own && serp.aiOverviewSources.some((d) => sameSite(d, own)),
      hasFeaturedSnippet: !!own && !!serp.featuredSnippet && sameSite(serp.featuredSnippet.domain, own),
    },
    competitorsFound,
  };
}
