// Pure parsers for the DataForSEO Labs answers used on the Competitors page. No database or network here, so
// everything is unit-tested from sample payloads (tests/competitors/parse.test.ts).
//
// Field names follow the DataForSEO v3 Labs docs (Google):
//   domain_rank_overview  → result[0].items[0].metrics.organic.{pos_1, pos_2_3, pos_4_10, …, pos_91_100, count, etv, estimated_paid_traffic_cost}
//   ranked_keywords       → result[0].{total_count, items[].keyword_data.{keyword, keyword_info.search_volume, keyword_properties.keyword_difficulty},
//                                       items[].ranked_serp_element.serp_item.{rank_group, url, etv}}
//   domain_intersection   → result[0].items[].{keyword_data, first_domain_serp_element, second_domain_serp_element}
//   bulk_traffic_estimation → result[0].items[].{target, metrics.organic.{etv, count, estimated_paid_traffic_cost}}
//   competitors_domain    → result[0].items[].{domain, avg_position, intersections, full_domain_metrics.organic.{etv, count}}
// Shapes vary between accounts and API versions, so nothing here trusts a field to exist.
import { arr, isObj, num, str } from "@/lib/dataforseo/client";
import { normaliseDomain } from "@/lib/dataforseo/locations";
import {
  GAP_TOP,
  type BatchRow,
  type DomainOverview,
  type GapKeyword,
  type RankedKeyword,
  type RankedKeywordsResult,
  type SuggestedCompetitor,
  type TopPage,
} from "./shared";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (isObj(v) ? v : {});
const firstResult = (result: unknown[]): Json => obj(result.find(isObj));
const round = (n: number | null): number | null => (n === null ? null : Math.round(n));
const round1 = (n: number | null): number | null => (n === null ? null : Math.round(n * 10) / 10);

// ---------- Traffic overview (domain_rank_overview) ----------

const POS_BUCKETS_TOP100 = [
  "pos_1", "pos_2_3", "pos_4_10", "pos_11_20", "pos_21_30", "pos_31_40", "pos_41_50", "pos_51_60", "pos_61_70", "pos_71_80", "pos_81_90", "pos_91_100",
];

function sumFields(o: Json, fields: string[]): number | null {
  let total = 0;
  let any = false;
  for (const f of fields) {
    const v = num(o[f]);
    if (v !== null) {
      total += v;
      any = true;
    }
  }
  return any ? total : null;
}

/** Organic metrics block → our numbers. Shared by overview, bulk traffic and competitor suggestions. */
export function organicMetrics(organic: unknown): Omit<DomainOverview, "domain"> {
  const o = obj(organic);
  return {
    traffic: round(num(o.etv)),
    top3: sumFields(o, ["pos_1", "pos_2_3"]),
    top10: sumFields(o, ["pos_1", "pos_2_3", "pos_4_10"]),
    top100: num(o.count) ?? sumFields(o, POS_BUCKETS_TOP100),
    trafficValueUsd: num(o.estimated_paid_traffic_cost),
    newKeywords: num(o.is_new),
    lostKeywords: num(o.is_lost),
  };
}

/** domain_rank_overview result → one row. A domain Google doesn't rank anywhere comes back as zeros, not "no data". */
export function parseDomainOverview(domain: string, result: unknown[]): DomainOverview {
  const items = arr(firstResult(result).items).filter(isObj);
  const organic = items.length ? obj(items[0].metrics).organic : undefined;
  if (!isObj(organic)) return { domain, traffic: 0, top3: 0, top10: 0, top100: 0, trafficValueUsd: 0, newKeywords: null, lostKeywords: null };
  return { domain, ...organicMetrics(organic) };
}

// ---------- Top keywords and pages (ranked_keywords) ----------

function keywordData(item: Json) {
  const kd = obj(item.keyword_data);
  const info = obj(kd.keyword_info);
  const props = obj(kd.keyword_properties);
  const keyword = str(kd.keyword) ?? str(item.keyword);
  return {
    keyword: keyword ? keyword.trim().toLowerCase() : null,
    volume: num(info.search_volume),
    difficulty: round(num(props.keyword_difficulty)),
  };
}

function serpItem(el: unknown) {
  const e = obj(el);
  // ranked_keywords nests the result under serp_item; domain_intersection puts the fields on the element itself.
  const s = isObj(e.serp_item) ? e.serp_item : e;
  return {
    position: num(s.rank_group) ?? num(s.rank_absolute),
    url: str(s.url) ?? str(s.relative_url),
    traffic: num(s.etv),
  };
}

