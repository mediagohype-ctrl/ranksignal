// Workflow handler for kind "crawl": reserve credits → crawl → audit → reconcile findings → enqueue analyze.
// Site-level facts (robots.txt AI-bot rules, llms.txt, sitemap, HTTPS) are returned as `site` and thus
// persisted in WorkflowRun.output (linked via CrawlRun.workflowRunId) — read via getCrawlSiteContext() in
// src/lib/report/site-data.ts.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enqueue, type JobHandler } from "@/lib/jobs/queue";
import { JobError, type FindingInput } from "@/lib/types";
import { getPlan } from "@/lib/billing/plans";
import { recordUsage, releaseReservation, reserveCredits } from "@/lib/billing/usage";
import { clampMaxPages, crawlSite } from "@/lib/crawler/crawl";
import { SafeFetchError } from "@/lib/crawler/safe-fetch";
import { urlKey } from "@/lib/crawler/normalize";
import { runAudit } from "@/lib/audit/rules";
import { writeSnapshot } from "@/lib/snapshots";

const MAX_ATTEMPTS = 3; // matches enqueue() in the crawl-runs route

function classify(err: unknown): JobError {
  if (err instanceof JobError) return err;
  if (err instanceof SafeFetchError) return new JobError(err.message, err.permanent ? "permanent" : "transient");
  return new JobError(err instanceof Error ? err.message : String(err), "transient");
}

const findingKey = (code: string, pageUrl: string | null | undefined) => `${code}|${pageUrl ? (urlKey(pageUrl) ?? pageUrl) : ""}`;

/** Upsert new findings, keep user "ignored" decisions, resolve open findings no longer detected. */
export async function reconcileFindings(
  organizationId: string,
  projectId: string,
  findings: FindingInput[],
  pageIdByUrl: Map<string, string>,
) {
  const now = new Date();
  const existing = await db.auditFinding.findMany({
    where: { organizationId, projectId, status: { in: ["open", "ignored"] } },
    select: { id: true, code: true, pageUrl: true, status: true },
  });
  const byKey = new Map(existing.map((f) => [findingKey(f.code, f.pageUrl), f]));
  const seen = new Set<string>();
  const ops: Prisma.PrismaPromise<unknown>[] = [];
  const creates: Prisma.AuditFindingCreateManyInput[] = [];

  for (const f of findings) {
    const key = findingKey(f.code, f.pageUrl);
    if (seen.has(key)) continue;
    seen.add(key);
    const crawlPageId = f.pageUrl ? (pageIdByUrl.get(urlKey(f.pageUrl) ?? f.pageUrl) ?? null) : null;
    const data = {
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      message: f.message,
      evidence: f.evidence as Prisma.InputJsonValue,
      crawlPageId,
    };
    const prev = byKey.get(key);
    if (prev) ops.push(db.auditFinding.update({ where: { id: prev.id }, data })); // status (open/ignored) preserved
    else creates.push({ ...data, organizationId, projectId, code: f.code, pageUrl: f.pageUrl ?? null, status: "open", detectedAt: now });
  }
  const stale = existing.filter((f) => f.status === "open" && !seen.has(findingKey(f.code, f.pageUrl))).map((f) => f.id);
  if (stale.length) ops.push(db.auditFinding.updateMany({ where: { id: { in: stale } }, data: { status: "resolved", resolvedAt: now } }));
  if (creates.length) ops.push(db.auditFinding.createMany({ data: creates }));
  await db.$transaction(ops);
  return { created: creates.length, updated: seen.size - creates.length, resolved: stale.length };
}

