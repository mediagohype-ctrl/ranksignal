// Measurement history (round 4 contract). writeSnapshot never throws; reads are tenant-scoped.
import { Prisma, type ReportSnapshot } from "@prisma/client";
import { db } from "@/lib/db";
import { buildSiteReport } from "@/lib/report/build";
import { METHODOLOGY_VERSION } from "@/lib/report/score";
import { FORMULA_VERSION } from "@/lib/visibility/metrics";
import { computeDelta, likeForLikeFromObservations } from "./delta";
import {
  SNAPSHOT_PILLARS, SNAPSHOT_SEVERITIES,
  type LikeForLike, type SnapshotDelta, type SnapshotIssueCounts, type SnapshotKind, type SnapshotPillarScores,
  type SnapshotView, type SnapshotVisibility,
} from "./types";

export * from "./types";
export { computeDelta, likeForLikeFromObservations, metricDelta } from "./delta";

/** Report scoring method + visibility index formula; a change shows as a dashed marker in history. */
export const SNAPSHOT_METHODOLOGY_VERSION = `${METHODOLOGY_VERSION}+${FORMULA_VERSION}`;
const VIS_DONE = ["succeeded", "succeeded_with_warnings"];
const BACKFILL_MAX_CRAWLS = 12;
const BACKFILL_MAX_VIS = 60;

// ---------------------------------------------------------------------------------------------
// Parsing

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

function parsePillars(v: unknown): SnapshotPillarScores {
  const o = obj(v) ?? {};
  return Object.fromEntries(SNAPSHOT_PILLARS.map((p) => [p, num(o[p])])) as SnapshotPillarScores;
}

function parseIssues(v: unknown): SnapshotIssueCounts | null {
  const o = obj(v);
  if (!o) return null;
  const counts = Object.fromEntries(SNAPSHOT_SEVERITIES.map((s) => [s, num(o[s]) ?? 0])) as SnapshotIssueCounts;
  counts.total = num(o.total) ?? SNAPSHOT_SEVERITIES.reduce((a, s) => a + counts[s], 0);
  return counts;
}

/** Accepts a SnapshotVisibility or a full VisibilityMetrics object. */
export function parseVisibility(v: unknown, providers?: string[]): SnapshotVisibility | null {
  const o = obj(v);
  if (!o || num(o.mentionRate) === null || num(o.visibilityIndex) === null) return null;
  const share = obj(o.competitorShare) ?? {};
  return {
    mentionRate: num(o.mentionRate) ?? 0,
    citationRate: num(o.citationRate) ?? 0,
    recommendationRate: num(o.recommendationRate) ?? 0,
    visibilityIndex: num(o.visibilityIndex) ?? 0,
    competitorShare: Object.fromEntries(Object.entries(share).filter(([, n]) => typeof n === "number")) as Record<string, number>,
    sampleSize: num(o.sampleSize) ?? 0,
    collected: num(o.collected) ?? num(o.sampleSize) ?? 0,
    providers: Array.isArray(o.providers)
      ? o.providers.filter((x): x is string => typeof x === "string")
      : (providers ?? Object.keys(obj(o.byProvider) ?? {})),
    formulaVersion: typeof o.formulaVersion === "string" ? o.formulaVersion : FORMULA_VERSION,
  };
}

export function toSnapshotView(r: ReportSnapshot): SnapshotView {
  return {
    id: r.id,
    projectId: r.projectId,
    kind: r.kind === "visibility" ? "visibility" : "crawl",
    crawlRunId: r.crawlRunId,
    visibilityRunId: r.visibilityRunId,
    createdAt: r.createdAt,
    overallScore: r.overallScore,
    grade: r.grade,
    pillarScores: parsePillars(r.pillarScores),
    openIssues: parseIssues(r.openIssues),
    visibility: parseVisibility(r.visibility),
    promptSetVersion: r.promptSetVersion,
    methodologyVersion: r.methodologyVersion,
    simulated: r.simulated,
  };
}

const json = (v: unknown) => (v === null || v === undefined ? Prisma.JsonNull : (v as Prisma.InputJsonValue));

// ---------------------------------------------------------------------------------------------
// Writing

interface CrawlScores {
  crawlRunId: string;
  overallScore: number | null;
  grade: string | null;
  pillarScores: SnapshotPillarScores;
  openIssues: SnapshotIssueCounts;
}

