// "rank_tracker" workflow: check a project's tracked keywords on Google (DataForSEO SERP live/advanced, depth 100),
// a few at a time with a short pause between batches. Respects the plan's monthly allowance: when it runs out the
// tracker is marked "paused: allowance used up" instead of failing. Keywords left over go to a follow-up run.
// The scheduler entry (scheduleDueRankChecks) enqueues runs for projects with keywords due on the plan's schedule.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { JobError } from "@/lib/types";
import { isAiBudgetExhausted } from "@/lib/billing/ai-budget";
import { getOrgAccess } from "@/lib/billing/access";
import { DfsError, dfsConfigured, dfsPost } from "@/lib/dataforseo/client";
import { allowanceMessage, allowanceStatus, type AllowanceStatus } from "@/lib/dataforseo/usage";
import { normaliseDomain } from "@/lib/dataforseo/locations";
import { enqueue, type JobHandler } from "@/lib/jobs/queue";
import {
  CHECK_BATCH_PAUSE_MS, CHECK_BATCH_SIZE, MAX_CHECKS_PER_RUN, SERP_ADVANCED_ESTIMATE_MICROS, SERP_ENDPOINT, maxTrackedKeywordsFor, rankFrequencyFor,
} from "./limits";
import { buildSerpTask, dueCutoff, isKeywordDue } from "./logic";
import { parseSerpResult } from "./parse";

const MINUTE = 60_000;
/** Stop a run (and let the queue retry later) after this many transient failures in a row. */
const MAX_TRANSIENT_IN_A_ROW = 3;
/** Scheduler: projects enqueued per tick, and the gap before re-enqueuing a project that just had a run. */
const MAX_PROJECTS_PER_TICK = 50;
const RECENT_RUN_GAP_MS = 15 * MINUTE;
const ACTIVE_STATES = ["queued", "running", "retry_scheduled"];

type Keyword = {
  id: string;
  keyword: string;
  locationId: string;
  device: string;
  language: string;
  lastCheckedAt: Date | null;
  bestPosition: number | null;
};

export function pausedMessage(s: AllowanceStatus): string {
  return `Paused: allowance used up. ${allowanceMessage(s)}`;
}

async function setState(organizationId: string, projectId: string, data: { status?: string; message?: string | null; lastRunAt?: Date }) {
  await db.rankTrackerState.upsert({
    where: { projectId },
    create: { organizationId, projectId, status: data.status ?? "active", message: data.message ?? null, lastRunAt: data.lastRunAt },
    update: data,
  });
}

