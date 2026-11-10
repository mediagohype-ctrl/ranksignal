// Competitors page service: paid DataForSEO Labs lookups (traffic estimates, top keywords/pages, keyword gap,
// side-by-side comparison, batch traffic, suggested competitors) and the cached snapshots the page reads.
// Every paid call is an explicit user action; viewing reads CompetitorSnapshot rows only and never re-bills.
// All queries are scoped by organizationId + projectId (the caller has already checked the project belongs to the org).
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { usdInrRate } from "@/lib/admin/money";
import { dfsConfigured, dfsPost } from "@/lib/dataforseo/client";
import { allowanceStatus, type AllowanceStatus } from "@/lib/dataforseo/usage";
import { DFS_LOCATIONS, countryCodeFor, languageCode, locationById, normaliseDomain, type LanguageId } from "@/lib/dataforseo/locations";
import {
  parseBulkTraffic, parseCompetitorSuggestions, parseDomainOverview, parseKeywordGap, parseRankedKeywords,
} from "./parse";
import {
  GAP_TOP, UNITS, batchMaxDomains, batchUnits,
  type BatchRow, type DomainOverview, type GapKeyword, type RankedKeywordsResult, type SuggestedCompetitor,
} from "./shared";

// ---------- Endpoints and cost estimates (micro-USD, deliberately high) ----------

export const LABS = {
  overview: "/v3/dataforseo_labs/google/domain_rank_overview/live",
  ranked: "/v3/dataforseo_labs/google/ranked_keywords/live",
  intersection: "/v3/dataforseo_labs/google/domain_intersection/live",
  bulkTraffic: "/v3/dataforseo_labs/google/bulk_traffic_estimation/live",
  competitors: "/v3/dataforseo_labs/google/competitors_domain/live",
} as const;
/** Labs bills per task plus per returned item; these are high estimates reserved against the owner's daily budget. */
export const LABS_CALL_MICROS = 15_000;
export const LABS_ITEM_MICROS = 150;
export const RANKED_KEYWORDS_LIMIT = 100;
export const GAP_LIMIT_PER_CALL = 300;
export const SUGGEST_LIMIT = 20;
const estimate = (items: number) => LABS_CALL_MICROS + items * LABS_ITEM_MICROS;

export type SnapshotKind = "overview" | "top_keywords" | "gap" | "compare" | "batch" | "suggestions";
/** Labs data is country-level, so only country locations are offered here. */
export const COUNTRY_LOCATIONS = DFS_LOCATIONS.filter((l) => l.locationCode !== undefined).map((l) => ({ id: l.id, label: l.label }));

export interface Market {
  locationId: string;
  language: LanguageId;
}
/** Clean a requested market: unknown or city ids fall back to their country (Labs is country-level). */
export function marketOf(locationId: unknown, language: unknown): Market {
  const loc = locationById(typeof locationId === "string" ? locationId : null);
  const country = DFS_LOCATIONS.find((l) => l.locationCode === countryCodeFor(loc.id)) ?? DFS_LOCATIONS[0];
  return { locationId: country.id, language: languageCode(typeof language === "string" ? language : null) };
}
const labsMarket = (m: Market) => ({ location_code: countryCodeFor(m.locationId), language_code: m.language });
const keyOf = (parts: string, m: Market) => `${parts}|${m.locationId}|${m.language}`;

export interface Actor {
  organizationId: string;
  projectId: string;
  userId: string;
}

async function saveSnapshot(a: Actor, kind: SnapshotKind, key: string, m: Market, data: unknown, costMicros: number) {
  const json = data as Prisma.InputJsonValue;
  return db.competitorSnapshot.upsert({
    where: { projectId_kind_key: { projectId: a.projectId, kind, key } },
    create: {
      organizationId: a.organizationId, projectId: a.projectId, kind, key, locationId: m.locationId, language: m.language,
      data: json, costMicros, createdById: a.userId,
    },
    update: { data: json, costMicros, createdById: a.userId, locationId: m.locationId, language: m.language },
  });
}

// ---------- Project helpers ----------

export function ownDomainOf(websiteUrl: string | null | undefined): string | null {
  return websiteUrl ? normaliseDomain(websiteUrl) : null;
}