/** Open findings by severity as they stood at `at` (detected by then, not yet resolved). */
async function issuesAsOf(organizationId: string, projectId: string, at: Date): Promise<SnapshotIssueCounts> {
  const groups = await db.auditFinding.groupBy({
    by: ["severity"],
    where: {
      organizationId,
      projectId,
      status: { in: ["open", "resolved"] },
      detectedAt: { lte: at },
      OR: [{ resolvedAt: null }, { resolvedAt: { gt: at } }],
    },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(SNAPSHOT_SEVERITIES.map((s) => [s, 0])) as SnapshotIssueCounts;
  for (const g of groups) if ((SNAPSHOT_SEVERITIES as readonly string[]).includes(g.severity)) counts[g.severity as keyof SnapshotIssueCounts] = g._count._all;
  counts.total = SNAPSHOT_SEVERITIES.reduce((a, s) => a + counts[s], 0);
  return counts;
}

async function crawlScores(organizationId: string, projectId: string, crawlRunId: string, at: Date): Promise<CrawlScores> {
  const report = await buildSiteReport(projectId, organizationId, crawlRunId);
  const pillarScores = Object.fromEntries(SNAPSHOT_PILLARS.map((p) => [p, null])) as SnapshotPillarScores;
  for (const p of report.pillars) pillarScores[p.pillar] = p.score;
  return {
    crawlRunId,
    overallScore: report.overall.score,
    grade: report.overall.grade,
    pillarScores,
    openIssues: await issuesAsOf(organizationId, projectId, at),
  };
}

/** Latest real (non-simulated) visibility run finished at/before `at`. */
async function visibilityAsOf(organizationId: string, projectId: string, at: Date) {
  const runs = await db.visibilityRun.findMany({
    where: { organizationId, projectId, status: { in: VIS_DONE }, finishedAt: { lte: at } },
    orderBy: { finishedAt: "desc" },
    take: 10,
  });
  for (const r of runs) {
    const m = obj(r.metrics);
    if (!m || m.simulated === true) continue;
    const vis = parseVisibility(m, Array.isArray(r.providers) ? (r.providers as string[]) : undefined);
    if (vis) return { runId: r.id, vis, promptSetVersion: r.promptSetVersion };
  }
  return null;
}

async function writeCrawlSnapshot(organizationId: string, projectId: string, crawlRunId: string) {
  const run = await db.crawlRun.findFirst({ where: { id: crawlRunId, organizationId, projectId, status: "succeeded" } });
  if (!run) return;
  const at = run.finishedAt ?? run.createdAt;
  const [scores, vis] = await Promise.all([crawlScores(organizationId, projectId, run.id, at), visibilityAsOf(organizationId, projectId, at)]);
  await db.reportSnapshot.create({
    data: {
      organizationId,
      projectId,
      kind: "crawl",
      crawlRunId: run.id,
      visibilityRunId: vis?.runId ?? null,
      overallScore: scores.overallScore,
      grade: scores.grade,
      pillarScores: json(scores.pillarScores),
      openIssues: json(scores.openIssues),
      visibility: json(vis?.vis ?? null),
      promptSetVersion: vis?.promptSetVersion ?? null,
      methodologyVersion: SNAPSHOT_METHODOLOGY_VERSION,
      simulated: false, // scores never use simulated answers; simulated visibility is not copied in
      createdAt: at,
    },
  });
}

async function writeVisibilitySnapshot(organizationId: string, projectId: string, visibilityRunId: string) {
  const run = await db.visibilityRun.findFirst({ where: { id: visibilityRunId, organizationId, projectId, status: { in: VIS_DONE } } });
  if (!run) return;
  const at = run.finishedAt ?? run.createdAt;
  const m = obj(run.metrics);
  const vis = parseVisibility(m, Array.isArray(run.providers) ? (run.providers as string[]) : undefined);
  if (!vis) return;

  // Copy the latest crawl scores (as of this run) so every snapshot is complete.
  let crawl: CrawlScores | null = null;
  const prevCrawlSnap = await db.reportSnapshot.findFirst({
    where: { organizationId, projectId, kind: "crawl", createdAt: { lte: at } },
    orderBy: { createdAt: "desc" },
  });
  if (prevCrawlSnap?.crawlRunId) {
    crawl = {
      crawlRunId: prevCrawlSnap.crawlRunId,
      overallScore: prevCrawlSnap.overallScore,
      grade: prevCrawlSnap.grade,
      pillarScores: parsePillars(prevCrawlSnap.pillarScores),
      openIssues: parseIssues(prevCrawlSnap.openIssues) ?? (await issuesAsOf(organizationId, projectId, at)),
    };
  } else {
    const lastCrawl = await db.crawlRun.findFirst({
      where: { organizationId, projectId, status: "succeeded", finishedAt: { lte: at } },
      orderBy: { finishedAt: "desc" },
    });
    if (lastCrawl) crawl = await crawlScores(organizationId, projectId, lastCrawl.id, at);
  }

  await db.reportSnapshot.create({
    data: {
      organizationId,
      projectId,
      kind: "visibility",
      crawlRunId: crawl?.crawlRunId ?? null,
      visibilityRunId: run.id,
      overallScore: crawl?.overallScore ?? null,
      grade: crawl?.grade ?? null,
      pillarScores: json(crawl?.pillarScores ?? null),
      openIssues: json(crawl?.openIssues ?? null),
      visibility: json(vis),
      promptSetVersion: run.promptSetVersion,
      methodologyVersion: SNAPSHOT_METHODOLOGY_VERSION,
      simulated: m?.simulated === true,
      createdAt: at,
    },
  });
}

/** Freeze scores after a successful run. Idempotent per source run. Never throws (logs instead). */
export async function writeSnapshot(o: {
  organizationId: string;
  projectId: string;
  kind: SnapshotKind;
  crawlRunId?: string;
  visibilityRunId?: string;
}): Promise<void> {
  try {
    const runId = o.kind === "crawl" ? o.crawlRunId : o.visibilityRunId;
    if (!runId) return;
    const existing = await db.reportSnapshot.findFirst({
      where: { organizationId: o.organizationId, projectId: o.projectId, kind: o.kind, ...(o.kind === "crawl" ? { crawlRunId: runId } : { visibilityRunId: runId }) },
      select: { id: true },
    });
    if (existing) return;
    if (o.kind === "crawl") await writeCrawlSnapshot(o.organizationId, o.projectId, runId);
    else await writeVisibilitySnapshot(o.organizationId, o.projectId, runId);
  } catch (err) {
    console.error("[snapshots] writeSnapshot failed", o.kind, err instanceof Error ? err.message : err);
  }
}

// ---------------------------------------------------------------------------------------------
// Reading

export async function listSnapshots(
  projectId: string,
  organizationId: string,
  o: { from?: Date; to?: Date; kind?: SnapshotKind; includeSimulated?: boolean } = {},
): Promise<SnapshotView[]> {
  const rows = await db.reportSnapshot.findMany({
    where: {
      organizationId,
      projectId,
      ...(o.kind ? { kind: o.kind } : {}),
      ...(o.includeSimulated ? {} : { simulated: false }),
      ...(o.from || o.to ? { createdAt: { ...(o.from ? { gte: o.from } : {}), ...(o.to ? { lte: o.to } : {}) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 1000,
  });
  return rows.map(toSnapshotView);
}

/** Latest non-simulated snapshot at/before `at`. `kind` omitted = either kind (both carry full scores). */
export async function getSnapshotAt(projectId: string, organizationId: string, at: Date, kind?: SnapshotKind): Promise<SnapshotView | null> {
  const row = await db.reportSnapshot.findFirst({
    where: { organizationId, projectId, simulated: false, createdAt: { lte: at }, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return row ? toSnapshotView(row) : null;
}

/** Compare mention/citation/recommendation rates using only prompts present in both runs. */
export async function computeLikeForLike(
  projectId: string,
  organizationId: string,
  fromVisibilityRunId: string,
  toVisibilityRunId: string,
): Promise<LikeForLike | null> {
  const runs = await db.visibilityRun.findMany({
    where: { organizationId, projectId, id: { in: [fromVisibilityRunId, toVisibilityRunId] } },
    select: { id: true },
  });
  if (runs.length !== (fromVisibilityRunId === toVisibilityRunId ? 1 : 2)) return null;
  const select = { visibilityRunId: true, promptId: true, brandMentioned: true, brandCited: true, brandRecommended: true } as const;
  const obs = await db.observation.findMany({
    where: { organizationId, visibilityRunId: { in: [fromVisibilityRunId, toVisibilityRunId] } },
    select,
    take: 20_000,
  });
  return likeForLikeFromObservations(
    fromVisibilityRunId,
    toVisibilityRunId,
    obs.filter((x) => x.visibilityRunId === fromVisibilityRunId),
    obs.filter((x) => x.visibilityRunId === toVisibilityRunId),
  );
}

/** Findings resolved / first detected in (from, to]. */
export async function countIssueChanges(projectId: string, organizationId: string, from: Date, to: Date) {
  const [fixed, created] = await Promise.all([
    db.auditFinding.count({ where: { organizationId, projectId, status: "resolved", resolvedAt: { gt: from, lte: to } } }),
    db.auditFinding.count({ where: { organizationId, projectId, detectedAt: { gt: from, lte: to } } }),
  ]);
  return { fixed, new: created };
}

/** computeDelta plus the DB-backed parts: like-for-like rates (when both run ids are known) and issues fixed/new. */
export async function compareSnapshots(
  projectId: string,
  organizationId: string,
  before: SnapshotView | null,
  after: SnapshotView | null,
): Promise<SnapshotDelta> {
  if (!before || !after) return computeDelta(before, after);
  const [lfl, issues] = await Promise.all([
    before.visibilityRunId && after.visibilityRunId && before.visibilityRunId !== after.visibilityRunId
      ? computeLikeForLike(projectId, organizationId, before.visibilityRunId, after.visibilityRunId).catch(() => null)
      : Promise.resolve(null),
    after.createdAt > before.createdAt
      ? countIssueChanges(projectId, organizationId, before.createdAt, after.createdAt).catch(() => null)
      : Promise.resolve({ fixed: 0, new: 0 }),
  ]);
  return computeDelta(before, after, { likeForLike: lfl, fixed: issues?.fixed ?? null, new: issues?.new ?? null });
}

/** "Since last month": latest snapshot vs the latest one at/before `days` ago (falls back to the first snapshot). */
export async function getPeriodComparison(projectId: string, organizationId: string, o: { days?: number; now?: Date } = {}) {
  const now = o.now ?? new Date();
  const after = await getSnapshotAt(projectId, organizationId, now);
  if (!after) return { before: null, after: null, delta: computeDelta(null, null), baselineIsFirst: false };
  const cutoff = new Date(now.getTime() - (o.days ?? 30) * 86_400_000);
  let before = await getSnapshotAt(projectId, organizationId, cutoff);
  let baselineIsFirst = false;
  if (!before) {
    const first = await db.reportSnapshot.findFirst({ where: { organizationId, projectId, simulated: false }, orderBy: { createdAt: "asc" } });
    if (first && first.id !== after.id) {
      before = toSnapshotView(first);
      baselineIsFirst = true;
    }
  }
  return { before, after, delta: await compareSnapshots(projectId, organizationId, before, after), baselineIsFirst };
}

// ---------------------------------------------------------------------------------------------
// Backfill

const backfillInFlight = new Map<string, Promise<{ crawl: number; visibility: number }>>();
const backfillAttemptedAt = new Map<string, number>();
const BACKFILL_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Create snapshots for past succeeded runs that have none (crawl runs, most recent BACKFILL_MAX_CRAWLS; then
 * visibility runs so their copied crawl scores line up). Scores use the current methodology. Safe to repeat.
 */
export function backfillSnapshots(
  projectId: string,
  organizationId: string,
  o: { force?: boolean } = {},
): Promise<{ crawl: number; visibility: number }> {
  const key = `${organizationId}:${projectId}`;
  const running = backfillInFlight.get(key);
  if (running) return running;
  // Lazy (page-load) callers: at most one attempt per project per cooldown, so a run that can't be scored
  // isn't rebuilt on every view. The admin endpoint passes force.
  const last = backfillAttemptedAt.get(key);
  if (!o.force && last && Date.now() - last < BACKFILL_COOLDOWN_MS) return Promise.resolve({ crawl: 0, visibility: 0 });
  backfillAttemptedAt.set(key, Date.now());
  const p = runBackfill(projectId, organizationId).finally(() => backfillInFlight.delete(key));
  backfillInFlight.set(key, p);
  return p;
}

async function runBackfill(projectId: string, organizationId: string) {
  const [crawls, visRuns, existing] = await Promise.all([
    db.crawlRun.findMany({
      where: { organizationId, projectId, status: "succeeded" },
      orderBy: { createdAt: "desc" },
      take: BACKFILL_MAX_CRAWLS,
      select: { id: true },
    }),
    db.visibilityRun.findMany({
      where: { organizationId, projectId, status: { in: VIS_DONE } },
      orderBy: { createdAt: "desc" },
      take: BACKFILL_MAX_VIS,
      select: { id: true },
    }),
    db.reportSnapshot.findMany({ where: { organizationId, projectId }, select: { kind: true, crawlRunId: true, visibilityRunId: true } }),
  ]);
  const haveCrawl = new Set(existing.filter((s) => s.kind === "crawl").map((s) => s.crawlRunId));
  const haveVis = new Set(existing.filter((s) => s.kind === "visibility").map((s) => s.visibilityRunId));
  let crawl = 0;
  let visibility = 0;
  // Oldest first so each visibility snapshot can copy the crawl snapshot that preceded it.
  for (const c of [...crawls].reverse()) {
    if (haveCrawl.has(c.id)) continue;
    await writeSnapshot({ organizationId, projectId, kind: "crawl", crawlRunId: c.id });
    crawl++;
  }
  for (const v of [...visRuns].reverse()) {
    if (haveVis.has(v.id)) continue;
    await writeSnapshot({ organizationId, projectId, kind: "visibility", visibilityRunId: v.id });
    visibility++;
  }
  return { crawl, visibility };
}
