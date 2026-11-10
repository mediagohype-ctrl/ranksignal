// Keyword research + SERP checker: the paid lookups (DataForSEO), the shared 30-day / 24-hour result cache, the
// per-organization "recent searches" history and the plan allowance. Server-only. Every tenant query is scoped by
// organizationId + projectId; the cache holds public Google data only, so it is shared across organizations.
import type { Prisma } from "@prisma/client";
import { HttpError } from "@/lib/api";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { isAiBudgetExhausted } from "@/lib/billing/ai-budget";
import { db } from "@/lib/db";
import { DFS_NOT_CONFIGURED, DfsError, dfsConfigured, dfsPost } from "@/lib/dataforseo/client";
import { countryCodeFor, languageCode, locationById, locationFields } from "@/lib/dataforseo/locations";
import { allowanceMessage, allowanceStatus, type AllowanceStatus } from "@/lib/dataforseo/usage";
import { log } from "@/lib/log";
import {
  KEYWORD_CACHE_MS, KEYWORD_ESTIMATE_MICROS, KEYWORD_PATHS, buildKeywordTask, keywordRequestKey, parseKeywordIdeas,
  type KeywordMode, type KeywordResult,
} from "./keywords";
import {
  SERP_CACHE_MS, SERP_ESTIMATE_MICROS, SERP_PATH, annotateSerp, buildSerpTask, cleanDomain, parseSerp, projectCompetitors, serpRequestKey,
  type AnnotatedSerp, type Device, type SerpResult,
} from "./serp";

export type ResearchKind = "keywords" | "serp";
const FEATURE = { keywords: "keyword_research", serp: "serp_checker" } as const;
const TTL: Record<ResearchKind, number> = { keywords: KEYWORD_CACHE_MS, serp: SERP_CACHE_MS };

/** Paid lookups per organization per 10 minutes (per tool) — stops a stuck button or a script draining the allowance. */
export const RESEARCH_RATE_LIMIT = { perOrg: 20, windowMs: 10 * 60 * 1000 } as const;
const RECENT_LIMIT = 12;

export interface RecentSearch {
  id: string;
  query: string;
  locationId: string;
  languageId: string;
  device: string | null;
  mode: string | null;
  resultCount: number;
  createdAt: string;
}

export interface ResearchOverview {
  configured: boolean;
  allowance: AllowanceStatus;
  recent: RecentSearch[];
}

/** Thrown when the monthly allowance is used up; routes turn it into a 402 `{ error: "allowance", message }`. */
export class AllowanceExhaustedError extends Error {
  constructor(readonly status: AllowanceStatus) {
    super(allowanceMessage(status));
  }
}

async function planOf(organizationId: string): Promise<string | null> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } });
  return org?.planId ?? null;
}

export async function researchAllowance(organizationId: string, kind: ResearchKind): Promise<AllowanceStatus> {
  return allowanceStatus(organizationId, await planOf(organizationId), FEATURE[kind]);
}

