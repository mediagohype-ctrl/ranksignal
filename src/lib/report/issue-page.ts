// Data for a single problem's pages (problem page + how-to-fix page): the stored report, the problem, its
// neighbours, and every affected page with what we found on it. Server-only, tenant-scoped.
import { db } from "@/lib/db";
import { getStoredReport } from "@/lib/report/stored";
import { checkIdOfIssue, findingCodeOfIssue, pageNotesFor, type NotePage } from "@/lib/report/page-notes";
import type { ExtractedPage } from "@/lib/types";
import type { FixPage } from "@/lib/fix-guides";

const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export async function loadIssue(organizationId: string, projectId: string, issueId: string) {
  const report = await getStoredReport(projectId, organizationId);
  const index = report?.issues.findIndex((i) => i.id === issueId) ?? -1;
  if (!report || index < 0) return null;
  const issue = report.issues[index];

  const urls = issue.affectedUrls;
  const byUrl = new Map<string, FixPage>();
  const checkId = checkIdOfIssue(issue.id);
  const code = findingCodeOfIssue(issue.id);
  if (report.crawl.crawlRunId && urls.length) {
    const rows = await db.crawlPage.findMany({
      where: { organizationId, crawlRunId: report.crawl.crawlRunId, OR: [{ url: { in: urls } }, { finalUrl: { in: urls } }] },
      select: { url: true, finalUrl: true, statusCode: true, redirectChain: true, responseBytes: true, extracted: true, error: true },
      take: 200,
    });
    const pages = rows.map((r) => ({
      urls: [r.url, r.finalUrl].filter((u): u is string => !!u),
      page: {
        statusCode: r.statusCode,
        redirectChain: strArr(r.redirectChain),
        responseBytes: r.responseBytes,
        extracted: (r.extracted as ExtractedPage | null) ?? null,
        error: r.error,
      } satisfies NotePage,
    }));
    const noteOf = checkId ? pageNotesFor(checkId, pages.map((p) => p.page)) : () => null;
    for (const p of pages) for (const u of p.urls) byUrl.set(u, { url: u, note: noteOf(p.page), extracted: p.page.extracted });
  }
  if (code) {
    const rows = await db.auditFinding.findMany({
      where: { organizationId, projectId, code, status: "open" },
      select: { pageUrl: true, message: true },
      take: 200,
    });
    for (const r of rows) {
      if (!r.pageUrl) continue;
      const cur = byUrl.get(r.pageUrl);
      if (!cur?.note) byUrl.set(r.pageUrl, { url: r.pageUrl, note: r.message, extracted: cur?.extracted ?? null });
    }
  }
  const pages: FixPage[] = urls.map((u) => byUrl.get(u) ?? { url: u, note: null, extracted: null });

  return {
    report,
    issue,
    index,
    prev: report.issues[index - 1] ?? null,
    next: report.issues[index + 1] ?? null,
    pages,
    /** Affected pages beyond the stored list (older checks kept 20). */
    unlisted: Math.max(0, issue.affectedCount - urls.length),
  };
}
