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
import { getLlmBackend } from "@/lib/providers/llm";
import { log } from "@/lib/log";

const MAX_PAGES = 1000;
const MAX_OBSERVATIONS = 3000;

// Only the columns the checks read. CrawlPage.html-sized blobs and Observation.rawResponse (up to 100 KB
// each × 3000 rows) are deliberately NOT loaded — they made every report build pull tens of MB.
const PAGE_SELECT = {
  url: true, finalUrl: true, statusCode: true, redirectChain: true, contentType: true, responseBytes: true, extracted: true, error: true,
} as const;
const OBSERVATION_SELECT = {
  provider: true, platformLabel: true, promptId: true, brandMentioned: true, brandCited: true, brandRecommended: true,
  competitorMentions: true, citations: true, simulated: true, createdAt: true, prompt: { select: { text: true } },
} as const;

export interface BuildReportOptions {
  /** Build as of this (older) succeeded crawl: findings open when it finished and the AI check finished by then. */
  crawlRunId?: string;
  /**
   * Generate the paid LLM executive summary (and record its usage). ONLY the snapshot writer passes this,
   * once per finished run; request-time callers (pages, APIs, share links) never do — they read the stored
   * report via getStoredReport().
   */
  llmSummary?: boolean;
}

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []);

/**
 * @param opts a crawl run id (legacy form) or BuildReportOptions. Without `llmSummary: true` the summary is the
 *   deterministic template — no paid call.
 */
export async function buildSiteReport(projectId: string, organizationId: string, opts?: string | BuildReportOptions): Promise<SiteReport> {
  const o: BuildReportOptions = typeof opts === "string" ? { crawlRunId: opts } : (opts ?? {});
  const crawlRunId = o.crawlRunId;
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
      ? db.crawlPage.findMany({ where: { organizationId, crawlRunId: crawlRun.id }, select: PAGE_SELECT, orderBy: { crawledAt: "asc" }, take: MAX_PAGES })
      : Promise.resolve([]),
    crawlRun ? getCrawlSiteContext(organizationId, crawlRun) : Promise.resolve(null),
    visRun
      ? db.observation.findMany({
          where: { organizationId, visibilityRunId: visRun.id },
          select: OBSERVATION_SELECT,
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

  // Optional LLM-written executive summary (computed facts only). Generated once per finished run by the
  // snapshot writer and stored with the report — never on a page view.
  if (o.llmSummary && crawlRun) {
    const provider = getLlmBackend() ?? "llm"; // attribute spend to the backend actually used (OpenRouter ≠ OpenAI)
    const llm = await llmSummary(report);
    if (llm) {
      report.executiveSummary = llm.text;
      report.executiveSummarySource = "llm";
      try {
        await recordUsage(organizationId, { provider, taskType: "llm_analysis", credits: 0, costMicros: llm.costMicros, projectId: project.id });
      } catch (err) {
        log.warn("report.usage_record_failed", { projectId: project.id, orgId: organizationId, err }); // must not break the report
      }
    }
  }
  return report;
}
