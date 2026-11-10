// Backlink checker + link gap (DataForSEO Backlinks API). Paid calls happen only on an explicit "Refresh" / "Find
// sites" (member+) or the scheduled refresh job; every view reads stored snapshots, so viewing never re-bills.
// Tenant-scoped throughout: every query filters by organizationId (and projectId).
//
// Gating: DataForSEO credentials (dfsConfigured) AND env DATAFORSEO_BACKLINKS_ENABLED="true" (the Backlinks API is a
// separate monthly subscription on the owner's DataForSEO account). If DataForSEO still refuses access, users see
// BACKLINKS_NOT_ENABLED instead of an error.
//
// Allowance: see src/lib/backlinks/limits.ts — one refresh = BACKLINK_UNITS_PER_REFRESH units of "backlinks" (one per
// call, because dfsPost records >= 1 unit per call); one link-gap lookup = 1 unit of "link_gap".
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { HttpError } from "@/lib/api";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getOrgAccess } from "@/lib/billing/access";
import { DFS_NOT_CONFIGURED, DfsError, dfsConfigured, dfsPost } from "@/lib/dataforseo/client";
import { allowanceMessage, allowanceStatus, type AllowanceStatus } from "@/lib/dataforseo/usage";
import { normaliseDomain } from "@/lib/dataforseo/locations";
import { BACKLINKS_NOT_ENABLED, backlinksFlagOn, isBacklinksAccessError } from "./errors";
import {
  BACKLINKS_CALL_ESTIMATE_MICROS, BACKLINK_REFRESHES_PER_HOUR, BACKLINK_UNITS_PER_REFRESH, LINK_GAP_ESTIMATE_MICROS,
  LINK_GAP_LOOKUPS_PER_HOUR, LINK_GAP_MAX_COMPETITORS, LINK_GAP_REPORTS_KEPT, LIST_LIMIT, MANUAL_REFRESH_MIN_HOURS,
  SNAPSHOTS_KEPT, refreshDaysFor, refreshesLeft,
} from "./limits";
import {
  EMPTY_SNAPSHOT_DATA, diffReferringDomains, parseAnchors, parseBacklinks, parseDomainIntersection, parseNewLost,
  parseReferringDomains, parseSummary, readSnapshotData,
  type BacklinkSection, type BacklinkSnapshotData, type DomainChanges, type LinkGapItem,
} from "./parse";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const FAILURE_BACKOFF_MS = 12 * HOUR;
const DUE_SLACK_MS = HOUR;
const MAX_ENQUEUE_PER_TICK = 20;
const NEW_LOST_WEEKS = 12;

// ---- availability ----------------------------------------------------------------------------------------------------

export interface BacklinksAvailability {
  configured: boolean;
  enabled: boolean;
  /** Plain-English reason when a paid call can't run, else null. */
  message: string | null;
}

export function backlinksAvailability(): BacklinksAvailability {
  const configured = dfsConfigured();
  const enabled = configured && backlinksFlagOn();
  return { configured, enabled, message: !configured ? DFS_NOT_CONFIGURED : !enabled ? BACKLINKS_NOT_ENABLED : null };
}

function assertAvailable() {
  const a = backlinksAvailability();
  if (!a.configured) throw new HttpError(501, "dfs_not_configured", DFS_NOT_CONFIGURED);
  if (!a.enabled) throw new HttpError(503, "backlinks_not_enabled", BACKLINKS_NOT_ENABLED);
}

/** The project's own domain, as DataForSEO expects it (no scheme, no www). */
export function projectTarget(websiteUrl: string): string | null {
  return normaliseDomain(websiteUrl);
}

/** Competitor domains saved on the project (Project.competitors: {name, domain?}[]), cleaned and de-duplicated. */
export function savedCompetitorDomains(competitors: unknown, exclude?: string | null): string[] {
  const out: string[] = [];
  for (const c of Array.isArray(competitors) ? competitors : []) {
    const raw = c && typeof c === "object" ? (c as { domain?: unknown }).domain : null;
    const d = typeof raw === "string" ? normaliseDomain(raw) : null;
    if (d && d !== exclude && !out.includes(d)) out.push(d);
  }
  return out.slice(0, 20);
}