export interface RankJobDeps {
  post: typeof dfsPost;
  sleep: (ms: number) => Promise<void>;
}
const defaultDeps: RankJobDeps = { post: dfsPost, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

export function createRankTrackerJob(deps: RankJobDeps = defaultDeps): JobHandler {
  return async (ctx) => {
    const organizationId = ctx.run.organizationId;
    const input = ctx.run.input;
    const projectId = ctx.run.projectId ?? (typeof input.projectId === "string" ? input.projectId : null);
    if (!projectId) throw new JobError("invalid_input", "permanent");
    const trigger = input.trigger === "manual" ? "manual" : "schedule";
    const since = typeof input.since === "string" && !Number.isNaN(Date.parse(input.since)) ? new Date(input.since) : null;
    if (!dfsConfigured()) return { checked: 0, skipped: "not_configured" };

    const [project, org] = await Promise.all([
      db.project.findFirst({ where: { id: projectId, organizationId }, select: { websiteUrl: true } }),
      db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } }),
    ]);
    const domain = project ? normaliseDomain(project.websiteUrl) : null;
    if (!project || !domain) return { checked: 0, skipped: "no_project" };
    const planId = org?.planId ?? "trial";
    const frequency = rankFrequencyFor(planId);
    const now = new Date();

    // Only the first `limit` keywords (oldest first) are checked, so a downgrade can't run past the plan.
    const all: Keyword[] = await db.trackedKeyword.findMany({
      where: { organizationId, projectId, active: true },
      orderBy: { createdAt: "asc" },
      take: maxTrackedKeywordsFor(planId),
      select: { id: true, keyword: true, locationId: true, device: true, language: true, lastCheckedAt: true, bestPosition: true },
    });
    const due = all.filter((k) =>
      trigger === "manual" && since ? !k.lastCheckedAt || k.lastCheckedAt < since : isKeywordDue({ lastCheckedAt: k.lastCheckedAt, frequency, now }),
    );
    const work = due.slice(0, MAX_CHECKS_PER_RUN);
    if (work.length === 0) {
      await setState(organizationId, projectId, { lastRunAt: now });
      return { checked: 0 };
    }

    const allowance = await allowanceStatus(organizationId, planId, "rank_tracker", now);
    let remaining = allowance.remaining;
    let checked = 0;
    let failed = 0;
    let transientInARow = 0;
    let stop: null | "allowance" | "budget" | "aborted" | "transient" = null;

    async function checkOne(k: Keyword): Promise<"ok" | "failed" | "transient" | "budget"> {
      try {
        const { result } = await deps.post(SERP_ENDPOINT, [buildSerpTask(k)], {
          feature: "rank_tracker",
          organizationId,
          projectId,
          estimateMicros: SERP_ADVANCED_ESTIMATE_MICROS,
          units: 1,
        });
        const parsed = parseSerpResult(result, domain!);
        const at = new Date();
        const best = parsed.position === null ? k.bestPosition : Math.min(parsed.position, k.bestPosition ?? Number.POSITIVE_INFINITY);
        await db.$transaction([
          db.rankCheck.create({
            data: {
              organizationId,
              trackedKeywordId: k.id,
              checkedAt: at,
              position: parsed.position,
              url: parsed.url?.slice(0, 2000) ?? null,
              serpFeatures: parsed.features as Prisma.InputJsonValue,
              competitors: parsed.competitors as unknown as Prisma.InputJsonValue,
              trigger,
            },
          }),
          db.trackedKeyword.update({
            where: { id: k.id },
            data: {
              lastCheckedAt: at,
              lastPosition: parsed.position,
              bestPosition: best,
              lastUrl: parsed.url?.slice(0, 2000) ?? null,
              lastFeatures: parsed.features as Prisma.InputJsonValue,
              lastCompetitors: parsed.competitors as unknown as Prisma.InputJsonValue,
              lastError: null,
            },
          }),
        ]);
        return "ok";
      } catch (e) {
        if (isAiBudgetExhausted(e)) return "budget";
        const transient = e instanceof DfsError ? e.errorClass === "transient" : !(e instanceof JobError) || e.errorClass === "transient";
        log.warn("rank_tracker.check_failed", { projectId, keywordId: k.id, transient, error: (e as Error)?.message });
        if (transient) return "transient";
        // Permanent (e.g. a location Google rejects): note it and wait for the next scheduled check instead of retrying.
        await db.trackedKeyword
          .update({ where: { id: k.id }, data: { lastCheckedAt: new Date(), lastError: "Google couldn't be checked for this keyword. We'll try again next time." } })
          .catch(() => undefined);
        return "failed";
      }
    }

    for (let i = 0; i < work.length; ) {
      if (ctx.signal?.aborted) {
        stop = "aborted";
        break;
      }
      if (remaining <= 0) {
        stop = "allowance";
        break;
      }
      const batch = work.slice(i, i + Math.min(CHECK_BATCH_SIZE, remaining));
      i += batch.length;
      const results = await Promise.all(batch.map(checkOne));
      for (const r of results) {
        if (r === "ok") {
          checked++;
          remaining--;
          transientInARow = 0;
        } else if (r === "transient") {
          transientInARow++;
        } else if (r === "failed") {
          failed++;
        }
      }
      if (results.includes("budget")) {
        stop = "budget";
        break;
      }
      if (transientInARow >= MAX_TRANSIENT_IN_A_ROW) {
        stop = "transient";
        break;
      }
      if (i < work.length) await deps.sleep(CHECK_BATCH_PAUSE_MS);
    }

    const finishedAt = new Date();
    if (stop === "allowance") {
      const latest = await allowanceStatus(organizationId, planId, "rank_tracker", finishedAt);
      await setState(organizationId, projectId, { status: "paused_allowance", message: pausedMessage(latest), lastRunAt: finishedAt });
      await ctx.event("rank_tracker.paused", { reason: "allowance", checked });
      return { checked, failed, paused: "allowance" };
    }
    await setState(organizationId, projectId, { status: "active", message: null, lastRunAt: finishedAt });
    if (stop === "transient") throw new JobError("rank_tracker_transient: DataForSEO unavailable", "transient");
    if (stop === "budget" || stop === "aborted") return { checked, failed, stopped: stop };

    // More due keywords than one run handles → a follow-up run shortly.
    if (due.length > work.length) {
      await enqueue({
        kind: "rank_tracker",
        organizationId,
        projectId,
        input: { projectId, trigger, ...(since ? { since: since.toISOString() } : {}) },
        idempotencyKey: `rank:next:${ctx.run.id}`,
        runAfter: new Date(Date.now() + MINUTE),
      });
    }
    await ctx.event("rank_tracker.checked", { checked, failed, remainingDue: due.length - work.length });
    return { checked, failed, remainingDue: due.length - work.length };
  };
}

