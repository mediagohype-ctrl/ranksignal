// Workflow handler for kind "audit_depth" — runs after a crawl succeeds (enqueued by the crawl job):
//  1. probes (once): image file sizes (≤30), internal link targets the crawl didn't fetch (≤30, redirect check),
//     canonical targets (≤20), and noindex pages listed in the sitemap;
//  2. Google PageSpeed Insights: homepage (mobile + desktop) and up to N key pages on mobile (N per plan, ./plan.ts),
//     one at a time with polite spacing and per-page retries for rate limits / Google-side errors;
//  3. refreshes the stored report for the crawl.
// Long passes stop after a time budget and continue in a follow-up run (pending PSI rows are kept in the DB).
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { enqueue, type JobHandler } from "@/lib/jobs/queue";
import { JobError } from "@/lib/types";
import type { AuditPage } from "@/lib/audit/rules";
import { getCrawlFacts } from "@/lib/report/site-data";
import { fetchRobots } from "@/lib/crawler/robots";
import { discoverSitemapUrls } from "@/lib/crawler/sitemap";
import { siteHost } from "@/lib/crawler/normalize";
import { psiConfigured, runPsi } from "@/lib/pagespeed/psi";
import { probeImage, probePage } from "@/lib/pagespeed/probe";
import {
  noindexInSitemap, psiKeyPagesFor, selectCanonicalProbes, selectImageProbes, selectLinkProbes, selectPsiTargets, type ProbeTarget,
} from "@/lib/pagespeed/plan";
import { refreshStoredReport } from "@/lib/pagespeed/refresh";
import type { ExtractedPage } from "@/lib/types";
import type { ProbeResult } from "@/lib/pagespeed/types";

export const AUDIT_DEPTH_KIND = "audit_depth" as const;
/** Work per run before handing over to a continuation run (queue max run time is 30 min). */
const TIME_BUDGET_MS = 20 * 60_000;
const MAX_PARTS = 4;
const PSI_ATTEMPTS = 3;
const PSI_BACKOFF_MS = [5_000, 20_000];
const PROBE_CONCURRENCY = 3;
const PROBE_SPACING_MS = 200;
const MAX_PAGES = 1000;