function providerError(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  if (isBacklinksAccessError(e)) return new HttpError(503, "backlinks_not_enabled", BACKLINKS_NOT_ENABLED);
  if (e instanceof DfsError && e.errorClass === "transient") {
    return new HttpError(502, "provider_unavailable", "Our backlink data provider didn't answer in time. Please try again in a few minutes.");
  }
  return new HttpError(502, "provider_error", "We couldn't get backlink data right now. Please try again later.");
}

function allowanceError(s: AllowanceStatus): HttpError {
  return new HttpError(402, "allowance", allowanceMessage(s), { used: s.used, limit: s.limit, resetsAt: s.resetsAt });
}

async function planOf(organizationId: string): Promise<string> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } });
  return org?.planId ?? "trial";
}

// ---- refresh ---------------------------------------------------------------------------------------------------------

const common = (target: string) => ({ target, include_subdomains: true });
const listTask = (target: string, extra: Record<string, unknown>) => ({
  ...common(target),
  backlinks_status_type: "live",
  rank_scale: "one_hundred",
  exclude_internal_backlinks: true,
  limit: LIST_LIMIT,
  ...extra,
});

/** Pure: the 5 calls a refresh makes (exported for tests). */
export function refreshCalls(target: string, now = new Date()): { section: BacklinkSection; path: string; task: Record<string, unknown> }[] {
  const dateTo = now.toISOString().slice(0, 10);
  const dateFrom = new Date(now.getTime() - NEW_LOST_WEEKS * 7 * DAY).toISOString().slice(0, 10);
  return [
    {
      section: "summary",
      path: "/v3/backlinks/summary/live",
      task: { ...common(target), backlinks_status_type: "live", rank_scale: "one_hundred", internal_list_limit: 1 },
    },
    { section: "referringDomains", path: "/v3/backlinks/referring_domains/live", task: listTask(target, { order_by: ["rank,desc"] }) },
    {
      section: "backlinks",
      path: "/v3/backlinks/backlinks/live",
      task: listTask(target, { mode: "one_per_domain", order_by: ["domain_from_rank,desc"] }),
    },
    { section: "anchors", path: "/v3/backlinks/anchors/live", task: listTask(target, { order_by: ["referring_domains,desc"] }) },
    {
      section: "newLost",
      path: "/v3/backlinks/timeseries_new_lost_summary/live",
      task: { ...common(target), date_from: dateFrom, date_to: dateTo, group_range: "week" },
    },
  ];
}

function applySection(data: BacklinkSnapshotData, section: BacklinkSection, result: unknown[]) {
  if (section === "summary") data.summary = parseSummary(result);
  else if (section === "referringDomains") {
    const r = parseReferringDomains(result);
    data.referringDomains = r.items;
    data.referringDomainsTotal = r.total;
  } else if (section === "backlinks") {
    const r = parseBacklinks(result);
    data.backlinks = r.items;
    data.backlinksTotal = r.total;
  } else if (section === "anchors") {
    const r = parseAnchors(result);
    data.anchors = r.items;
    data.anchorsTotal = r.total;
  } else data.newLost = parseNewLost(result);
}

const inFlight = new Set<string>();

/**
 * Make the paid calls and store a snapshot. The summary call goes first: if DataForSEO refuses (no subscription) or
 * fails, nothing else is spent. The other 4 run in parallel; a failed one is stored as a section error.
 * Throws raw errors (DfsError / HttpError); callers map them.
 */