/** Saved competitor domains from Project.competitors ({name, domain?, aliases[]}[]), normalised and de-duplicated. */
export function savedCompetitorDomains(competitors: unknown, own?: string | null): string[] {
  const out: string[] = [];
  for (const c of Array.isArray(competitors) ? competitors : []) {
    const raw = c && typeof c === "object" && typeof (c as { domain?: unknown }).domain === "string" ? (c as { domain: string }).domain : null;
    const d = raw ? normaliseDomain(raw) : null;
    if (d && d !== own && !out.includes(d)) out.push(d);
  }
  return out;
}

/** Project.competitors allows at most 20 entries (src/lib/dashboard/project-schema.ts). */
export const MAX_SAVED_COMPETITORS = 20;

// ---------- Paid actions ----------

export interface TrafficOutcome {
  ok: DomainOverview[];
  failed: string[];
}

/** Traffic overview for up to 5 domains: one domain_rank_overview call (1 unit) each. Partial success is kept. */
export async function runTrafficCheck(a: Actor, domains: string[], m: Market): Promise<TrafficOutcome> {
  const ok: DomainOverview[] = [];
  const failed: string[] = [];
  let firstError: unknown = null;
  for (const domain of domains) {
    try {
      const r = await dfsPost(LABS.overview, [{ target: domain, ...labsMarket(m) }], {
        feature: "competitor_traffic", organizationId: a.organizationId, projectId: a.projectId,
        estimateMicros: estimate(1), units: UNITS.trafficPerDomain,
      });
      const row = parseDomainOverview(domain, r.result);
      await saveSnapshot(a, "overview", keyOf(domain, m), m, row, r.costMicros);
      ok.push(row);
    } catch (err) {
      log.warn("competitors.traffic_failed", { domain, error: (err as Error)?.message });
      failed.push(domain);
      firstError ??= err;
    }
  }
  if (ok.length === 0 && firstError) throw firstError;
  return { ok, failed };
}

/** Top keywords (by estimated visits) and top pages for one domain: ranked_keywords, limit 100, 1 unit. */
export async function runTopKeywords(a: Actor, domain: string, m: Market): Promise<RankedKeywordsResult> {
  const r = await dfsPost(
    LABS.ranked,
    [{ target: domain, ...labsMarket(m), limit: RANKED_KEYWORDS_LIMIT, order_by: ["ranked_serp_element.serp_item.etv,desc"] }],
    { feature: "competitor_traffic", organizationId: a.organizationId, projectId: a.projectId, estimateMicros: estimate(RANKED_KEYWORDS_LIMIT), units: UNITS.topKeywords },
  );
  const data = parseRankedKeywords(domain, r.result);
  await saveSnapshot(a, "top_keywords", keyOf(domain, m), m, data, r.costMicros);
  return data;
}

export interface GapData {
  competitor: string;
  own: string;
  rows: GapKeyword[];
  /** True when only the "you don't rank at all" half came back (the "you rank below 20" call failed). */
  partial?: boolean;
}

/**
 * Keyword gap (1 unit; the second call is recorded with 0 units): DataForSEO Labs domain_intersection with target1 = competitor and target2 = you.
 *  1. intersections: false → keywords the competitor ranks for and you don't rank for at all (the documented way to get
 *     "target1 only" keywords), filtered to the competitor's top 20;
 *  2. intersections: true with filters competitor ≤ 20 and you > 20 → keywords where you're far behind.
 * Both sorted by search volume; merged and re-checked by parseKeywordGap.
 */