/** Polite spacing between PSI calls: the keyless quota is small and shared. */
export function psiSpacingMs(): number {
  return psiConfigured() ? 1_500 : 5_000;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

/**
 * Create the pass's row (status "queued", so reports built meanwhile say "speed test running") and enqueue the job.
 * Idempotent per crawl. Never throws — a failed enqueue must not fail the crawl.
 */
export async function enqueueAuditDepth(o: { organizationId: string; projectId: string; crawlRunId: string }): Promise<void> {
  try {
    await db.auditDepthRun.upsert({
      where: { crawlRunId: o.crawlRunId },
      create: { organizationId: o.organizationId, projectId: o.projectId, crawlRunId: o.crawlRunId, status: "queued" },
      update: {},
    });
    await enqueue({
      kind: AUDIT_DEPTH_KIND,
      organizationId: o.organizationId,
      projectId: o.projectId,
      input: { crawlRunId: o.crawlRunId, part: 0 },
      idempotencyKey: `audit_depth:${o.crawlRunId}:0`,
      maxAttempts: 3,
    });
  } catch (err) {
    console.error("[audit_depth] enqueue failed", err instanceof Error ? err.message : err);
  }
}

async function runPool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>, signal?: AbortSignal): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  const worker = async () => {
    while (i < items.length && !signal?.aborted) {
      const item = items[i++];
      out.push(await fn(item));
      await sleep(PROBE_SPACING_MS, signal);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

async function runProbes(pages: AuditPage[], homepageUrl: string, sitemapsFound: string[], signal?: AbortSignal) {
  const origin = new URL(homepageUrl).origin;
  const host = siteHost(new URL(homepageUrl).hostname);
  const robots = await fetchRobots(origin);
  const allowed = (t: ProbeTarget) => {
    try {
      return new URL(t.url).origin !== origin || robots.isAllowed(t.url);
    } catch {
      return false;
    }
  };
  const images = selectImageProbes(pages).filter(allowed);
  const links = selectLinkProbes(pages).filter(allowed);
  const canonicals = selectCanonicalProbes(pages, host).filter(allowed);
  const probes: ProbeResult[] = [
    ...(await runPool(images, PROBE_CONCURRENCY, probeImage, signal)),
    ...(await runPool(links, PROBE_CONCURRENCY, (t) => probePage(t, "link"), signal)),
    ...(await runPool(canonicals, PROBE_CONCURRENCY, (t) => probePage(t, "canonical"), signal)),
  ];

  // Sitemap vs noindex: only worth fetching the sitemap when some crawled page is noindex.
  let sitemapNoindex: string[] | null = null;
  const anyNoindex = pages.some((p) => /\bnoindex\b|\bnone\b/i.test(p.extracted?.robotsMeta ?? ""));
  if (!anyNoindex) sitemapNoindex = [];
  else if (sitemapsFound.length) {
    const sm = await discoverSitemapUrls(origin, sitemapsFound, [host], { maxUrls: 5000 });
    sitemapNoindex = sm.sitemapsFound.length ? noindexInSitemap(pages, sm.urls) : null;
  }
  return { probes, sitemapNoindex };
}

export const auditDepthJob: JobHandler = async (ctx) => {
  const started = Date.now();
  const crawlRunId = typeof ctx.run.input.crawlRunId === "string" ? ctx.run.input.crawlRunId : null;
  const part = typeof ctx.run.input.part === "number" ? ctx.run.input.part : 0;
  if (!crawlRunId) throw new JobError("crawlRunId missing from job input", "permanent");
  const organizationId = ctx.run.organizationId;

  const crawl = await db.crawlRun.findFirst({
    where: { id: crawlRunId, organizationId, status: "succeeded" },
    select: { id: true, projectId: true, workflowRunId: true, project: { select: { websiteUrl: true } } },
  });
  if (!crawl) throw new JobError("Crawl run not found or not finished", "permanent");
  const projectId = crawl.projectId;

  const depth = await db.auditDepthRun.upsert({
    where: { crawlRunId },
    create: { organizationId, projectId, crawlRunId, status: "running", startedAt: new Date() },
    update: {},
  });
  if (depth.organizationId !== organizationId) throw new JobError("Audit depth run belongs to another organization", "permanent");
  if (["succeeded", "partial", "failed"].includes(depth.status)) return { crawlRunId, skipped: "already_done" };

  await ctx.transition("running", "audit_depth.started", { crawlRunId, part });
  await db.auditDepthRun.update({ where: { id: depth.id }, data: { status: "running", startedAt: depth.startedAt ?? new Date(), error: null } });

  try {
    const rows = await db.crawlPage.findMany({
      where: { organizationId, crawlRunId },
      select: { url: true, finalUrl: true, statusCode: true, redirectChain: true, contentType: true, extracted: true, error: true },
      orderBy: { crawledAt: "asc" },
      take: MAX_PAGES,
    });
    const pages: AuditPage[] = rows.map((r) => ({
      url: r.url,
      finalUrl: r.finalUrl ?? r.url,
      statusCode: r.statusCode,
      redirectChain: strArr(r.redirectChain),
      contentType: r.contentType,
      extracted: (r.extracted as ExtractedPage | null) ?? null,
      error: r.error,
    }));
    const facts = await getCrawlFacts(organizationId, crawl);
    const homepageUrl = facts.site?.homepageUrl ?? pages[0]?.finalUrl ?? crawl.project.websiteUrl;

    // 1. Probes (first run only).
    if (depth.probes === null) {
      const { probes, sitemapNoindex } = await runProbes(pages, homepageUrl, facts.site?.sitemapsFound ?? [], ctx.signal);
      await db.auditDepthRun.update({
        where: { id: depth.id },
        data: {
          probes: probes as unknown as Prisma.InputJsonValue,
          sitemapNoindex: sitemapNoindex === null ? Prisma.JsonNull : (sitemapNoindex as Prisma.InputJsonValue),
        },
      });
      await ctx.event("audit_depth.probed", { crawlRunId, probes: probes.length });
    }

    // 2. PageSpeed Insights rows (planned once).
    let planned = await db.pageSpeedResult.count({ where: { organizationId, crawlRunId } });
    if (planned === 0) {
      const org = await db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } });
      const targets = selectPsiTargets(pages, homepageUrl, psiKeyPagesFor(org?.planId));
      const data: Prisma.PageSpeedResultCreateManyInput[] = [];
      for (const t of targets) {
        data.push({ organizationId, projectId, crawlRunId, url: t.url, strategy: "mobile", isHome: t.isHome });
        if (t.isHome) data.push({ organizationId, projectId, crawlRunId, url: t.url, strategy: "desktop", isHome: true });
      }
      if (data.length) await db.pageSpeedResult.createMany({ data, skipDuplicates: true });
      planned = data.length;
      await db.auditDepthRun.update({ where: { id: depth.id }, data: { psiPlanned: planned } });
    }

    const pending = await db.pageSpeedResult.findMany({
      where: { organizationId, crawlRunId, status: "pending" },
      orderBy: [{ isHome: "desc" }, { strategy: "desc" }, { createdAt: "asc" }], // home mobile, home desktop, then key pages
    });
    let outOfTime = false;
    for (const row of pending) {
      if (ctx.signal?.aborted || Date.now() - started > TIME_BUDGET_MS) {
        outOfTime = true;
        break;
      }
      let outcome = await runPsi(row.url, row.strategy === "desktop" ? "desktop" : "mobile");
      let attempts = 1;
      while (!outcome.ok && outcome.transient && attempts < PSI_ATTEMPTS && !ctx.signal?.aborted) {
        await sleep(PSI_BACKOFF_MS[attempts - 1] ?? 20_000, ctx.signal);
        outcome = await runPsi(row.url, row.strategy === "desktop" ? "desktop" : "mobile");
        attempts++;
      }
      await db.pageSpeedResult.update({
        where: { id: row.id },
        data: outcome.ok
          ? { ...outcome.metrics, status: "ok", error: null, attempts: row.attempts + attempts, fetchedAt: new Date() }
          : { status: "failed", error: outcome.error.slice(0, 500), attempts: row.attempts + attempts, fetchedAt: new Date() },
      });
      await sleep(psiSpacingMs(), ctx.signal);
    }

    const counts = await db.pageSpeedResult.groupBy({ by: ["status"], where: { organizationId, crawlRunId }, _count: { _all: true } });
    const c = (s: string) => counts.find((x) => x.status === s)?._count._all ?? 0;
    await db.auditDepthRun.update({ where: { id: depth.id }, data: { psiDone: c("ok") + c("failed") } });

    if (c("pending") > 0 && (outOfTime || ctx.signal?.aborted)) {
      if (part + 1 < MAX_PARTS) {
        await enqueue({
          kind: AUDIT_DEPTH_KIND,
          organizationId,
          projectId,
          input: { crawlRunId, part: part + 1 },
          idempotencyKey: `audit_depth:${crawlRunId}:${part + 1}`,
          runAfter: new Date(Date.now() + 60_000),
          maxAttempts: 3,
        });
        return { crawlRunId, part, continued: true, pending: c("pending") };
      }
      await db.pageSpeedResult.updateMany({ where: { organizationId, crawlRunId, status: "pending" }, data: { status: "failed", error: "Not tested: time limit reached" } });
    }

    const ok = c("ok");
    const failed = c("failed") + (c("pending") > 0 ? c("pending") : 0);
    const status = planned > 0 && ok === 0 ? "failed" : failed > 0 ? "partial" : "succeeded";
    await db.auditDepthRun.update({ where: { id: depth.id }, data: { status, finishedAt: new Date() } });
    await ctx.event("audit_depth.completed", { crawlRunId, status, psiOk: ok, psiFailed: failed });
    const refreshed = await refreshStoredReport(organizationId, projectId, crawlRunId);
    return { crawlRunId, status, psiOk: ok, psiFailed: failed, reportRefreshed: refreshed };
  } catch (err) {
    const e = err instanceof JobError ? err : new JobError(err instanceof Error ? err.message : String(err), "transient");
    const final = e.errorClass !== "transient" || ctx.run.attempts >= 3;
    await db.auditDepthRun
      .update({ where: { id: depth.id }, data: final ? { status: "failed", error: e.message.slice(0, 500), finishedAt: new Date() } : { error: e.message.slice(0, 500) } })
      .catch(() => undefined);
    throw e;
  }
};
