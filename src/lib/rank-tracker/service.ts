// Rank tracker data access: add/remove tracked keywords, "Check now", the page view and CSV rows. Tenant-scoped
// throughout (every query filters by organizationId). Paid calls happen only in the job (src/lib/rank-tracker/job.ts).
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { DFS_NOT_CONFIGURED, dfsConfigured } from "@/lib/dataforseo/client";
import { allowanceMessage, allowanceStatus, type AllowanceStatus } from "@/lib/dataforseo/usage";
import { locationById, normaliseDomain } from "@/lib/dataforseo/locations";
import { enqueue } from "@/lib/jobs/queue";
import {
  MANUAL_CHECKS_PER_ORG_PER_HOUR, MANUAL_CHECK_MIN_HOURS, maxTrackedKeywordsFor, rankFrequencyFor, type RankDevice, type RankFrequency,
} from "./limits";
import { checkAtOrBefore, manualCheckAvailableAt, positionChange, summarise, type CsvRow, type RankSummary } from "./logic";
import { readCompetitors, readFeatures, type Competitor } from "./parse";

const DAY_MS = 24 * 60 * 60 * 1000;
/** History window loaded for "change since last check" and "this week" (covers weekly checks). */
const CHANGE_WINDOW_DAYS = 16;
export const HISTORY_DAYS = 180;

/** Thrown when the monthly allowance can't cover a check; routes turn it into a 402 { error: "allowance", message }. */
export class AllowanceError extends Error {
  constructor(readonly status: AllowanceStatus) {
    super(allowanceMessage(status));
  }
}

export function allowanceResponse(e: AllowanceError): Response {
  const s = e.status;
  return Response.json(
    { error: "allowance", message: e.message, allowance: { used: s.used, limit: s.limit, remaining: s.remaining, resetsAt: s.resetsAt } },
    { status: 402 },
  );
}

async function planOf(organizationId: string): Promise<string> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } });
  return org?.planId ?? "trial";
}

// ---- add / remove ---------------------------------------------------------------------------------------------------

export interface AddResult {
  added: number;
  skipped: number;
  limit: number;
  /** Active tracked keywords after this call. */
  used: number;
  /** Plain-English note about skipped keywords (already tracked / over the plan limit). */
  note: string | null;
}

export async function addTrackedKeywords(o: {
  organizationId: string;
  projectId: string;
  userId: string;
  keywords: string[];
  locationId: string;
  device: RankDevice;
  language?: string;
}): Promise<AddResult> {
  const limit = maxTrackedKeywordsFor(await planOf(o.organizationId));
  const scope = { organizationId: o.organizationId, projectId: o.projectId };
  const [activeCount, existing] = await Promise.all([
    db.trackedKeyword.count({ where: { ...scope, active: true } }),
    db.trackedKeyword.findMany({
      where: { ...scope, keyword: { in: o.keywords }, locationId: o.locationId, device: o.device },
      select: { id: true, keyword: true, active: true },
    }),
  ]);
  const byKeyword = new Map(existing.map((e) => [e.keyword, e]));
  let room = Math.max(0, limit - activeCount);
  let added = 0;
  let already = 0;
  let overLimit = 0;
  const toCreate: string[] = [];
  const toReactivate: string[] = [];
  for (const k of o.keywords) {
    const row = byKeyword.get(k);
    if (row?.active) {
      already++;
      continue;
    }
    if (room <= 0) {
      overLimit++;
      continue;
    }
    room--;
    added++;
    if (row) toReactivate.push(row.id);
    else toCreate.push(k);
  }
  if (toCreate.length) {
    await db.trackedKeyword.createMany({
      data: toCreate.map((keyword) => ({
        ...scope, keyword, locationId: o.locationId, device: o.device, language: o.language ?? "en", createdById: o.userId,
      })),
      skipDuplicates: true,
    });
  }
  if (toReactivate.length) {
    await db.trackedKeyword.updateMany({ where: { ...scope, id: { in: toReactivate } }, data: { active: true } });
  }
  const notes: string[] = [];
  if (already) notes.push(`${already} ${already === 1 ? "was" : "were"} already tracked for this location and device`);
  if (overLimit) notes.push(`${overLimit} didn't fit — your plan tracks up to ${limit.toLocaleString("en-IN")} keywords per website`);
  return { added, skipped: already + overLimit, limit, used: activeCount + added, note: notes.length ? `${notes.join("; ")}.` : null };
}