export async function runKeywordGap(a: Actor, competitor: string, own: string, m: Market): Promise<GapData> {
  const base = {
    target1: competitor, target2: own, ...labsMarket(m), limit: GAP_LIMIT_PER_CALL,
    order_by: ["keyword_data.keyword_info.search_volume,desc"],
  };
  const opts = { feature: "keyword_gap" as const, organizationId: a.organizationId, projectId: a.projectId, estimateMicros: estimate(GAP_LIMIT_PER_CALL), units: 1 };
  const missing = await dfsPost(LABS.intersection, [{ ...base, intersections: false, filters: ["first_domain_serp_element.rank_group", "<=", GAP_TOP] }], opts);
  // The first call already answered (and was billed): if the second fails, keep what we have and say so.
  let behind: { result: unknown[]; costMicros: number } | null = null;
  try {
    behind = await dfsPost(
      LABS.intersection,
      [{
        ...base, intersections: true,
        filters: [["first_domain_serp_element.rank_group", "<=", GAP_TOP], "and", ["second_domain_serp_element.rank_group", ">", GAP_TOP]],
      }],
      { ...opts, units: 0 },
    );
  } catch (err) {
    log.warn("competitors.gap_second_call_failed", { error: (err as Error)?.message });
  }
  const data: GapData = {
    competitor, own,
    rows: parseKeywordGap(behind ? [missing.result, behind.result] : [missing.result]),
    ...(behind ? {} : { partial: true }),
  };
  await saveSnapshot(a, "gap", keyOf(`${competitor}>${own}`, m), m, data, missing.costMicros + (behind?.costMicros ?? 0));
  return data;
}

export interface CompareData {
  domains: string[];
  rows: BatchRow[];
}

/** Side-by-side comparison of up to 5 domains: one bulk_traffic_estimation call, 1 unit. Kept as the latest comparison. */
export async function runCompare(a: Actor, domains: string[], m: Market): Promise<CompareData> {
  const r = await dfsPost(LABS.bulkTraffic, [{ targets: domains, ...labsMarket(m), item_types: ["organic"] }], {
    feature: "domain_compare", organizationId: a.organizationId, projectId: a.projectId, estimateMicros: estimate(domains.length), units: UNITS.compare,
  });
  const data: CompareData = { domains, rows: parseBulkTraffic(domains, r.result) };
  await saveSnapshot(a, "compare", "latest", m, data, r.costMicros);
  return data;
}

export interface BatchData {
  domains: string[];
  invalid: string[];
  rows: BatchRow[];
}

/** Batches kept per project (older ones are deleted). */
export const BATCHES_KEPT = 5;

/** Batch traffic for up to 200 domains: one bulk_traffic_estimation call, ceil(n / 50) units. */
export async function runBatch(a: Actor, domains: string[], invalid: string[], m: Market): Promise<BatchData> {
  const r = await dfsPost(LABS.bulkTraffic, [{ targets: domains, ...labsMarket(m), item_types: ["organic"] }], {
    feature: "domain_compare", organizationId: a.organizationId, projectId: a.projectId,
    estimateMicros: estimate(domains.length), units: batchUnits(domains.length),
  });
  const data: BatchData = { domains, invalid, rows: parseBulkTraffic(domains, r.result) };
  const key = keyOf(`batch:${createHash("sha256").update(domains.join(",")).digest("hex").slice(0, 24)}`, m);
  await saveSnapshot(a, "batch", key, m, data, r.costMicros);
  const old = await db.competitorSnapshot.findMany({
    where: { organizationId: a.organizationId, projectId: a.projectId, kind: "batch" },
    orderBy: { updatedAt: "desc" },
    skip: BATCHES_KEPT,
    select: { id: true },
  });
  if (old.length) {
    await db.competitorSnapshot.deleteMany({ where: { organizationId: a.organizationId, projectId: a.projectId, id: { in: old.map((o) => o.id) } } });
  }
  return data;
}

export interface SuggestionsData {
  own: string;
  items: SuggestedCompetitor[];
}

/** Competitors Google sees for your domain (competitors_domain), minus the ones you already saved. 1 unit. */
export async function runSuggestions(a: Actor, own: string, saved: string[], m: Market): Promise<SuggestionsData> {
  const r = await dfsPost(
    LABS.competitors,
    [{ target: own, ...labsMarket(m), limit: SUGGEST_LIMIT, exclude_top_domains: true }],
    { feature: "domain_compare", organizationId: a.organizationId, projectId: a.projectId, estimateMicros: estimate(SUGGEST_LIMIT), units: UNITS.suggestions },
  );
  const data: SuggestionsData = { own, items: parseCompetitorSuggestions(r.result, [own, ...saved]) };
  await saveSnapshot(a, "suggestions", keyOf(own, m), m, data, r.costMicros);
  return data;
}

// ---------- Add a suggested competitor to the project's list ----------