export async function takeBacklinkSnapshot(o: {
  organizationId: string;
  projectId: string;
  target: string;
  trigger: "manual" | "schedule";
  now?: Date;
}) {
  const now = o.now ?? new Date();
  const monitor = await db.backlinkMonitor.upsert({
    where: { projectId: o.projectId },
    create: { organizationId: o.organizationId, projectId: o.projectId, target: o.target, lastAttemptAt: now },
    update: { target: o.target, lastAttemptAt: now },
  });
  if (monitor.organizationId !== o.organizationId) throw new HttpError(404, "not_found", "Project not found");
  const opts = { feature: "backlinks" as const, organizationId: o.organizationId, projectId: o.projectId, estimateMicros: BACKLINKS_CALL_ESTIMATE_MICROS, units: 1 };
  const [first, ...rest] = refreshCalls(o.target, now);
  const data: BacklinkSnapshotData = { ...EMPTY_SNAPSHOT_DATA, sectionErrors: [] };
  try {
    applySection(data, first.section, (await dfsPost(first.path, [first.task], opts)).result);
    const settled = await Promise.allSettled(rest.map((c) => dfsPost(c.path, [c.task], { ...opts, units: 0 })));
    settled.forEach((s, i) => {
      if (s.status === "fulfilled") applySection(data, rest[i].section, s.value.result);
      else {
        data.sectionErrors.push(rest[i].section);
        log.warn("backlinks.section_failed", { projectId: o.projectId, section: rest[i].section, error: (s.reason as Error)?.message });
      }
    });
  } catch (e) {
    const message = isBacklinksAccessError(e) ? BACKLINKS_NOT_ENABLED : "We couldn't get backlink data. We'll try again later.";
    await db.backlinkMonitor.update({ where: { id: monitor.id }, data: { lastError: message } }).catch(() => undefined);
    throw e;
  }
  const snapshot = await db.backlinkSnapshot.create({
    data: {
      organizationId: o.organizationId,
      projectId: o.projectId,
      target: o.target,
      trigger: o.trigger,
      backlinks: data.summary?.backlinks ?? null,
      referringDomains: data.summary?.referringDomains ?? null,
      rank: data.summary?.rank ?? null,
      data: data as unknown as Prisma.InputJsonValue,
      createdAt: now,
    },
  });
  await db.backlinkMonitor.update({ where: { id: monitor.id }, data: { lastRefreshAt: now, lastError: null } });
  await pruneSnapshots(o.organizationId, o.projectId);
  log.info("backlinks.snapshot.ok", { projectId: o.projectId, trigger: o.trigger, sectionErrors: data.sectionErrors.length });
  return snapshot;
}

async function pruneSnapshots(organizationId: string, projectId: string) {
  const old = await db.backlinkSnapshot.findMany({
    where: { organizationId, projectId },
    orderBy: { createdAt: "desc" },
    skip: SNAPSHOTS_KEPT,
    select: { id: true },
  });
  if (old.length) await db.backlinkSnapshot.deleteMany({ where: { organizationId, id: { in: old.map((r) => r.id) } } });
}

/** "Refresh" button (member+): availability, once per day per project, per-org hourly limit, allowance. */
export async function refreshBacklinksNow(o: { organizationId: string; projectId: string; websiteUrl: string; now?: Date }) {
  const now = o.now ?? new Date();
  assertAvailable();
  const target = projectTarget(o.websiteUrl);
  if (!target) throw new HttpError(400, "bad_domain", "This project's website address isn't a domain we can check.");
  const monitor = await db.backlinkMonitor.findFirst({ where: { organizationId: o.organizationId, projectId: o.projectId } });
  if (monitor?.lastRefreshAt && now.getTime() - monitor.lastRefreshAt.getTime() < MANUAL_REFRESH_MIN_HOURS * HOUR) {
    throw new HttpError(429, "refresh_limit", "We refreshed your backlinks in the last 24 hours. Backlink data changes slowly — try again tomorrow.");
  }
  if (inFlight.has(o.projectId)) throw new HttpError(409, "in_progress", "A refresh is already running. Give it a minute.");
  const planId = await planOf(o.organizationId);
  const allowance = await allowanceStatus(o.organizationId, planId, "backlinks", now);
  if (allowance.remaining < BACKLINK_UNITS_PER_REFRESH) throw allowanceError(allowance);
  const rl = checkRateLimit(`backlinks:refresh:${o.organizationId}`, BACKLINK_REFRESHES_PER_HOUR, HOUR, now.getTime());
  if (!rl.allowed) throw new HttpError(429, "rate_limited", "Too many refreshes in the last hour. Please try again a bit later.");
  inFlight.add(o.projectId);
  try {
    await takeBacklinkSnapshot({ organizationId: o.organizationId, projectId: o.projectId, target, trigger: "manual", now });
  } catch (e) {
    throw providerError(e);
  } finally {
    inFlight.delete(o.projectId);
  }
}

