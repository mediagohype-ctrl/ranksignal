import { ArrowRight, CheckCircle2, FileText, History, MessageSquare, TrendingUp } from "lucide-react";
import { db } from "@/lib/db";
import { getProjectDashboard } from "@/lib/dashboard/data";
import { hasRole, requireAppProject } from "@/lib/dashboard/server";
import { readNotificationPrefs } from "@/lib/dashboard/project-schema";
import { getExpertMode } from "@/lib/expert";
import { buildScorePoints, scoreChange } from "@/components/app/history/score-points";
import { MonthlyEmailSwitch } from "@/components/app/history/monthly-email-switch";
import { ShareReportButton } from "@/components/app/report/share-report";
import { BadgeEmbed } from "@/components/app/badge-embed";
import { fmtDate, humanize, pct } from "@/lib/dashboard/format";
import { appliedChangeWhere, APPLIED_STATUSES } from "@/lib/actions/service";
import { backfillSnapshots, getPeriodComparison, listSnapshots, type SnapshotView } from "@/lib/snapshots";
import { SinceLastMonth } from "@/components/app/history/since-last-month";
import { TrendChart } from "@/components/app/charts";
import { HistoryExplorer, type HistorySnapshotRow, type ShippedChange } from "@/components/app/history/history-explorer";
import { PrintButton } from "@/components/app/print-button";
import {
  Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, Notice, PageHeader, SimulatedDataBanner, Stat, StatusBadge, Table, TD, TH,
  THead, TR,
} from "@/components/ui";

