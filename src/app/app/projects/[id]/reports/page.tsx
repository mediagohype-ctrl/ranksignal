import { ArrowRight, FileText, History } from "lucide-react";
import { db } from "@/lib/db";
import { getProjectDashboard } from "@/lib/dashboard/data";
import { requireAppProject } from "@/lib/dashboard/server";
import { fmtDate, humanize, pct } from "@/lib/dashboard/format";
import { BRAND } from "@/lib/brand";
import { appliedChangeWhere, APPLIED_STATUSES } from "@/lib/actions/service";
import { backfillSnapshots, listSnapshots, type SnapshotView } from "@/lib/snapshots";
import { TrendChart } from "@/components/app/charts";
import { HistoryExplorer, type HistorySnapshotRow, type ShippedChange } from "@/components/app/history/history-explorer";
import { PrintButton } from "@/components/app/print-button";
import {
  Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, Notice, PageHeader, SimulatedDataBanner, Stat, StatusBadge, Table, TD, TH,
  THead, TR,
} from "@/components/ui";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const orgId = session.organizationId;
  const [d, executed, appliedValidated, shippedRows, snapshots] = await Promise.all([
    getProjectDashboard(orgId, project.id),
    db.action.findMany({
      where: {
        organizationId: orgId,
        projectId: project.id,
        status: { in: [...APPLIED_STATUSES, "failed", "rolled_back", "rollback_failed"] },
        // Only real attempts: excludes class A briefs that older versions auto-marked "succeeded".
        executions: { some: {} },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { executions: { orderBy: { startedAt: "desc" }, take: 1, select: { validation: true, finishedAt: true, connector: true } } },
    }),
    db.action.count({ where: { ...appliedChangeWhere(orgId, project.id), executions: { some: { result: "success", validation: "passed" } } } }),
    db.actionExecution.findMany({
      where: { organizationId: orgId, result: "success", action: { projectId: project.id } },
      orderBy: { startedAt: "asc" },
      take: 500,
      select: { startedAt: true, finishedAt: true, action: { select: { type: true } } },
    }),
    loadSnapshots(project.id, orgId),
  ]);
  const s = d.actions.byStatus;
  const applied = d.actions.applied;
  const validated = appliedValidated;
  const failed = (s.failed ?? 0) + (s.rollback_failed ?? 0);
  const rolledBack = s.rolled_back ?? 0;
  const historyRows: HistorySnapshotRow[] = snapshots.map(toRow);
  const shipped: ShippedChange[] = shippedRows.map((e) => ({ at: (e.finishedAt ?? e.startedAt).toISOString(), title: humanize(e.action.type) }));
  const anySimulated = d.history.some((h) => h.simulated);
  const first = d.history[0];
  const last = d.history[d.history.length - 1];
  const delta = first && last && first !== last ? Math.round(last.visibilityIndex - first.visibilityIndex) : null;
  const reportHref = `/app/projects/${project.id}/report`;

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<History />}
        title="History & changes"
        description={`${project.name} · progress over time and the changes made · prepared ${fmtDate(new Date(), true)} by ${BRAND.name}`}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <PrintButton />
            <LinkButton href={reportHref} icon={<FileText />} iconRight={<ArrowRight />}>
              Open SEO/AEO/GEO report
            </LinkButton>
          </div>
        }
      />

      <Card variant="subtle" padding="md" className="no-print">
        <div className="flex flex-wrap items-center gap-4">
          <FileText aria-hidden size={22} className="shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h2 className="text-h4 text-fg">Looking for your scores and what to fix?</h2>
            <p className="text-small text-muted">
              The full report explains your SEO, AEO and GEO scores in plain English, with step-by-step fixes. This page tracks history.
            </p>
          </div>
          <LinkButton href={reportHref} variant="secondary" iconRight={<ArrowRight />}>
            Go to report
          </LinkButton>
        </div>
      </Card>

      {anySimulated && (
        <SimulatedDataBanner>
          some checks below used the built-in simulator rather than real AI assistants. Those rows are marked &ldquo;simulated&rdquo;.
        </SimulatedDataBanner>
      )}
      <Notice tone="warning" title="Changes in numbers aren't proof of cause">
        AI answers vary between checks, assistants and over time. A metric moving after a change doesn&apos;t prove the change caused it.
      </Notice>

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Visibility index"
          value={last ? Math.round(last.visibilityIndex) : "—"}
          delta={delta}
          deltaLabel={first ? `since ${fmtDate(first.at)}` : undefined}
          hint={last ? `Latest check ${fmtDate(last.at)}` : "No checks yet"}
        />
        <Stat label="Mentioned" value={pct(last?.mentionRate)} hint={last ? `Out of ${last.sampleSize} answers` : undefined} />
        <Stat label="Changes applied" value={applied} hint={`${validated} confirmed live after applying`} />
        <Stat label="Failed / rolled back" value={`${failed} / ${rolledBack}`} hint="Changes that didn't stick or were undone" />
      </section>

      <Card className="break-inside-avoid">
        <CardHeader
          title="Score history"
          description="Overall score and the four pillars after each check. Dots mark changes shipped to your site; dashed lines mark where the questions or our scoring method changed."
        />
        {historyRows.length === 0 ? (
          <CardBody>
            <EmptyState size="sm" title="No history yet" description="Run a website scan to record your first scores. Each later scan adds a point." />
          </CardBody>
        ) : (
          <HistoryExplorer snapshots={historyRows} shipped={shipped} />
        )}
      </Card>

      <Card className="break-inside-avoid">
        <CardHeader title="AI visibility over time" description="Dashed lines mark where the questions changed, so compare like with like." />
        <CardBody>
          {d.history.length === 0 ? (
            <EmptyState size="sm" title="No measurements yet" description="Run an AI visibility check to start tracking." />
          ) : (
            <TrendChart
              name="Visibility index"
              data={d.history.map((h) => ({
                label: fmtDate(h.at),
                value: h.visibilityIndex,
                discontinuity: h.discontinuity,
                promptSetVersion: h.promptSetVersion,
              }))}
            />
          )}
        </CardBody>
        {d.history.length > 0 && (
          <Table caption="Results of each AI visibility check" zebra>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH align="right">Index</TH>
                <TH align="right">Mentioned</TH>
                <TH align="right">Linked</TH>
                <TH align="right">Recommended</TH>
                <TH align="right">Answers</TH>
                <TH>Questions</TH>
              </tr>
            </THead>
            <tbody>
              {[...d.history].reverse().map((h) => (
                <TR key={h.runId}>
                  <TD>{fmtDate(h.at)}</TD>
                  <TD numeric>{Math.round(h.visibilityIndex)}</TD>
                  <TD numeric>{pct(h.mentionRate)}</TD>
                  <TD numeric>{pct(h.citationRate)}</TD>
                  <TD numeric>{pct(h.recommendationRate)}</TD>
                  <TD numeric>{h.sampleSize}</TD>
                  <TD>
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      v{h.promptSetVersion}
                      {h.discontinuity && (
                        <Badge tone="warning" size="sm">
                          changed
                        </Badge>
                      )}
                      {h.simulated && (
                        <Badge tone="warning" size="sm">
                          simulated
                        </Badge>
                      )}
                    </span>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="break-inside-avoid">
        <CardHeader title="Changes made" description="The 50 most recent changes made to your site, whether applied automatically or done by hand, and how they went." />
        {executed.length === 0 ? (
          <CardBody>
            <EmptyState
              size="sm"
              title="No changes made yet"
              description="Approve a suggested change in the Actions center and it will show up here."
              action={
                <LinkButton href={`/app/projects/${project.id}/actions`} variant="secondary" className="no-print">
                  Open Actions center
                </LinkButton>
              }
            />
          </CardBody>
        ) : (
          <Table caption="Changes made">
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Change</TH>
                <TH>Page</TH>
                <TH>Outcome</TH>
                <TH>Checked live</TH>
              </tr>
            </THead>
            <tbody>
              {executed.map((a) => (
                <TR key={a.id}>
                  <TD>{fmtDate(a.executions[0]?.finishedAt ?? a.updatedAt)}</TD>
                  <TD className="font-medium text-fg">
                    {humanize(a.type)}
                    {a.executions[0]?.connector === "manual" && <span className="ml-1.5 text-xs font-normal text-muted">(done by hand)</span>}
                  </TD>
                  <TD className="max-w-xs truncate text-xs text-muted">{(a.target as { url?: string } | null)?.url ?? "—"}</TD>
                  <TD>
                    <StatusBadge status={a.status} />
                  </TD>
                  <TD className="capitalize">{a.executions[0]?.validation ?? "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <p className="text-xs text-muted">
        {d.findings.totalOpen} open problems across {d.findings.pagesCrawled} scanned pages (scan {fmtDate(d.findings.crawledAt)}). AI
        visibility is measured from sampled answers and doesn&apos;t guarantee rankings or placements.
      </p>
    </div>
  );
}

/** Snapshots incl. simulated (the explorer toggles them). Lazily backfills past runs the first time. */
async function loadSnapshots(projectId: string, organizationId: string): Promise<SnapshotView[]> {
  try {
    let rows = await listSnapshots(projectId, organizationId, { includeSimulated: true });
    if (rows.length === 0) {
      const attempted = await backfillSnapshots(projectId, organizationId);
      if (attempted.crawl + attempted.visibility > 0) rows = await listSnapshots(projectId, organizationId, { includeSimulated: true });
    }
    return rows;
  } catch (e) {
    console.error("[history] snapshots unavailable", e instanceof Error ? e.message : e);
    return [];
  }
}

function toRow(s: SnapshotView): HistorySnapshotRow {
  return {
    id: s.id,
    kind: s.kind,
    at: s.createdAt.toISOString(),
    crawlRunId: s.crawlRunId,
    overall: s.overallScore,
    grade: s.grade,
    seo: s.pillarScores.seo,
    aeo: s.pillarScores.aeo,
    geo: s.pillarScores.geo,
    brand: s.pillarScores.brand,
    openIssues: s.openIssues?.total ?? null,
    mentionRate: s.visibility?.mentionRate ?? null,
    citationRate: s.visibility?.citationRate ?? null,
    sampleSize: s.visibility?.collected ?? null,
    promptSetVersion: s.promptSetVersion,
    methodologyVersion: s.methodologyVersion,
    simulated: s.simulated,
  };
}