// ---- scheduled refresh -------------------------------------------------------------------------------------------------

/** Pure due rule: refreshed before (the monitor exists), plan has automatic refresh, interval passed; failures back off. */
export function isRefreshDue(o: { lastRefreshAt: Date | null; lastAttemptAt: Date | null; lastError: string | null; refreshDays: number | null; now: Date }): boolean {
  if (o.refreshDays === null) return false;
  if (o.lastError && o.lastAttemptAt && o.now.getTime() - o.lastAttemptAt.getTime() < FAILURE_BACKOFF_MS) return false;
  if (!o.lastRefreshAt) return true;
  return o.now.getTime() - o.lastRefreshAt.getTime() >= o.refreshDays * DAY - DUE_SLACK_MS;
}

export function scheduleKey(projectId: string, now: Date): string {
  return `backlinks:${projectId}:${now.toISOString().slice(0, 10)}`;
}

/**
 * Scheduler step: enqueue a "backlinks_refresh" job for each monitored project that is due on its plan. Only projects
 * whose owner has refreshed at least once are monitored (no surprise spending). Never throws.
 */
export async function enqueueDueBacklinkRefreshes(now = new Date()): Promise<{ enqueued: number }> {
  const out = { enqueued: 0 };
  if (!backlinksAvailability().enabled) return out;
  try {
    const { enqueue } = await import("@/lib/jobs/queue");
    const rows = await db.backlinkMonitor.findMany({
      where: { OR: [{ lastRefreshAt: null }, { lastRefreshAt: { lt: new Date(now.getTime() - 7 * DAY + DUE_SLACK_MS) } }] },
      orderBy: [{ lastRefreshAt: { sort: "asc", nulls: "first" } }],
      take: 200,
    });
    const orgs = new Map<string, { planId: string; active: boolean; remaining: number }>();
    for (const m of rows) {
      if (out.enqueued >= MAX_ENQUEUE_PER_TICK) break;
      if (!orgs.has(m.organizationId)) {
        const planId = await planOf(m.organizationId);
        const active = await getOrgAccess(m.organizationId, now).then((a) => a.active).catch(() => false);
        const remaining = active ? (await allowanceStatus(m.organizationId, planId, "backlinks", now)).remaining : 0;
        orgs.set(m.organizationId, { planId, active, remaining });
      }
      const org = orgs.get(m.organizationId)!;
      if (!org.active || org.remaining < BACKLINK_UNITS_PER_REFRESH) continue;
      if (!isRefreshDue({ ...m, refreshDays: refreshDaysFor(org.planId), now })) continue;
      await enqueue({
        kind: "backlinks_refresh",
        organizationId: m.organizationId,
        projectId: m.projectId,
        input: { projectId: m.projectId },
        idempotencyKey: scheduleKey(m.projectId, now),
        maxAttempts: 2,
      });
      org.remaining -= BACKLINK_UNITS_PER_REFRESH;
      out.enqueued++;
    }
  } catch (e) {
    log.error("backlinks.schedule_failed", { err: e });
  }
  return out;
}

/** Job body for a scheduled refresh: re-checks availability, plan and allowance (they may have changed). */
export async function runScheduledRefresh(organizationId: string, projectId: string, now = new Date()): Promise<Record<string, unknown>> {
  if (!backlinksAvailability().enabled) return { skipped: "not_enabled" };
  const project = await db.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true, websiteUrl: true } });
  if (!project) return { skipped: "no_project" };
  const target = projectTarget(project.websiteUrl);
  if (!target) return { skipped: "bad_domain" };
  const planId = await planOf(organizationId);
  if (refreshDaysFor(planId) === null) return { skipped: "plan" };
  const allowance = await allowanceStatus(organizationId, planId, "backlinks", now);
  if (allowance.remaining < BACKLINK_UNITS_PER_REFRESH) return { skipped: "allowance" };
  try {
    const s = await takeBacklinkSnapshot({ organizationId, projectId, target, trigger: "schedule", now });
    return { snapshotId: s.id };
  } catch (e) {
    if (isBacklinksAccessError(e)) return { skipped: "no_subscription" };
    throw e;
  }
}