export function parseRankedKeywords(domain: string, result: unknown[], maxPages = 20): RankedKeywordsResult {
  const r = firstResult(result);
  const keywords: RankedKeyword[] = [];
  const seen = new Set<string>();
  for (const it of arr(r.items).filter(isObj)) {
    const { keyword, volume, difficulty } = keywordData(it);
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    const s = serpItem(it.ranked_serp_element);
    keywords.push({ keyword, position: s.position, volume, difficulty, traffic: round1(s.traffic), url: s.url });
  }
  keywords.sort((a, b) => (b.traffic ?? 0) - (a.traffic ?? 0) || (b.volume ?? 0) - (a.volume ?? 0));
  return { domain, totalKeywords: num(r.total_count), keywords, pages: topPages(keywords, maxPages) };
}

/** Group ranked keywords by URL: estimated visits and keyword count per page, biggest first. */
export function topPages(keywords: RankedKeyword[], max = 20): TopPage[] {
  const m = new Map<string, TopPage>();
  for (const k of keywords) {
    if (!k.url) continue;
    const p = m.get(k.url) ?? { url: k.url, traffic: 0, keywords: 0 };
    p.traffic += k.traffic ?? 0;
    p.keywords += 1;
    m.set(k.url, p);
  }
  return [...m.values()]
    .map((p) => ({ ...p, traffic: Math.round(p.traffic) }))
    .sort((a, b) => b.traffic - a.traffic || b.keywords - a.keywords)
    .slice(0, max);
}

// ---------- Keyword gap (domain_intersection) ----------

/**
 * domain_intersection result(s) → gap rows. target1 = competitor, target2 = you. A row is kept only when the
 * competitor is in the top 20 and you are absent or below 20 (checked again here — never trust the filters alone).
 * Sorted by monthly searches, biggest first.
 */
export function parseKeywordGap(results: unknown[][], limit = 300): GapKeyword[] {
  const byKeyword = new Map<string, GapKeyword>();
  for (const result of results) {
    for (const it of arr(firstResult(result).items).filter(isObj)) {
      const { keyword, volume, difficulty } = keywordData(it);
      if (!keyword || byKeyword.has(keyword)) continue;
      const comp = serpItem(it.first_domain_serp_element);
      const you = isObj(it.second_domain_serp_element) ? serpItem(it.second_domain_serp_element) : null;
      if (comp.position === null || comp.position > GAP_TOP) continue;
      if (you && you.position !== null && you.position <= GAP_TOP) continue;
      byKeyword.set(keyword, {
        keyword,
        volume,
        difficulty,
        competitorPosition: comp.position,
        competitorUrl: comp.url,
        yourPosition: you?.position ?? null,
      });
    }
  }
  return [...byKeyword.values()]
    .sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1) || a.keyword.localeCompare(b.keyword))
    .slice(0, limit);
}

// ---------- Batch traffic (bulk_traffic_estimation) ----------

/** Rows come back in the order the domains were asked for; domains DataForSEO skipped show as "no data" (nulls). */
export function parseBulkTraffic(domains: string[], result: unknown[]): BatchRow[] {
  const found = new Map<string, BatchRow>();
  for (const it of arr(firstResult(result).items).filter(isObj)) {
    const target = str(it.target);
    const domain = target ? normaliseDomain(target) : null;
    if (!domain) continue;
    const m = organicMetrics(obj(it.metrics).organic);
    found.set(domain, { domain, traffic: m.traffic, keywords: m.top100, trafficValueUsd: m.trafficValueUsd });
  }
  return domains.map((d) => found.get(d) ?? { domain: d, traffic: null, keywords: null, trafficValueUsd: null });
}

// ---------- Suggested competitors (competitors_domain) ----------

/** Huge sites that "compete" with everyone and aren't useful suggestions for a small business. */
const GIANTS = new Set([
  "google.com", "youtube.com", "wikipedia.org", "en.wikipedia.org", "facebook.com", "instagram.com", "amazon.in", "amazon.com",
  "flipkart.com", "linkedin.com", "twitter.com", "x.com", "reddit.com", "quora.com", "pinterest.com", "justdial.com", "indiamart.com",
]);

export function parseCompetitorSuggestions(result: unknown[], exclude: string[], max = 10): SuggestedCompetitor[] {
  const skip = new Set(exclude);
  const out: SuggestedCompetitor[] = [];
  for (const it of arr(firstResult(result).items).filter(isObj)) {
    const raw = str(it.domain);
    const domain = raw ? normaliseDomain(raw) : null;
    if (!domain || skip.has(domain) || GIANTS.has(domain)) continue;
    skip.add(domain);
    const full = obj(obj(it.full_domain_metrics).organic);
    out.push({
      domain,
      sharedKeywords: num(it.intersections),
      avgPosition: round1(num(it.avg_position)),
      traffic: round(num(full.etv)),
    });
    if (out.length >= max) break;
  }
  return out;
}
