import { AlertOctagon, AlertTriangle, CalendarClock, FileSearch, Info, ScanSearch, TriangleAlert } from "lucide-react";
import { db } from "@/lib/db";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { asRecord, fmtDate, fmtRelative, isActiveStatus } from "@/lib/dashboard/format";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { RunButtons } from "@/components/app/run-buttons";
import { FindingsTable, type FindingRow } from "@/components/app/findings-table";
import { CrawlHistory, type CrawlRunView } from "@/components/app/audit/crawl-history";
import { EmptyState, Meter, Notice, PageHeader, SectionHeading, Stat, StatusBadge } from "@/components/ui";

export const metadata = { title: "Audit" };

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const where = { organizationId: session.organizationId, projectId: project.id };
  const [findings, crawlRuns] = await Promise.all([
    db.auditFinding.findMany({ where, orderBy: { detectedAt: "desc" }, take: 1000 }),
    db.crawlRun.findMany({ where, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const canRun = hasRole(session, "member");
  const activeRun = crawlRuns.find((r) => isActiveStatus(r.status));
  const lastDone = crawlRuns.find((r) => r.status === "succeeded" || r.status === "succeeded_with_warnings");
  const rows: FindingRow[] = findings.map((f) => ({
    id: f.id,
    pageUrl: f.pageUrl,
    category: f.category,
    code: f.code,
    severity: f.severity,
    confidence: f.confidence,
    message: f.message,
    evidence: asRecord(f.evidence),
    status: f.status,
    detectedAt: f.detectedAt.toISOString(),
  }));
  const runs: CrawlRunView[] = crawlRuns.map((c) => ({
    id: c.id,
    status: c.status,
    pagesFound: c.pagesFound,
    pagesCrawled: c.pagesCrawled,
    error: c.error,
    createdAt: c.createdAt.toISOString(),
    startedAt: c.startedAt?.toISOString() ?? null,
    finishedAt: c.finishedAt?.toISOString() ?? null,
  }));
  const open = rows.filter((r) => r.status === "open");
  const sev = (s: string) => open.filter((r) => r.severity === s).length;
  const lastAt = lastDone?.finishedAt ?? lastDone?.createdAt ?? null;
  const latest = crawlRuns[0];

  return (
    <>
      <PageHeader
        eyebrow="Site audit"
        title="What's holding your site back"
        description="We read your pages the way search engines and AI assistants do, then list the problems in plain English — most serious first."
        meta={
          lastAt ? (
            <>
              <StatusBadge status={lastDone!.status} />
              <span>Last crawl {fmtRelative(lastAt)}</span>
            </>
          ) : undefined
        }
        actions={
          <>
            <AutoRefresh active={!!activeRun} label="Crawl in progress" />
            <RunButtons projectId={project.id} crawlActive={!!activeRun} visibilityActive={false} canRun={canRun} show={["audit"]} />
          </>
        }
      />

      <div className="space-y-8">
        {activeRun && (
          <Notice tone="info" title="Crawl in progress">
            <p>We’re reading your pages now. This page refreshes automatically; new problems appear when the crawl finishes.</p>
            {activeRun.pagesFound > 0 && (
              <Meter
                className="mt-3 max-w-md"
                value={activeRun.pagesCrawled}
                max={Math.max(activeRun.pagesFound, activeRun.pagesCrawled)}
                label="Pages read so far"
                tone="primary"
                showValue
              />
            )}
          </Notice>
        )}
        {!activeRun && latest && (latest.status === "failed" || latest.status === "cancelled") && (
          <Notice tone="danger" title="The last crawl didn't finish">
            {latest.error ?? "Something stopped the crawl."} Check that your site is online and try again. Results below are from your last
            successful crawl.
          </Notice>
        )}

        <section aria-labelledby="audit-summary">
          <SectionHeading id="audit-summary" title="Summary" description="Open problems by how much they're likely to matter." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Stat
              size="sm"
              label="Pages crawled"
              value={lastDone?.pagesCrawled ?? "—"}
              hint={lastDone ? `of ${lastDone.pagesFound || lastDone.pagesCrawled} found` : "No finished crawl yet"}
              icon={<FileSearch />}
            />
            <Stat size="sm" label="Critical" value={sev("critical")} hint="Fix these first" icon={<AlertOctagon />} />
            <Stat size="sm" label="High" value={sev("high")} hint="Big effect on visibility" icon={<AlertTriangle />} />
            <Stat size="sm" label="Medium" value={sev("medium")} hint="Worth fixing soon" icon={<TriangleAlert />} />
            <Stat size="sm" label="Low & info" value={sev("low") + sev("info")} hint="Nice to have" icon={<Info />} />
            <Stat
              size="sm"
              label="Last crawl"
              value={<span className="text-lg">{lastAt ? fmtDate(lastAt) : "—"}</span>}
              hint={lastAt ? fmtRelative(lastAt) : "Run an audit to start"}
              icon={<CalendarClock />}
            />
          </div>
        </section>

        <section aria-labelledby="audit-findings">
          <SectionHeading
            id="audit-findings"
            title="Problems we found"
            description="Grouped by problem. Open one to see why it matters, how to fix it and which pages are affected."
          />
          {rows.length === 0 && crawlRuns.length === 0 ? (
            <EmptyState
              bordered
              size="lg"
              icon={<ScanSearch />}
              title="No audit yet"
              description="Run your first audit to check titles, descriptions, broken links, structured data and whether AI assistants can read your site."
              action={canRun ? <RunButtons projectId={project.id} crawlActive={false} visibilityActive={false} canRun show={["audit"]} /> : undefined}
            />
          ) : (
            <FindingsTable projectId={project.id} rows={rows} canEdit={canRun} />
          )}
        </section>

        <CrawlHistory runs={runs} />
      </div>
    </>
  );
}