export async function recentSearches(organizationId: string, projectId: string, kind: ResearchKind): Promise<RecentSearch[]> {
  const rows = await db.researchSearch.findMany({
    where: { organizationId, projectId, kind },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const seen = new Set<string>();
  const out: RecentSearch[] = [];
  for (const r of rows) {
    if (seen.has(r.requestKey)) continue;
    seen.add(r.requestKey);
    out.push({
      id: r.id,
      query: r.query,
      locationId: r.locationId,
      languageId: r.languageId,
      device: r.device,
      mode: r.mode,
      resultCount: r.resultCount,
      createdAt: r.createdAt.toISOString(),
    });
    if (out.length >= RECENT_LIMIT) break;
  }
  return out;
}

export async function researchOverview(organizationId: string, projectId: string, kind: ResearchKind): Promise<ResearchOverview> {
  const [allowance, recent] = await Promise.all([researchAllowance(organizationId, kind), recentSearches(organizationId, projectId, kind)]);
  return { configured: dfsConfigured(), allowance, recent };
}

interface CacheHit<T> {
  result: T;
  fetchedAt: Date;
}

async function readCache<T>(requestKey: string): Promise<CacheHit<T> | null> {
  const row = await db.researchCache.findUnique({ where: { requestKey } });
  return row ? { result: row.result as unknown as T, fetchedAt: row.fetchedAt } : null;
}

async function writeCache(kind: ResearchKind, requestKey: string, result: unknown): Promise<Date> {
  const fetchedAt = new Date();
  const json = result as Prisma.InputJsonValue;
  try {
    await db.researchCache.upsert({
      where: { requestKey },
      create: { kind, requestKey, result: json, fetchedAt },
      update: { result: json, fetchedAt },
    });
  } catch (err) {
    // The paid call already succeeded; a cache write failure must not lose the answer.
    log.warn("research.cache_write_failed", { kind, error: (err as Error)?.message });
  }
  return fetchedAt;
}

export function isFresh(fetchedAt: Date, kind: ResearchKind, now = Date.now()): boolean {
  return now - fetchedAt.getTime() < TTL[kind];
}

interface LookupContext {
  organizationId: string;
  projectId: string;
  userId: string;
}

/**
 * Serve from the cache when fresh (free), otherwise check configuration, allowance and rate limit, then make ONE paid
 * call. Returns the parsed result and whether it came from the cache.
 */
async function cachedOrPaid<T>(
  kind: ResearchKind,
  requestKey: string,
  ctx: LookupContext,
  paid: () => Promise<T>,
  now = Date.now(),
): Promise<{ result: T; fetchedAt: Date; fromCache: boolean }> {
  const cached = await readCache<T>(requestKey);
  if (cached && isFresh(cached.fetchedAt, kind, now)) return { ...cached, fromCache: true };
  if (!dfsConfigured()) {
    if (cached) return { ...cached, fromCache: true }; // older answer is better than nothing; the page shows its date
    throw new HttpError(501, "not_configured", DFS_NOT_CONFIGURED);
  }
  const status = await researchAllowance(ctx.organizationId, kind);
  if (status.remaining < 1) throw new AllowanceExhaustedError(status);
  const rl = checkRateLimit(`research:${kind}:${ctx.organizationId}`, RESEARCH_RATE_LIMIT.perOrg, RESEARCH_RATE_LIMIT.windowMs, now);
  if (!rl.allowed) {
    throw new HttpError(429, "rate_limited", `That's a lot of searches in a few minutes. Please wait ${Math.ceil(rl.retryAfterSec / 60)} minute(s) and try again.`);
  }
  let result: T;
  try {
    result = await paid();
  } catch (err) {
    if (isAiBudgetExhausted(err)) {
      throw new HttpError(503, "busy", "Live Google data is paused for the rest of today because of high demand. Nothing was counted against your allowance. Please try again tomorrow.");
    }
    if (err instanceof DfsError) {
      log.warn("research.provider_error", { kind, error: err.message, statusCode: err.statusCode });
      throw new HttpError(502, "provider_error", "We couldn't get Google data right now. Nothing was counted against your allowance. Please try again in a few minutes.");
    }
    throw err;
  }
  const fetchedAt = await writeCache(kind, requestKey, result);
  return { result, fetchedAt, fromCache: false };
}

async function recordSearch(
  ctx: LookupContext,
  data: { kind: ResearchKind; query: string; locationId: string; languageId: string; device?: string; mode?: string; requestKey: string; resultCount: number; fromCache: boolean },
): Promise<string | null> {
  try {
    const row = await db.researchSearch.create({
      data: { organizationId: ctx.organizationId, projectId: ctx.projectId, userId: ctx.userId, ...data },
    });
    return row.id;
  } catch (err) {
    log.warn("research.history_write_failed", { kind: data.kind, error: (err as Error)?.message });
    return null;
  }
}

// ---- keyword ideas ----------------------------------------------------------------------------------------------

export interface KeywordLookupInput {
  seed: string; // already normalised (normaliseKeyword)
  locationId: string;
  languageId: string;
  mode: KeywordMode;
}

export interface KeywordLookupResponse {
  searchId: string | null;
  result: KeywordResult;
  fetchedAt: string;
  fromCache: boolean;
  fresh: boolean;
  /** Labs volumes are country-level: true when a city was picked and the numbers are for the whole country. */
  countryLevel: boolean;
  allowance: AllowanceStatus;
}

export async function runKeywordLookup(ctx: LookupContext, input: KeywordLookupInput): Promise<KeywordLookupResponse> {
  const location = locationById(input.locationId);
  const languageId = languageCode(input.languageId);
  const countryCode = countryCodeFor(location.id);
  const requestKey = keywordRequestKey(input.seed, countryCode, languageId, input.mode);
  const meta = { seed: input.seed, mode: input.mode, countryCode, languageId };
  const r = await cachedOrPaid<KeywordResult>("keywords", requestKey, ctx, async () => {
    const res = await dfsPost(KEYWORD_PATHS[input.mode], [buildKeywordTask(input.seed, countryCode, languageId, input.mode)], {
      feature: "keyword_research",
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      estimateMicros: KEYWORD_ESTIMATE_MICROS,
      units: 1,
    });
    return parseKeywordIdeas(res.result, meta);
  });
  const searchId = await recordSearch(ctx, {
    kind: "keywords",
    query: input.seed,
    locationId: location.id,
    languageId,
    mode: input.mode,
    requestKey,
    resultCount: r.result.items?.length ?? 0,
    fromCache: r.fromCache,
  });
  return {
    searchId,
    result: r.result,
    fetchedAt: r.fetchedAt.toISOString(),
    fromCache: r.fromCache,
    fresh: isFresh(r.fetchedAt, "keywords"),
    countryLevel: location.locationCode === undefined,
    allowance: await researchAllowance(ctx.organizationId, "keywords"),
  };
}

// ---- Google top 10 ----------------------------------------------------------------------------------------------

export interface SerpLookupInput {
  keyword: string; // already normalised
  locationId: string;
  languageId: string;
  device: Device;
}

export interface SerpLookupResponse {
  searchId: string | null;
  result: AnnotatedSerp;
  fetchedAt: string;
  fromCache: boolean;
  fresh: boolean;
  allowance: AllowanceStatus;
}

interface ProjectLike {
  id: string;
  websiteUrl: string;
  competitors: unknown;
}

function annotateFor(project: ProjectLike, serp: SerpResult): AnnotatedSerp {
  let own: string | null = null;
  try {
    own = cleanDomain(new URL(project.websiteUrl).hostname);
  } catch {
    own = cleanDomain(project.websiteUrl);
  }
  return annotateSerp(serp, own, projectCompetitors(project.competitors));
}

export async function runSerpCheck(ctx: LookupContext, project: ProjectLike, input: SerpLookupInput): Promise<SerpLookupResponse> {
  const location = locationById(input.locationId);
  const languageId = languageCode(input.languageId);
  const requestKey = serpRequestKey(input.keyword, location.id, languageId, input.device);
  const meta = { keyword: input.keyword, locationId: location.id, languageId, device: input.device };
  const r = await cachedOrPaid<SerpResult>("serp", requestKey, ctx, async () => {
    const res = await dfsPost(SERP_PATH, [buildSerpTask(input.keyword, locationFields(location.id), languageId, input.device)], {
      feature: "serp_checker",
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      estimateMicros: SERP_ESTIMATE_MICROS,
      units: 1,
    });
    return parseSerp(res.result, meta);
  });
  const searchId = await recordSearch(ctx, {
    kind: "serp",
    query: input.keyword,
    locationId: location.id,
    languageId,
    device: input.device,
    requestKey,
    resultCount: r.result.organic?.length ?? 0,
    fromCache: r.fromCache,
  });
  return {
    searchId,
    result: annotateFor(project, r.result),
    fetchedAt: r.fetchedAt.toISOString(),
    fromCache: r.fromCache,
    fresh: isFresh(r.fetchedAt, "serp"),
    allowance: await researchAllowance(ctx.organizationId, "serp"),
  };
}

// ---- re-open a past search (free: cache only, never a paid call) -----------------------------------------------

export async function openPastSearch(
  organizationId: string,
  project: ProjectLike,
  kind: ResearchKind,
  searchId: string,
): Promise<{ search: RecentSearch; result: KeywordResult | AnnotatedSerp | null; fetchedAt: string | null; fresh: boolean }> {
  const row = await db.researchSearch.findFirst({ where: { id: searchId, organizationId, projectId: project.id, kind } });
  if (!row) throw new HttpError(404, "not_found", "Search not found");
  const cached = await readCache<KeywordResult | SerpResult>(row.requestKey);
  const search: RecentSearch = {
    id: row.id,
    query: row.query,
    locationId: row.locationId,
    languageId: row.languageId,
    device: row.device,
    mode: row.mode,
    resultCount: row.resultCount,
    createdAt: row.createdAt.toISOString(),
  };
  if (!cached) return { search, result: null, fetchedAt: null, fresh: false };
  const result = kind === "serp" ? annotateFor(project, cached.result as SerpResult) : (cached.result as KeywordResult);
  return { search, result, fetchedAt: cached.fetchedAt.toISOString(), fresh: isFresh(cached.fetchedAt, kind) };
}