export async function removeTrackedKeywords(organizationId: string, projectId: string, ids: string[]): Promise<number> {
  const r = await db.trackedKeyword.deleteMany({ where: { organizationId, projectId, id: { in: ids } } });
  return r.count;
}

// ---- check now ------------------------------------------------------------------------------------------------------

export async function requestCheckNow(organizationId: string, projectId: string, now = new Date()): Promise<{ queued: number; nextManualAt: string }> {
  if (!dfsConfigured()) throw new HttpError(501, "not_configured", DFS_NOT_CONFIGURED);
  const state = await db.rankTrackerState.findFirst({ where: { organizationId, projectId } });
  const waitUntil = manualCheckAvailableAt(state?.lastManualCheckAt ?? null, MANUAL_CHECK_MIN_HOURS, now);
  if (waitUntil) {
    throw new HttpError(429, "check_limit", "You can use “Check now” once a day per website. Your keywords are also checked automatically on schedule.", {
      availableAt: waitUntil.toISOString(),
    });
  }
  const active = await db.trackedKeyword.count({ where: { organizationId, projectId, active: true } });
  if (active === 0) throw new HttpError(400, "no_keywords", "Add a keyword to track first.");
  const allowance = await allowanceStatus(organizationId, await planOf(organizationId), "rank_tracker", now);
  if (allowance.remaining < 1) throw new AllowanceError(allowance);
  const rl = checkRateLimit(`rank-check:${organizationId}`, MANUAL_CHECKS_PER_ORG_PER_HOUR, 60 * 60_000, now.getTime());
  if (!rl.allowed) throw new HttpError(429, "rate_limited", "Too many checks from this workspace in the last hour. Please try again later.");

  await db.rankTrackerState.upsert({
    where: { projectId },
    create: { organizationId, projectId, lastManualCheckAt: now, status: "active", message: null },
    update: { lastManualCheckAt: now },
  });
  await enqueue({
    kind: "rank_tracker",
    organizationId,
    projectId,
    input: { projectId, trigger: "manual", since: now.toISOString() },
    idempotencyKey: `rank:manual:${projectId}:${now.toISOString().slice(0, 13)}`,
    maxAttempts: 3,
  });
  return { queued: Math.min(active, allowance.remaining), nextManualAt: new Date(now.getTime() + MANUAL_CHECK_MIN_HOURS * 3_600_000).toISOString() };
}

// ---- page view ------------------------------------------------------------------------------------------------------

export interface RankRow {
  id: string;
  keyword: string;
  locationId: string;
  locationLabel: string;
  device: string;
  checked: boolean;
  position: number | null;
  /** Places moved since the previous check (positive = up). */
  change: number | null;
  /** Places moved vs about a week ago (positive = up). */
  weekChange: number | null;
  best: number | null;
  url: string | null;
  features: string[];
  competitors: Competitor[];
  lastCheckedAt: string | null;
  lastError: string | null;
}

export interface RankTrackerView {
  configured: boolean;
  domain: string | null;
  frequency: RankFrequency;
  limit: number;
  allowance: { used: number; limit: number; remaining: number; resetsAt: string };
  state: { status: string; message: string | null; lastRunAt: string | null; nextManualAt: string | null; running: boolean };
  summary: RankSummary;
  rows: RankRow[];
  /** Starred Search Console keywords not yet tracked (for one-click import). */
  starred: string[];
}

