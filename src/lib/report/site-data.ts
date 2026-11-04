// Site-level crawl facts (robots.txt AI-bot rules, llms.txt, sitemap, HTTPS).
// Storage: the crawl job returns them as `site` in its result, which the job queue persists in
// WorkflowRun.output; CrawlRun.workflowRunId links the two. No schema change and no fake CrawlPage rows.
// Older runs without it return null and the report checks fall back to the audit findings.
import { db } from "@/lib/db";
import type { SiteContext } from "@/lib/audit/rules";
import { parseJsSite, type JsSiteDetection } from "@/lib/crawler/js-site";

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


/** Site facts plus the JavaScript-only detection stored with the same crawl (one query). */
export async function getCrawlFacts(
  organizationId: string,
  crawlRun: { id: string; workflowRunId: string | null },
): Promise<{ site: SiteContext | null; jsSite: JsSiteDetection | null }> {
  if (!crawlRun.workflowRunId) return { site: null, jsSite: null };
  const wf = await db.workflowRun.findFirst({ where: { id: crawlRun.workflowRunId, organizationId }, select: { output: true } });
  const out = wf?.output && typeof wf.output === "object" ? (wf.output as Record<string, unknown>) : null;
  const sameRun = !!out && (out.crawlRunId === undefined || out.crawlRunId === crawlRun.id);
  return { site: parseSiteContext(wf?.output ?? null, crawlRun.id), jsSite: sameRun ? parseJsSite(out!.jsSite) : null };
}
