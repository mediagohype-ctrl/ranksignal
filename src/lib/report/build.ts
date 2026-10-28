// Report engine entry point: loads tenant-scoped data and composes a SiteReport (contract: ./types.ts).
// Data sources: latest succeeded CrawlRun (+ CrawlPages, site facts from WorkflowRun.output), open
// AuditFindings, latest succeeded VisibilityRun (+ Observations). Nothing is invented: checks without
// data are "not_measured" and excluded from scores.
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { recordUsage } from "@/lib/billing/usage";
import type { Citation, ExtractedPage } from "@/lib/types";
import type { SiteReport } from "@/lib/report/types";
import type { CheckContext, ReportFinding, ReportPage } from "@/lib/report/inputs";
import { composeReport } from "@/lib/report/compose";
import { getCrawlSiteContext } from "@/lib/report/site-data";
import { emptyVisibility, summarizeVisibility, type VisObservation } from "@/lib/report/visibility";
import { llmSummary } from "@/lib/report/summary";

const MAX_PAGES = 1000;
const MAX_OBSERVATIONS = 3000;
const SUMMARY_CACHE_MAX = 200;
/** LLM summaries are cached per (crawl run, visibility run, report shape) to avoid paying on every view. */
const summaryCache = new Map<string, string>();

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []);

/**
 * @param crawlRunId optional: build the report for this (older) succeeded crawl instead of the latest one —
 *   findings as they were open when that crawl finished, the latest AI check finished by then, and the template
 *   summary only (no paid LLM call). Used for measurement-history snapshots. Default behaviour is unchanged.
 */
export async function buildSiteReport(projectId: string, organizationId: string, crawlRunId?: string): Promise<SiteReport> {
  const project = await db.project.findFirst({ where: { id: projectId, organizationId } });
  if (!project) throw new HttpError(404, "not_found", "Project not found");

  const brandNames = strArr(project.brandNames);
  const brand = brandNames[0] ?? project.name;
  const competitors = (Array.isArray(project.competitors) ? (project.competitors as unknown[]) : [])
    .filter((c): c is { name: string; domain?: string } => !!c && typeof c === "object" && typeof (c as { name?: unknown }).name === "string");

  const asOf = crawlRunId
    ? await db.crawlRun.findFirst({ where: { id: crawlRunId, organizationId, projectId, status: "succeeded" } })
    : null;
  if (crawlRunId && !asOf) throw new HttpError(404, "not_found", "Crawl run not found");
  const cutoff = asOf ? (asOf.finishedAt ?? asOf.createdAt) : null;

  const [crawlRun, visRun, findingsRows] = await Promise.all([
    asOf ?? db.crawlRun.findFirst({ where: { organizationId, projectId, status: "succeeded" }, orderBy: { createdAt: "desc" } }),
    db.visibilityRun.findFirst({
      where: {
        organizationId,
        projectId,
        status: { in: ["succeeded", "succeeded_with_warnings"] },
        ...(cutoff ? { finishedAt: { lte: cutoff } } : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
    db.auditFinding.findMany({
      where: cutoff
        ? {
            organizationId,
            projectId,
            status: { in: ["open", "resolved"] },
            detectedAt: { lte: cutoff },
            OR: [{ resolvedAt: null }, { resolvedAt: { gt: cutoff } }],
          }
        : { organizationId, projectId, status: "open" },
      select: { code: true, severity: true, category: true, pageUrl: true, message: true, evidence: true },
      take: 5000,
    }),
  ]);

  const [pageRows, site, obsRows] = await Promise.all([
    crawlRun
      ? db.crawlPage.findMany({ where: { organizationId, crawlRunId: crawlRun.id }, orderBy: { crawledAt: "asc" }, take: MAX_PAGES })
      : Promise.resolve([]),
    crawlRun ? getCrawlSiteContext(organizationId, crawlRun) : Promise.resolve(null),
    visRun
      ? db.observation.findMany({
          where: { organizationId, visibilityRunId: visRun.id },
          include: { prompt: { select: { text: true } } },
          take: MAX_OBSERVATIONS,
        })
      : Promise.resolve([]),
  ]);

  const pages: ReportPage[] = pageRows.map((r) => ({
    url: r.url,
    finalUrl: r.finalUrl ?? r.url,
    statusCode: r.statusCode,
    redirectChain: strArr(r.redirectChain),
    contentType: r.contentType,
    responseBytes: r.responseBytes,
    extracted: (r.extracted as ExtractedPage | null) ?? null,
    error: r.error,
  }));
  const findings: ReportFinding[] = findingsRows.map((f) => ({ ...f, evidence: f.evidence ?? undefined }));

  const observations: VisObservation[] = obsRows.map((o) => ({
    provider: o.provider,
    platformLabel: o.platformLabel,
    promptText: o.prompt?.text ?? o.promptId,
    brandMentioned: o.brandMentioned,
    brandCited: o.brandCited,
    brandRecommended: o.brandRecommended,
    competitorMentions: (o.competitorMentions as Record<string, number> | null) ?? null,
    citations: (o.citations as Citation[] | null) ?? null,
    simulated: o.simulated,
    createdAt: o.createdAt,
  }));
  const vis = visRun ? summarizeVisibility({ metrics: visRun.metrics, finishedAt: visRun.finishedAt }, observations, brandNames) : { summary: emptyVisibility(), excludedSimulated: 0 };

  const ctx: CheckContext = {
    websiteUrl: project.websiteUrl,
    brandNames: brandNames.length ? brandNames : [project.name],
    competitors,
    pages,
    site,
    findings,
    ai: vis.summary,
    now: new Date(),
  };

  const report = composeReport({
    projectId: project.id,
    brand,
    websiteUrl: project.websiteUrl,
    generatedAt: new Date(),
    crawl: crawlRun ? { crawlRunId: crawlRun.id, pagesCrawled: crawlRun.pagesCrawled || pages.length, pagesFound: crawlRun.pagesFound, finishedAt: crawlRun.finishedAt } : null,
    ctx,
    excludedSimulated: vis.excludedSimulated,
  });

  // Optional LLM-written executive summary (computed facts only), cached per data version.
  if (crawlRun && !crawlRunId) {
    const key = `${organizationId}|${crawlRun.id}|${visRun?.id ?? "-"}|${report.overall.score}|${report.issues.length}`;
    const cached = summaryCache.get(key);
    if (cached) {
      report.executiveSummary = cached;
      report.executiveSummarySource = "llm";
    } else {
      const llm = await llmSummary(report);
      if (llm) {
        report.executiveSummary = llm.text;
        report.executiveSummarySource = "llm";
        if (summaryCache.size >= SUMMARY_CACHE_MAX) summaryCache.delete(summaryCache.keys().next().value as string);
        summaryCache.set(key, llm.text);
        try {
          await recordUsage(organizationId, { provider: "openai", taskType: "llm_analysis", credits: 0, costMicros: llm.costMicros, projectId: project.id });
        } catch {
          /* usage accounting must not break the report */
        }
      }
    }
  }
  return report;
}