export type AddCompetitorResult = { added: true } | { added: false; reason: "exists" | "full" | "own" };

/** Append {name: domain, domain, aliases: []} to Project.competitors when it isn't there yet (max 20). */
export async function addSavedCompetitor(organizationId: string, projectId: string, domain: string): Promise<AddCompetitorResult> {
  const p = await db.project.findFirst({ where: { id: projectId, organizationId }, select: { competitors: true, websiteUrl: true } });
  if (!p) return { added: false, reason: "exists" };
  if (ownDomainOf(p.websiteUrl) === domain) return { added: false, reason: "own" };
  const list = Array.isArray(p.competitors) ? (p.competitors as unknown[]) : [];
  if (savedCompetitorDomains(list).includes(domain)) return { added: false, reason: "exists" };
  if (list.length >= MAX_SAVED_COMPETITORS) return { added: false, reason: "full" };
  const next = [...list, { name: domain, domain, aliases: [] }] as Prisma.InputJsonValue;
  await db.project.updateMany({ where: { id: projectId, organizationId }, data: { competitors: next } });
  return { added: true };
}

// ---------- Page view (cached data only — never calls DataForSEO) ----------

export interface SnapshotView<T> {
  key: string;
  locationId: string;
  language: string;
  updatedAt: string;
  data: T;
}

export type CompetitorFeature = "competitor_traffic" | "keyword_gap" | "domain_compare";

export interface CompetitorsView {
  configured: boolean;
  ownDomain: string | null;
  saved: string[];
  canAddCompetitor: boolean;
  allowances: Record<CompetitorFeature, AllowanceStatus>;
  batchMax: number;
  usdInrRate: number;
  locations: { id: string; label: string }[];
  overviews: SnapshotView<DomainOverview>[];
  topKeywords: SnapshotView<RankedKeywordsResult>[];
  gaps: SnapshotView<GapData>[];
  compare: SnapshotView<CompareData> | null;
  batches: SnapshotView<BatchData>[];
  suggestions: SnapshotView<SuggestionsData>[];
}

const KEEP: Record<SnapshotKind, number> = { overview: 40, top_keywords: 10, gap: 10, compare: 1, batch: BATCHES_KEPT, suggestions: 5 };

export async function getCompetitorsView(
  organizationId: string,
  project: { id: string; websiteUrl: string; competitors: unknown },
): Promise<CompetitorsView> {
  const ownDomain = ownDomainOf(project.websiteUrl);
  const saved = savedCompetitorDomains(project.competitors, ownDomain);
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } });
  const planId = org?.planId ?? "trial";
  const [traffic, gap, compare] = await Promise.all([
    allowanceStatus(organizationId, planId, "competitor_traffic"),
    allowanceStatus(organizationId, planId, "keyword_gap"),
    allowanceStatus(organizationId, planId, "domain_compare"),
  ]);
  const rows = await db.competitorSnapshot.findMany({
    where: { organizationId, projectId: project.id },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: { kind: true, key: true, locationId: true, language: true, updatedAt: true, data: true },
  });
  const by = <T>(kind: SnapshotKind): SnapshotView<T>[] =>
    rows
      .filter((r) => r.kind === kind)
      .slice(0, KEEP[kind])
      .map((r) => ({ key: r.key, locationId: r.locationId, language: r.language, updatedAt: r.updatedAt.toISOString(), data: r.data as T }));
  const listLength = Array.isArray(project.competitors) ? project.competitors.length : 0;
  return {
    configured: dfsConfigured(),
    ownDomain,
    saved,
    canAddCompetitor: listLength < MAX_SAVED_COMPETITORS,
    allowances: { competitor_traffic: traffic, keyword_gap: gap, domain_compare: compare },
    batchMax: batchMaxDomains(planId),
    usdInrRate: usdInrRate(),
    locations: COUNTRY_LOCATIONS,
    overviews: by<DomainOverview>("overview"),
    topKeywords: by<RankedKeywordsResult>("top_keywords"),
    gaps: by<GapData>("gap"),
    compare: by<CompareData>("compare")[0] ?? null,
    batches: by<BatchData>("batch"),
    suggestions: by<SuggestionsData>("suggestions"),
  };
}