// ---- link gap ----------------------------------------------------------------------------------------------------------

/** Clean the competitor list for a link-gap lookup: valid domains, not the project's own, unique, 1–3. */
export function cleanCompetitors(input: string[], target: string): { domains: string[]; rejected: string[] } {
  const domains: string[] = [];
  const rejected: string[] = [];
  for (const raw of input) {
    const d = normaliseDomain(String(raw ?? ""));
    if (!d || d === target || d.endsWith(`.${target}`)) rejected.push(String(raw ?? "").slice(0, 100));
    else if (!domains.includes(d)) domains.push(d);
  }
  return { domains: domains.slice(0, LINK_GAP_MAX_COMPETITORS), rejected };
}

/** Pure: the domain_intersection task (exported for tests). */
export function linkGapTask(target: string, competitors: string[]) {
  const targets: Record<string, string> = {};
  competitors.forEach((d, i) => (targets[String(i + 1)] = d));
  return {
    targets,
    task: {
      targets,
      exclude_targets: [target],
      include_subdomains: true,
      intersection_mode: competitors.length > 1 ? "partial" : "all",
      exclude_internal_backlinks: true,
      rank_scale: "one_hundred",
      limit: LIST_LIMIT,
      order_by: ["1.rank,desc"],
    },
  };
}

export async function runLinkGap(o: { organizationId: string; projectId: string; websiteUrl: string; competitors: string[]; userId: string; now?: Date }) {
  const now = o.now ?? new Date();
  assertAvailable();
  const target = projectTarget(o.websiteUrl);
  if (!target) throw new HttpError(400, "bad_domain", "This project's website address isn't a domain we can check.");
  const { domains, rejected } = cleanCompetitors(o.competitors, target);
  if (!domains.length) {
    throw new HttpError(400, "no_competitors", rejected.length ? `These don't look like competitor websites: ${rejected.join(", ")}` : "Pick at least one competitor website.");
  }
  const planId = await planOf(o.organizationId);
  const allowance = await allowanceStatus(o.organizationId, planId, "link_gap", now);
  if (allowance.remaining < 1) throw allowanceError(allowance);
  const rl = checkRateLimit(`backlinks:link-gap:${o.organizationId}`, LINK_GAP_LOOKUPS_PER_HOUR, HOUR, now.getTime());
  if (!rl.allowed) throw new HttpError(429, "rate_limited", "Too many lookups in the last hour. Please try again a bit later.");
  const { targets, task } = linkGapTask(target, domains);
  let items: LinkGapItem[];
  let total: number | null;
  try {
    const r = await dfsPost("/v3/backlinks/domain_intersection/live", [task], {
      feature: "link_gap", organizationId: o.organizationId, projectId: o.projectId, estimateMicros: LINK_GAP_ESTIMATE_MICROS, units: 1,
    });
    ({ items, total } = parseDomainIntersection(r.result, targets));
  } catch (e) {
    throw providerError(e);
  }
  const report = await db.linkGapReport.create({
    data: {
      organizationId: o.organizationId, projectId: o.projectId, target, competitors: domains, items: items as unknown as Prisma.InputJsonValue,
      totalCount: total, createdById: o.userId, createdAt: now,
    },
  });
  const old = await db.linkGapReport.findMany({
    where: { organizationId: o.organizationId, projectId: o.projectId },
    orderBy: { createdAt: "desc" },
    skip: LINK_GAP_REPORTS_KEPT,
    select: { id: true },
  });
  if (old.length) await db.linkGapReport.deleteMany({ where: { organizationId: o.organizationId, id: { in: old.map((r) => r.id) } } });
  return { reportId: report.id };
}

// ---- page view ---------------------------------------------------------------------------------------------------------

export interface AllowanceView {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}

export interface LinkGapReportView {
  id: string;
  createdAt: string;
  target: string;
  competitors: string[];
  items: LinkGapItem[];
  totalCount: number | null;
}

