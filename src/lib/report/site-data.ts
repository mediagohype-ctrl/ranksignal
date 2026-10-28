// Site-level crawl facts (robots.txt AI-bot rules, llms.txt, sitemap, HTTPS).
// Storage: the crawl job returns them as `site` in its result, which the job queue persists in
// WorkflowRun.output; CrawlRun.workflowRunId links the two. No schema change and no fake CrawlPage rows.
// Older runs without it return null and the report checks fall back to the audit findings.
import { db } from "@/lib/db";
import type { SiteContext } from "@/lib/audit/rules";

export async function getCrawlSiteContext(
  organizationId: string,
  crawlRun: { id: string; workflowRunId: string | null },
): Promise<SiteContext | null> {
  if (!crawlRun.workflowRunId) return null;
  const wf = await db.workflowRun.findFirst({ where: { id: crawlRun.workflowRunId, organizationId }, select: { output: true } });
  return parseSiteContext(wf?.output ?? null, crawlRun.id);
}

export function parseSiteContext(output: unknown, crawlRunId: string): SiteContext | null {
  const out = output && typeof output === "object" ? (output as Record<string, unknown>) : null;
  if (!out || (out.crawlRunId !== undefined && out.crawlRunId !== crawlRunId)) return null;
  const site = out.site && typeof out.site === "object" ? (out.site as SiteContext) : null;
  if (!site || typeof site.homepageUrl !== "string" || !site.robots || !Array.isArray(site.sitemapsFound)) return null;
  return site;
}

