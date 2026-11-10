// "indexnow" workflow: send every queued submission for one project as one deduped batch to api.indexnow.org
// (shared with Bing, Yandex, Seznam, Naver …). Retries 429/5xx/network errors through the queue's backoff; on the
// last attempt the submissions are marked failed instead of alerting staff.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { JobHandler } from "@/lib/jobs/queue";
import { safeRequest } from "@/lib/net/safe-request";
import { JobError } from "@/lib/types";
import {
  buildPayload, chunk, classifyResponse, filterUrlsForHost, INDEXNOW_ENDPOINT, keyFileUrl, MAX_SUBMISSION_ATTEMPTS, planBatch, RESUBMIT_AFTER_MS, siteOf,
} from "./core";
import { scheduleIndexNowRun } from "./service";

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function postIndexNow(body: unknown, fetcher: typeof safeRequest): Promise<number | null> {
  try {
    const res = await fetcher(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
      timeoutMs: 20_000,
      maxBytes: 64 * 1024,
      allowedHosts: ["api.indexnow.org"],
    });
    return res.status;
  } catch {
    return null; // network/timeout → retry
  }
}

export function createIndexNowJob(fetcher: typeof safeRequest = safeRequest): JobHandler {
  return async (ctx) => {
    const orgId = ctx.run.organizationId;
    const projectId = ctx.run.projectId ?? (typeof ctx.run.input.projectId === "string" ? ctx.run.input.projectId : null);
    if (!projectId) throw new JobError("invalid_input", "permanent");
    const now = new Date();
    const startedAt = now;

    const [project, site, queued] = await Promise.all([
      db.project.findFirst({ where: { id: projectId, organizationId: orgId }, select: { websiteUrl: true } }),
      db.indexNowSite.findFirst({ where: { organizationId: orgId, projectId } }),
      db.indexNowSubmission.findMany({ where: { organizationId: orgId, projectId, status: "queued" }, orderBy: { createdAt: "asc" }, take: 200 }),
    ]);
    if (queued.length === 0) return { sent: 0 };
    const ids = queued.map((q) => q.id);

    const origin = project ? siteOf(project.websiteUrl)?.origin : null;
    if (!project || !site || !origin || !site.enabled || site.status !== "verified") {
      await db.indexNowSubmission.updateMany({
        where: { id: { in: ids } },
        data: { status: "skipped", message: "IndexNow isn't switched on for this site (the key file hasn't been verified)." },
      });
      return { sent: 0, skipped: queued.length };
    }

    // Merge + dedupe the queued batches; drop URLs accepted in the last 24 h; respect the per-host daily cap.
    const merged = filterUrlsForHost(queued.flatMap((q) => strings(q.urls)), site.host);
    const [recentRows, today] = await Promise.all([
      db.indexNowSubmission.findMany({
        where: { organizationId: orgId, projectId, status: "sent", sentAt: { gte: new Date(now.getTime() - RESUBMIT_AFTER_MS) } },
        select: { urls: true },
        take: 500,
      }),
      db.indexNowSubmission.aggregate({ where: { host: site.host, status: "sent", sentAt: { gte: utcDayStart(now) } }, _sum: { urlCount: true } }),
    ]);
    const recentlySent = new Set(recentRows.flatMap((r) => strings(r.urls)));
    const plan = planBatch({ urls: merged, recentlySent, sentToday: today._sum.urlCount ?? 0 });
    const [primary, ...rest] = queued;

    if (plan.send.length === 0) {
      const message = plan.overCap.length
        ? "Today's IndexNow limit for this site (10,000 URLs) is used up. Changed pages will be sent after the next check."
        : "All of these pages were already sent in the last 24 hours.";
      await db.indexNowSubmission.updateMany({ where: { id: { in: ids } }, data: { status: "skipped", message } });
      return { sent: 0 };
    }

    const attempts = primary.attempts + 1;
    await db.indexNowSubmission.updateMany({ where: { id: { in: ids } }, data: { attempts } });

    let lastStatus: number | null = null;
    for (const urls of chunk(plan.send)) {
      lastStatus = await postIndexNow(buildPayload({ host: site.host, key: site.key, keyLocation: keyFileUrl(origin, site.key), urls }), fetcher);
      const kind = lastStatus === null ? "retry" : classifyResponse(lastStatus).kind;
      if (kind !== "accepted") break;
    }
    const outcome = lastStatus === null ? { kind: "retry" as const, message: "Couldn't reach IndexNow. We'll retry automatically." } : classifyResponse(lastStatus);

    if (outcome.kind === "retry") {
      if (attempts < MAX_SUBMISSION_ATTEMPTS) {
        await db.indexNowSubmission.updateMany({ where: { id: { in: ids } }, data: { httpStatus: lastStatus, message: outcome.message } });
        throw new JobError(`indexnow_retry: ${lastStatus ?? "network"}`, "transient");
      }
      await db.indexNowSubmission.updateMany({
        where: { id: { in: ids } },
        data: { status: "failed", httpStatus: lastStatus, message: `Gave up after ${attempts} tries. ${outcome.message.replace(/ We'll retry automatically\.$/, "")}` },
      });
      return { sent: 0, failed: queued.length };
    }

    if (outcome.kind !== "accepted") {
      await db.indexNowSubmission.updateMany({ where: { id: { in: ids } }, data: { status: "failed", httpStatus: lastStatus, message: outcome.message } });
      if (outcome.kind === "key_invalid") {
        await db.indexNowSite.update({ where: { id: site.id }, data: { status: "failed", enabled: false, lastCheckError: outcome.message, lastCheckAt: now } });
      }
      return { sent: 0, status: lastStatus };
    }

    const notes = [
      outcome.message,
      plan.skippedRecent.length ? `${plan.skippedRecent.length} already sent in the last 24 hours.` : "",
      plan.overCap.length ? `${plan.overCap.length} over today's 10,000-URL limit (not sent).` : "",
    ].filter(Boolean).join(" ");
    // The oldest submission carries the URLs actually sent (and counts toward the daily cap); the rest point to it.
    await db.$transaction([
      db.indexNowSubmission.update({
        where: { id: primary.id },
        data: { status: "sent", sentAt: new Date(), httpStatus: lastStatus, urls: plan.send as Prisma.InputJsonValue, urlCount: plan.send.length, message: notes },
      }),
      db.indexNowSubmission.updateMany({
        where: { id: { in: rest.map((r) => r.id) } },
        data: { status: "merged", httpStatus: lastStatus, sentAt: new Date(), message: "Sent together with the batch above." },
      }),
    ]);
    await ctx.event("indexnow.sent", { urls: plan.send.length, status: lastStatus });

    // Anything queued while this run was working gets its own run.
    const late = await db.indexNowSubmission.count({ where: { organizationId: orgId, projectId, status: "queued", createdAt: { gte: startedAt } } });
    if (late > 0) await scheduleIndexNowRun(orgId, projectId).catch(() => undefined);
    return { sent: plan.send.length, status: lastStatus };
  };
}

export const indexNowJob: JobHandler = createIndexNowJob();