export interface BacklinksView {
  availability: BacklinksAvailability;
  target: string | null;
  monitor: {
    lastRefreshAt: string | null;
    lastError: string | null;
    canRefreshAt: string | null;
    nextAutoRefreshAt: string | null;
    refreshDays: number | null;
  };
  latest: { takenAt: string; trigger: string; data: BacklinkSnapshotData } | null;
  changes: DomainChanges | null;
  history: { takenAt: string; backlinks: number | null; referringDomains: number | null; rank: number | null }[];
  allowance: AllowanceView & { unitsPerRefresh: number; refreshesLeft: number };
  linkGap: { allowance: AllowanceView; savedCompetitors: string[]; reports: LinkGapReportView[] };
}

const allowanceView = (s: AllowanceStatus): AllowanceView => ({ used: s.used, limit: s.limit, remaining: s.remaining, resetsAt: s.resetsAt });

export async function getBacklinksView(organizationId: string, projectId: string, websiteUrl: string, competitors: unknown, now = new Date()): Promise<BacklinksView> {
  const target = projectTarget(websiteUrl);
  const planId = await planOf(organizationId);
  const refreshDays = refreshDaysFor(planId);
  const [monitor, recent, history, reports, backlinksAllowance, gapAllowance] = await Promise.all([
    db.backlinkMonitor.findFirst({ where: { organizationId, projectId } }),
    db.backlinkSnapshot.findMany({
      where: { organizationId, projectId },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: { createdAt: true, trigger: true, data: true },
    }),
    db.backlinkSnapshot.findMany({
      where: { organizationId, projectId },
      orderBy: { createdAt: "desc" },
      take: SNAPSHOTS_KEPT,
      select: { createdAt: true, backlinks: true, referringDomains: true, rank: true },
    }),
    db.linkGapReport.findMany({ where: { organizationId, projectId }, orderBy: { createdAt: "desc" }, take: 5 }),
    allowanceStatus(organizationId, planId, "backlinks", now),
    allowanceStatus(organizationId, planId, "link_gap", now),
  ]);
  const [latestRow, previousRow] = recent;
  const latestData = latestRow ? readSnapshotData(latestRow.data) : null;
  const previousData = previousRow ? readSnapshotData(previousRow.data) : null;
  const last = monitor?.lastRefreshAt ?? null;
  return {
    availability: backlinksAvailability(),
    target,
    monitor: {
      lastRefreshAt: last?.toISOString() ?? null,
      lastError: monitor?.lastError ?? null,
      canRefreshAt: last ? new Date(last.getTime() + MANUAL_REFRESH_MIN_HOURS * HOUR).toISOString() : null,
      nextAutoRefreshAt: last && refreshDays !== null ? new Date(last.getTime() + refreshDays * DAY).toISOString() : null,
      refreshDays,
    },
    latest: latestRow && latestData ? { takenAt: latestRow.createdAt.toISOString(), trigger: latestRow.trigger, data: latestData } : null,
    changes:
      latestData && !latestData.sectionErrors.includes("referringDomains")
        ? diffReferringDomains(
            latestData.referringDomains,
            previousRow && previousData && !previousData.sectionErrors.includes("referringDomains")
              ? { list: previousData.referringDomains, takenAt: previousRow.createdAt.toISOString() }
              : null,
            latestRow!.createdAt,
          )
        : null,
    history: history
      .map((h) => ({ takenAt: h.createdAt.toISOString(), backlinks: h.backlinks, referringDomains: h.referringDomains, rank: h.rank }))
      .reverse(),
    allowance: {
      ...allowanceView(backlinksAllowance),
      unitsPerRefresh: BACKLINK_UNITS_PER_REFRESH,
      refreshesLeft: refreshesLeft(backlinksAllowance.remaining),
    },
    linkGap: {
      allowance: allowanceView(gapAllowance),
      savedCompetitors: savedCompetitorDomains(competitors, target),
      reports: reports.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        target: r.target,
        competitors: Array.isArray(r.competitors) ? r.competitors.filter((c): c is string => typeof c === "string") : [],
        items: Array.isArray(r.items) ? (r.items as unknown as LinkGapItem[]) : [],
        totalCount: r.totalCount,
      })),
    },
  };
}
