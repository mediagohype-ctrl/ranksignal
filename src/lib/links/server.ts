// Server loader for internal link suggestions: reads the latest finished crawl's pages (tenant-scoped) and
// computes suggestions in memory. No storage of its own — results always match the latest website check.
import { db } from "@/lib/db";
import type { SessionContext } from "@/lib/types";
import { OPEN_STATUSES } from "@/lib/tasks/types";
import { suggestInternalLinks, type LinkExtract, type LinkPage, type LinkReport } from "@/lib/links/suggest";

const DONE = ["succeeded", "succeeded_with_warnings"];
const MAX_PAGES = 1500;
export const LINK_TASK_PREFIX = 'Add a link from "';

export interface LinkData {
  crawl: { id: string; finishedAt: Date | null; createdAt: Date; pagesCrawled: number } | null;
  report: LinkReport | null;
  /** Titles of open to-do items created from link suggestions (so "Add to my to-do" isn't offered twice). */
  existingTaskTitles: string[];
}

function brandList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((b): b is string => typeof b === "string") : [];
}

export async function loadLinkData(
  s: Pick<SessionContext, "organizationId">,
  project: { id: string; websiteUrl: string; brandNames: unknown; name: string },
): Promise<LinkData> {
  const where = { organizationId: s.organizationId, projectId: project.id };
  const [crawl, tasks] = await Promise.all([
    db.crawlRun.findFirst({
      where: { ...where, status: { in: DONE } },
      orderBy: { createdAt: "desc" },
      select: { id: true, finishedAt: true, createdAt: true, pagesCrawled: true },
    }),
    db.task.findMany({
      where: { ...where, status: { in: [...OPEN_STATUSES] }, title: { startsWith: LINK_TASK_PREFIX } },
      select: { title: true },
      take: 1000,
    }),
  ]);
  const existingTaskTitles = tasks.map((t) => t.title);
  if (!crawl) return { crawl: null, report: null, existingTaskTitles };

  const rows = await db.crawlPage.findMany({
    where: { organizationId: s.organizationId, crawlRunId: crawl.id },
    select: { url: true, finalUrl: true, statusCode: true, contentType: true, extracted: true },
    orderBy: { crawledAt: "asc" },
    take: MAX_PAGES,
  });
  const pages: LinkPage[] = rows.map((r) => ({
    url: r.url,
    finalUrl: r.finalUrl,
    statusCode: r.statusCode,
    contentType: r.contentType,
    extracted: toExtract(r.extracted),
  }));
  const brandNames = [...brandList(project.brandNames), project.name];
  const report = suggestInternalLinks(pages, { brandNames, homepageUrl: project.websiteUrl });
  return { crawl, report, existingTaskTitles };
}

/** Defensive read of CrawlPage.extracted (untrusted JSON from older extractor versions). */
function toExtract(v: unknown): LinkExtract | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const e = v as Record<string, unknown>;
  const strArr = (x: unknown) => (Array.isArray(x) ? x.filter((y): y is string => typeof y === "string") : []);
  const headings = Array.isArray(e.headings)
    ? e.headings
        .filter((h): h is { level: number; text: string } => !!h && typeof h === "object" && typeof (h as { text?: unknown }).text === "string")
        .map((h) => ({ level: Number(h.level) || 0, text: h.text }))
    : [];
  return {
    title: typeof e.title === "string" ? e.title : null,
    h1: strArr(e.h1),
    headings,
    internalLinks: strArr(e.internalLinks),
    textSample: typeof e.textSample === "string" ? e.textSample : "",
    wordCount: typeof e.wordCount === "number" ? e.wordCount : 0,
    canonical: typeof e.canonical === "string" ? e.canonical : null,
    robotsMeta: typeof e.robotsMeta === "string" ? e.robotsMeta : null,
  };
}
