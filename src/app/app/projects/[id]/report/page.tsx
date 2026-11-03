import Link from "next/link";
import { Download, History } from "lucide-react";
import { db } from "@/lib/db";
import { getStoredReport } from "@/lib/report/stored";
import { log } from "@/lib/log";
import type { SiteReport } from "@/lib/report/types";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { fmtDate, fmtRelative, hostOf, isActiveStatus } from "@/lib/dashboard/format";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { PrintButton } from "@/components/app/print-button";
import { RunButtons } from "@/components/app/run-buttons";
import { MeasuredWith } from "@/components/app/providers-status";
import { ReportBody } from "@/components/app/report/report-body";
import { ReportInProgress, ReportNoCrawl } from "@/components/app/report/report-progress";
import { ShareReportButton } from "@/components/app/report/share-report";
import { Notice, PageHeader, buttonClass } from "@/components/ui";
import { SearchPerformance } from "@/components/app/report/search-performance";

export const metadata = { title: "Full report" };
export const dynamic = "force-dynamic";

const DONE = ["succeeded", "succeeded_with_warnings"];

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const where = { organizationId: session.organizationId, projectId: project.id };
  const canRun = hasRole(session, "member");

  const [latestCrawl, goodCrawls, latestVis, promptCount] = await Promise.all([
    db.crawlRun.findFirst({ where, orderBy: { createdAt: "desc" } }),
    db.crawlRun.findMany({
      where: { ...where, status: { in: DONE } },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: { id: true, finishedAt: true, createdAt: true },
    }),
    db.visibilityRun.findFirst({ where, orderBy: { createdAt: "desc" } }),
    db.trackedPrompt.count({ where: { ...where, active: true } }),
  ]);
  const lastGoodCrawl = goodCrawls[0] ?? null;
  const previousCrawl = goodCrawls[1] ?? null;
  const crawlActive = !!latestCrawl && isActiveStatus(latestCrawl.status);
  const visActive = !!latestVis && isActiveStatus(latestVis.status);

  const header = (
    <PageHeader
      eyebrow="Full report"
      title={`How visible is ${project.name}?`}
      description={`A plain-English check-up of ${hostOf(project.websiteUrl)} for Google and AI tools.`}
    />
  );

  if (!lastGoodCrawl) {
    return (
      <>
        {header}
        {latestCrawl && crawlActive ? (
          <ReportInProgress
            crawl={latestCrawl}
            visibility={latestVis ? { status: latestVis.status, collected: latestVis.collected, sampleSize: latestVis.sampleSize } : null}
            hasPrompts={promptCount > 0}
          />
        ) : (
          <ReportNoCrawl
            projectId={project.id}
            canRun={canRun}
            failedError={latestCrawl && latestCrawl.status === "failed" ? latestCrawl.error : undefined}
          />
        )}
      </>
    );
  }

  let report: SiteReport | null = null;
  try {
    // Stored report (built once when the last run finished); a page view never calls the LLM.
    report = await getStoredReport(project.id, session.organizationId);
  } catch (e) {
    log.error("report_page.report_failed", { projectId: project.id, orgId: session.organizationId, err: e });
  }

  if (!report) {
    return (
      <>
        {header}
        <Notice tone="danger" title="We couldn't put your report together">
          Your website check finished, but we couldn&apos;t build the report. Refresh the page. If it still fails, check your website
          again.
        </Notice>
      </>
    );
  }

  const r = report;
  const host = hostOf(r.websiteUrl);
  const running = crawlActive || visActive;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Full report"
        title={`${r.brand} — ${host}`}
        description="How easily Google and AI tools can find, understand and recommend you — and what to fix first."
        meta={
          <>
            <span>Made {fmtDate(r.generatedAt, true)}</span>
            <span aria-hidden>·</span>
            <span>Website checked {r.crawl.finishedAt ? fmtRelative(r.crawl.finishedAt) : "—"}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {r.crawl.pagesCrawled} {r.crawl.pagesCrawled === 1 ? "page" : "pages"} checked
            </span>
            {previousCrawl && (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={`/app/projects/${project.id}/reports`}
                  className="focus-ring inline-flex items-center gap-1 rounded text-primary hover:underline"
                >
                  <History aria-hidden size={14} />
                  Previous check {fmtDate(previousCrawl.finishedAt ?? previousCrawl.createdAt)} — see score history
                </Link>
              </>
            )}
          </>
        }
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <RunButtons
              projectId={project.id}
              crawlActive={crawlActive}
              visibilityActive={visActive}
              canRun={canRun}
              labels={{ audit: "Check website again" }}
              primary="none"
            />
            <a
              href={`/api/projects/${project.id}/report?format=markdown`}
              download
              className={buttonClass("secondary")}
            >
              <Download aria-hidden /> Download report
            </a>
            <PrintButton />
            <ShareReportButton projectId={project.id} canManage={hasRole(session, "admin")} />
          </div>
        }
      />

      {running && (
        <Notice tone="info" className="no-print" title={crawlActive ? "Checking your website again…" : "Asking AI tools about you…"}>
          <span className="inline-flex flex-wrap items-center gap-2">
            This report updates automatically when the new results are in.
            <AutoRefresh active={running} intervalMs={3000} label="Checking for updates" />
          </span>
        </Notice>
      )}

      {latestCrawl && latestCrawl.status === "failed" && latestCrawl.id !== lastGoodCrawl.id && (
        <Notice tone="warning" className="no-print" title="Your latest website check didn't finish">
          {latestCrawl.error || "Something went wrong while reading your site."} This report still shows your last finished check. Make
          sure your website is online, then try again.
        </Notice>
      )}

      <ReportBody
        report={r}
        projectId={project.id}
        canRun={canRun}
        visibilityActive={visActive}
        measuredWith={<MeasuredWith labels={r.aiVisibility.providers} />}
      />

      {/* Real Google data (Search Console / GA4) when connected; shows a connect prompt otherwise. */}
      <SearchPerformance projectId={project.id} />
    </div>
  );
}