export async function getRankTrackerView(organizationId: string, projectId: string, websiteUrl: string, now = new Date()): Promise<RankTrackerView> {
  const planId = await planOf(organizationId);
  const scope = { organizationId, projectId };
  const [keywords, state, allowance, stars, running] = await Promise.all([
    db.trackedKeyword.findMany({ where: { ...scope, active: true }, orderBy: [{ createdAt: "asc" }, { keyword: "asc" }] }),
    db.rankTrackerState.findFirst({ where: scope }),
    allowanceStatus(organizationId, planId, "rank_tracker", now),
    db.keywordStar.findMany({ where: scope, select: { query: true }, orderBy: { createdAt: "desc" }, take: 300 }),
    db.workflowRun.findFirst({
      where: { organizationId, projectId, kind: "rank_tracker", state: { in: ["queued", "running", "retry_scheduled"] } },
      select: { id: true },
    }),
  ]);

  const ids = keywords.map((k) => k.id);
  const recent = ids.length
    ? await db.rankCheck.findMany({
        where: { organizationId, trackedKeywordId: { in: ids }, checkedAt: { gte: new Date(now.getTime() - CHANGE_WINDOW_DAYS * DAY_MS) } },
        select: { trackedKeywordId: true, position: true, checkedAt: true },
        orderBy: { checkedAt: "desc" },
      })
    : [];
  const byKeyword = new Map<string, { position: number | null; checkedAt: Date }[]>();
  for (const c of recent) {
    const list = byKeyword.get(c.trackedKeywordId) ?? [];
    list.push(c);
    byKeyword.set(c.trackedKeywordId, list);
  }
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS + 3 * 3_600_000);

  const rows: RankRow[] = keywords.map((k) => {
    const checks = byKeyword.get(k.id) ?? [];
    // A successful check always stores lastFeatures (at least []); a failed one only sets lastError.
    const checked = checks.length > 0 || (k.lastFeatures !== null && k.lastFeatures !== undefined);
    const prev = checks[1];
    const base = checkAtOrBefore(checks.slice(1), weekAgo);
    return {
      id: k.id,
      keyword: k.keyword,
      locationId: k.locationId,
      locationLabel: locationById(k.locationId).label,
      device: k.device,
      checked,
      position: checked ? k.lastPosition : null,
      change: checks.length ? positionChange(checks[0].position, prev?.position, prev !== undefined) : null,
      weekChange: checks.length ? positionChange(checks[0].position, base?.position, base !== undefined) : null,
      best: k.bestPosition,
      url: k.lastUrl,
      features: readFeatures(k.lastFeatures),
      competitors: readCompetitors(k.lastCompetitors),
      lastCheckedAt: k.lastCheckedAt?.toISOString() ?? null,
      lastError: k.lastError,
    };
  });

  const tracked = new Set(keywords.map((k) => k.keyword));
  const nextManual = manualCheckAvailableAt(state?.lastManualCheckAt ?? null, MANUAL_CHECK_MIN_HOURS, now);
  return {
    configured: dfsConfigured(),
    domain: normaliseDomain(websiteUrl),
    frequency: rankFrequencyFor(planId),
    limit: maxTrackedKeywordsFor(planId),
    allowance: { used: allowance.used, limit: allowance.limit, remaining: allowance.remaining, resetsAt: allowance.resetsAt },
    state: {
      status: state?.status ?? "active",
      message: state?.message ?? null,
      lastRunAt: state?.lastRunAt?.toISOString() ?? null,
      nextManualAt: nextManual?.toISOString() ?? null,
      running: running !== null,
    },
    summary: summarise(rows.map((r) => ({ position: r.position, checked: r.checked, weekChange: r.weekChange }))),
    rows,
    starred: stars.map((s) => s.query).filter((q) => !tracked.has(q)).slice(0, 100),
  };
}

/** One keyword's position history (oldest first) for the chart. */
export async function keywordHistory(organizationId: string, projectId: string, trackedKeywordId: string, now = new Date()) {
  const k = await db.trackedKeyword.findFirst({ where: { id: trackedKeywordId, organizationId, projectId }, select: { id: true, keyword: true } });
  if (!k) throw new HttpError(404, "not_found", "Keyword not found");
  const checks = await db.rankCheck.findMany({
    where: { organizationId, trackedKeywordId: k.id, checkedAt: { gte: new Date(now.getTime() - HISTORY_DAYS * DAY_MS) } },
    select: { checkedAt: true, position: true },
    orderBy: { checkedAt: "asc" },
    take: 400,
  });
  return { keyword: k.keyword, points: checks.map((c) => ({ checkedAt: c.checkedAt.toISOString(), position: c.position })) };
}

export function csvRows(view: RankTrackerView): CsvRow[] {
  return view.rows.map((r) => ({
    keyword: r.keyword,
    location: r.locationLabel,
    device: r.device,
    position: r.position,
    change: r.change,
    best: r.best,
    url: r.url,
    features: r.features,
    above: r.competitors.map((c) => `${c.domain} (#${c.position})`),
    checkedAt: r.lastCheckedAt,
  }));
}