export const rankTrackerJob: JobHandler = createRankTrackerJob();

// ---- scheduler entry ------------------------------------------------------------------------------------------------

/** Enqueue rank checks for projects with keywords due on their plan's schedule. Called from the scheduler tick. */
export async function scheduleDueRankChecks(now = new Date()): Promise<number> {
  if (!dfsConfigured()) return 0;
  // Daily is the most frequent schedule, so anything due on any plan is older than the daily cutoff.
  const dailyCutoff = dueCutoff("daily", now);
  const candidates = await db.trackedKeyword.groupBy({
    by: ["organizationId", "projectId"],
    where: { active: true, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: dailyCutoff } }] },
    _count: { _all: true },
  });
  if (candidates.length === 0) return 0;

  const orgs = new Map<string, { planId: string; active: boolean; allowance: AllowanceStatus | null }>();
  let enqueued = 0;
  for (const c of candidates) {
    if (enqueued >= MAX_PROJECTS_PER_TICK) break;
    try {
      if (!orgs.has(c.organizationId)) {
        const org = await db.organization.findUnique({ where: { id: c.organizationId }, select: { planId: true } });
        const active = await getOrgAccess(c.organizationId, now).then((a) => a.active).catch(() => false);
        orgs.set(c.organizationId, { planId: org?.planId ?? "trial", active, allowance: null });
      }
      const org = orgs.get(c.organizationId)!;
      if (!org.active) continue;
      const frequency = rankFrequencyFor(org.planId);
      if (frequency !== "daily") {
        const dueCount = await db.trackedKeyword.count({
          where: { organizationId: c.organizationId, projectId: c.projectId, active: true, OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: dueCutoff(frequency, now) } }] },
        });
        if (dueCount === 0) continue;
      }
      const busy = await db.workflowRun.findFirst({
        where: {
          organizationId: c.organizationId,
          projectId: c.projectId,
          kind: "rank_tracker",
          OR: [{ state: { in: ACTIVE_STATES } }, { createdAt: { gte: new Date(now.getTime() - RECENT_RUN_GAP_MS) } }],
        },
        select: { id: true },
      });
      if (busy) continue;
      org.allowance ??= await allowanceStatus(c.organizationId, org.planId, "rank_tracker", now);
      if (org.allowance.remaining <= 0) {
        await setState(c.organizationId, c.projectId, { status: "paused_allowance", message: pausedMessage(org.allowance) });
        continue;
      }
      await enqueue({
        kind: "rank_tracker",
        organizationId: c.organizationId,
        projectId: c.projectId,
        input: { projectId: c.projectId, trigger: "schedule" },
        idempotencyKey: `rank:sched:${c.projectId}:${now.toISOString().slice(0, 16)}`,
      });
      enqueued++;
    } catch (e) {
      log.error("rank_tracker.schedule_failed", { projectId: c.projectId, err: e });
    }
  }
  return enqueued;
}
