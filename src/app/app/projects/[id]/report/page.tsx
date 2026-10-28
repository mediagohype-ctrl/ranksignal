import Link from "next/link";
import { Download, History } from "lucide-react";
import { db } from "@/lib/db";
import { buildSiteReport } from "@/lib/report/build";
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

export const metadata = { title: "SEO, AEO & GEO report" };
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
      eyebrow="SEO · AEO · GEO report"
      title={`How visible is ${project.name}?`}
      description={`A plain-English check-up of ${hostOf(project.websiteUrl)} for Google and AI assistants.`}
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
  let buildError: string | null = null;
  try {
    report = await buildSiteReport(project.id, session.organizationId);
  } catch (e) {
    console.error("[report] buildSiteReport failed", e);
    buildError = e instanceof Error ? e.message : "Unknown error";
  }

  if (!report) {
    return (
      <>
        {header}
        <Notice tone="danger" title="We couldn't put your report together">
          Your scan finished, but building the report failed{buildError ? ` (${buildError})` : ""}. Try refreshing the page, or re-scan
          your website.
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
        eyebrow="SEO · AEO · GEO report"
        title={`${r.brand} — ${host}`}
        description="How easily Google and AI assistants can find, understand and recommend you — and what to fix first."
        meta={
          <>
            <span>Generated {fmtDate(r.generatedAt, true)}</span>
            <span aria-hidden>·</span>
            <span>Website scanned {r.crawl.finishedAt ? fmtRelative(r.crawl.finishedAt) : "—"}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">
              {r.crawl.pagesCrawled} {r.crawl.pagesCrawled === 1 ? "page" : "pages"} scanned
            </span>
            {previousCrawl && (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={`/app/projects/${project.id}/reports`}
                  className="focus-ring inline-flex items-center gap-1 rounded text-primary hover:underline"
                >
                  <History aria-hidden size={14} />
                  Previous scan {fmtDate(previousCrawl.finishedAt ?? previousCrawl.createdAt)} — see history
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
              labels={{ audit: "Re-scan website" }}
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
        <Notice tone="info" className="no-print" title={crawlActive ? "Re-scanning your website…" : "Asking AI assistants about you…"}>
          <span className="inline-flex flex-wrap items-center gap-2">
            This report updates automatically when the new results are in.
            <AutoRefresh active={running} intervalMs={3000} label="Checking for updates" />
          </span>
        </Notice>
      )}

      {latestCrawl && latestCrawl.status === "failed" && latestCrawl.id !== lastGoodCrawl.id && (
        <Notice tone="warning" className="no-print" title="Your latest re-scan didn't finish">
          {latestCrawl.error || "Something went wrong while reading your site."} This report still shows results from your previous
          successful scan.
        </Notice>
      )}

      <ReportBody
        report={r}
        projectId={project.id}
        canRun={canRun}
        visibilityActive={visActive}
        measuredWith={<MeasuredWith labels={r.aiVisibility.providers} />}
      />
    </div>
  );
}