export const crawlJob: JobHandler = async (ctx) => {
  const crawlRunId = typeof ctx.run.input.crawlRunId === "string" ? ctx.run.input.crawlRunId : null;
  if (!crawlRunId) throw new JobError("crawlRunId missing from job input", "permanent");
  const organizationId = ctx.run.organizationId;

  const run = await db.crawlRun.findFirst({ where: { id: crawlRunId, organizationId }, include: { project: true } });
  if (!run) throw new JobError("Crawl run not found", "permanent");
  if (run.status === "succeeded") return { crawlRunId, skipped: "already_succeeded" };
  const project = run.project;

  await ctx.transition("running", "crawl.started", { crawlRunId });
  // A retried attempt starts clean.
  await db.crawlPage.deleteMany({ where: { crawlRunId, organizationId } });
  await db.crawlRun.update({
    where: { id: crawlRunId },
    data: { status: "running", startedAt: new Date(), error: null, pagesCrawled: 0, pagesFound: 0, workflowRunId: ctx.run.id },
  });

  const settings = (project.settings as Record<string, unknown> | null) ?? {};
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } });
  let planCap = 500;
  try {
    planCap = getPlan(org?.planId ?? "trial").maxPagesPerCrawl;
  } catch {
    /* unknown plan → default cap */
  }
  const maxPages = clampMaxPages(settings.maxPagesPerCrawl, planCap);
  const usageKey = { provider: "crawler", taskType: "crawl_page" };

  try {
    await reserveCredits(organizationId, { ...usageKey, credits: maxPages, runId: crawlRunId, projectId: project.id });
  } catch (err) {
    const e = err instanceof JobError ? err : new JobError(err instanceof Error ? err.message : "Credit reservation failed", "quota");
    await db.crawlRun.update({ where: { id: crawlRunId }, data: { status: "failed", error: e.message.slice(0, 500), finishedAt: new Date() } });
    throw e;
  }

  let pagesCrawled = 0;
  try {
    const brandNames = ((project.brandNames as unknown[] | null) ?? []).filter((b): b is string => typeof b === "string");
    const result = await crawlSite({ crawlRunId, organizationId, projectId: project.id, websiteUrl: project.websiteUrl, maxPages, brandNames });
    pagesCrawled = result.pages.length;

    const findings = runAudit(result.pages, result.site);
    const pageIdByUrl = new Map<string, string>();
    for (const p of result.pages) {
      for (const u of [p.url, p.finalUrl]) {
        const k = urlKey(u) ?? u;
        if (!pageIdByUrl.has(k)) pageIdByUrl.set(k, p.id);
      }
    }
    const summary = await reconcileFindings(organizationId, project.id, findings, pageIdByUrl);

    await db.crawlRun.update({
      where: { id: crawlRunId },
      data: { status: "succeeded", finishedAt: new Date(), pagesCrawled, error: null },
    });
    await ctx.event("crawl.completed", { crawlRunId, pagesCrawled, findings: findings.length, ...summary });
    // Measurement history; writeSnapshot never throws, the extra catch guards against import-time surprises.
    await writeSnapshot({ organizationId, projectId: project.id, kind: "crawl", crawlRunId }).catch(() => undefined);

    await enqueue({
      kind: "analyze",
      organizationId,
      projectId: project.id,
      input: { trigger: "crawl", crawlRunId },
      idempotencyKey: `analyze:crawl:${crawlRunId}`,
    });
    return { crawlRunId, pagesCrawled, findings: findings.length, ...summary, site: result.site as unknown as Prisma.InputJsonValue };
  } catch (err) {
    const e = classify(err);
    const willRetry = e.errorClass === "transient" && ctx.run.attempts < MAX_ATTEMPTS;
    await db.crawlRun.update({
      where: { id: crawlRunId },
      data: { status: willRetry ? "retry_scheduled" : "failed", error: e.message.slice(0, 500), finishedAt: willRetry ? null : new Date() },
    });
    throw e;
  } finally {
    // Settle the reservation: bill actual pages, release the remainder. Never mask the main error.
    try {
      if (pagesCrawled === 0) {
        pagesCrawled = await db.crawlPage.count({ where: { crawlRunId, organizationId } });
      }
      if (pagesCrawled > 0) {
        await recordUsage(organizationId, { ...usageKey, credits: pagesCrawled, costMicros: 0, runId: crawlRunId, projectId: project.id });
      }
      // billing/usage computes reserved = reservations - releases and does NOT net "actual" rows
      // against reservations, so the whole hold is released once actual usage is recorded.
      await releaseReservation(organizationId, { ...usageKey, credits: maxPages, runId: crawlRunId });
    } catch (e) {
      console.error("[crawl] usage settlement failed", e instanceof Error ? e.message : e);
    }
  }
};