export const metadata = { title: "Progress" };

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const orgId = session.organizationId;
  const [d, executed, appliedValidated, shippedRows, snapshots, expert] = await Promise.all([
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
    getExpertMode(session),
  ]);
  // After loadSnapshots (which backfills past runs), so the comparison sees them.
  const comparison = snapshots.length ? await getPeriodComparison(project.id, orgId).catch(() => null) : null;
  const applied = d.actions.applied;
  const historyRows: HistorySnapshotRow[] = snapshots.map(toRow);
  const shipped: ShippedChange[] = shippedRows.map((e) => ({ at: (e.finishedAt ?? e.startedAt).toISOString(), title: humanize(e.action.type) }));
  const anySimulated = d.history.some((h) => h.simulated);
  const reportHref = `/app/projects/${project.id}/report`;
  // Tiles (brief 5.7): fixes done, AI mentions, score change since the first check (real checks only).
  const change = scoreChange(buildScorePoints(historyRows.filter((r) => !r.simulated)).points);
  const m = d.latest?.metrics ?? null;
  const answers = m && !m.simulated ? m.collected : 0;
  const named = m && !m.simulated ? Math.round(m.mentionRate * m.collected) : 0;
  const canEdit = hasRole(session, "member");

  return (
    <div className="space-y-8">
      <PageHeader
        icon={<History />}
        eyebrow="Progress"
        title="Is it working?"
        description={`How ${project.name}'s score has changed, and the fixes that went live.`}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <PrintButton label="Download PDF" />
            <ShareReportButton projectId={project.id} canManage={hasRole(session, "admin")} label="Share link" />
          </div>
        }
      />

      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="Fixes done"
          value={applied}
          icon={<CheckCircle2 />}
          hint={`${appliedValidated} confirmed live on your website`}
        />
        <Stat
          label="AI mentions"
          value={answers ? named : "—"}
          icon={<MessageSquare />}
          hint={answers ? `Named in ${named} of ${answers} answers` : "No AI check yet"}
        />
        <Stat
          label="Score change since start"
          value={change === null ? "—" : change > 0 ? `+${change}` : change < 0 ? `−${Math.abs(change)}` : "0"}
          icon={<TrendingUp />}
          hint={change === null ? "Shows after your second check" : "Points out of 100"}
        />
      </section>

      <Card className="break-inside-avoid">
        <CardHeader title="Your score over time" description="Each dot on the bottom line is a fix that went live." />
        {historyRows.length === 0 ? (
          <CardBody>
            <EmptyState
              size="sm"
              title="Your score shows here after your first website check."
              action={<LinkButton href={`/app/projects/${project.id}`} variant="secondary" className="no-print">Go to Home</LinkButton>}
            />
          </CardBody>
        ) : (
          <HistoryExplorer snapshots={historyRows} shipped={shipped} expert={expert} />
        )}
      </Card>

      <Card padding="md" className="no-print">
        <MonthlyEmailSwitch projectId={project.id} initial={readNotificationPrefs(project.settings).monthlyReport} canEdit={canEdit} />
      </Card>

      <div className="no-print">
        <BadgeEmbed projectId={project.id} />
      </div>

      {expert && comparison?.after && (
        <SinceLastMonth
          delta={comparison.delta}
          baselineIsFirst={comparison.baselineIsFirst}
          historyHref={`/app/projects/${project.id}/reports`}
        />
      )}

      {expert && (
      <>
      {anySimulated && (
        <SimulatedDataBanner>
          some checks below used sample answers, not real AI tools. Those rows are marked &ldquo;sample&rdquo;.
        </SimulatedDataBanner>
      )}
      <Notice tone="warning" title="A number going up or down doesn't prove why">
        AI answers vary between checks, AI tools and over time. A number moving after a fix doesn&apos;t prove the fix caused it.
      </Notice>

      <Card className="break-inside-avoid">
        <CardHeader title="AI mentions over time" description="Dashed lines mark where your customer questions changed, so compare like with like." />
        <CardBody>
          {d.history.length === 0 ? (
            <EmptyState size="sm" title="No AI checks yet" description="Run an AI check to start tracking how often AI tools name you."
              action={<LinkButton href={`/app/projects/${project.id}/visibility`} variant="secondary" className="no-print">Go to AI answers</LinkButton>}
            />
          ) : (
            <TrendChart
              name="AI mentions score"
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
          <Table caption="Results of each AI check" zebra>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH align="right">Score</TH>
                <TH align="right">Named you</TH>
                <TH align="right">Linked to your site</TH>
                <TH align="right">Recommended</TH>
                <TH align="right">Answers</TH>
                <TH>Question list</TH>
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
                          questions changed
                        </Badge>
                      )}
                      {h.simulated && (
                        <Badge tone="warning" size="sm">
                          sample
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
        <CardHeader title="Fixes made" description="The 50 most recent fixes made to your site, by us or by hand, and how they went." />
        {executed.length === 0 ? (
          <CardBody>
            <EmptyState
              size="sm"
              title="No fixes made yet"
              description="Approve a suggested fix and it will show up here."
              action={
                <LinkButton href={`/app/projects/${project.id}/actions`} variant="secondary" className="no-print">
                  Go to fixes to approve
                </LinkButton>
              }
            />
          </CardBody>
        ) : (
          <Table caption="Fixes made">
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Fix</TH>
                <TH>Page</TH>
                <TH>Result</TH>
                <TH>Checked on your site</TH>
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
                  <TD>{VALIDATION_LABEL[a.executions[0]?.validation ?? ""] ?? "Not yet"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card variant="subtle" padding="md" className="no-print">
        <div className="flex flex-wrap items-center gap-4">
          <FileText aria-hidden size={22} className="shrink-0 text-primary" />
          <p className="min-w-0 flex-1 text-small text-muted">Scores explained, with step-by-step fixes, are in the full report.</p>
          <LinkButton href={reportHref} variant="secondary" iconRight={<ArrowRight />}>
            Go to full report
          </LinkButton>
        </div>
      </Card>
      </>
      )}
      <p className="text-xs text-muted">
        {d.findings.totalOpen} {d.findings.totalOpen === 1 ? "problem" : "problems"} to fix across {d.findings.pagesCrawled}{" "}
        {d.findings.pagesCrawled === 1 ? "page" : "pages"} checked (website check {fmtDate(d.findings.crawledAt)}). AI mentions are measured
        from a sample of answers and don&apos;t guarantee a place on Google or in AI answers.
      </p>
    </div>
  );
}

const VALIDATION_LABEL: Record<string, string> = { passed: "Yes", warning: "Partly", failed: "No" };

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
