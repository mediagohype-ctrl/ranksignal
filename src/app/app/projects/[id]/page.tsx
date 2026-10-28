import Link from "next/link";
import { ArrowRight, FileText, Link2, MessageSquare, Radar, ThumbsUp, TriangleAlert } from "lucide-react";
import { getProjectDashboard } from "@/lib/dashboard/data";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { asArray, fmtDate, fmtRelative, humanize, pct } from "@/lib/dashboard/format";
import { buildSiteReport } from "@/lib/report/build";
import type { SiteReport } from "@/lib/report/types";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { RunButtons } from "@/components/app/run-buttons";
import { ShareBarChart, TrendChart } from "@/components/app/charts";
import { PILLAR_SHORT } from "@/components/app/report/pillars";
import {
  Badge, Card, CardBody, CardHeader, EffortChip, EmptyState, ImpactChip, LinkButton, Meter, PageHeader, RiskBadge, ScoreRing,
  SeverityBadge, SimulatedDataBanner, Stat, StatusBadge, Table, TD, TH, THead, TR,
} from "@/components/ui";

export const metadata = { title: "Overview" };

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const d = await getProjectDashboard(session.organizationId, project.id);
  let report: SiteReport | null = null;
  if (d.findings.crawledAt) {
    try {
      report = await buildSiteReport(project.id, session.organizationId);
    } catch (e) {
      console.error("[overview] buildSiteReport failed", e);
    }
  }
  const m = d.latest?.metrics ?? null;
  const brandNames = asArray<string>(project.brandNames);
  const crawlActive = d.activeRuns.some((r) => r.kind === "crawl");
  const visActive = d.activeRuns.some((r) => r.kind === "visibility");
  const providerLabel = d.latest?.providers.length ? d.latest.providers.join(", ") : null;
  const hasDiscontinuity = d.history.some((h) => h.discontinuity);
  const sampleFooter = m ? `${m.collected} of ${m.sampleSize} answers${providerLabel ? ` · ${providerLabel}` : ""}` : undefined;
  const reportHref = `/app/projects/${project.id}/report`;
  const topIssues = report?.issues.slice(0, 5) ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description={`How ${project.name} shows up in Google and AI assistants, at a glance.`}
        actions={
          <>
            <AutoRefresh active={d.activeRuns.length > 0} label={`${d.activeRuns.length} check${d.activeRuns.length === 1 ? "" : "s"} running`} />
            <RunButtons projectId={project.id} crawlActive={crawlActive} visibilityActive={visActive} canRun={hasRole(session, "member")} />
          </>
        }
      />

      {m?.simulated && (
        <SimulatedDataBanner>
          the AI answers behind these numbers came from the built-in simulator. Add a GEMINI_API_KEY to your .env file for real answers.
        </SimulatedDataBanner>
      )}

      {/* Score teaser */}
      <Card as="section" aria-label="Report summary" padding="md">
        {report ? (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="flex items-center gap-5">
              <ScoreRing score={report.overall.score} grade={report.overall.grade} size="md" label="Overall score" />
              <div className="min-w-0">
                <p className="eyebrow">Your site report</p>
                <h2 className="mt-1 text-h3 text-balance text-fg">{report.overall.headline}</h2>
                <p className="mt-1 text-small text-muted">
                  {report.issues.length} {report.issues.length === 1 ? "issue" : "issues"} found · {report.quickWins.length} quick{" "}
                  {report.quickWins.length === 1 ? "win" : "wins"} · {report.crawl.pagesCrawled} pages scanned
                </p>
              </div>
            </div>
            <ul className="flex flex-wrap gap-5 lg:ml-auto" aria-label="Pillar scores">
              {report.pillars.map((p) => (
                <li key={p.pillar} className="flex flex-col items-center gap-1">
                  <ScoreRing score={p.score} grade={p.grade} size="sm" label={`${p.label} score`} />
                  <span className="text-caption text-muted">{PILLAR_SHORT[p.pillar]}</span>
                </li>
              ))}
            </ul>
            <LinkButton href={reportHref} icon={<FileText />} iconRight={<ArrowRight />} className="lg:ml-4">
              Open full report
            </LinkButton>
          </div>
        ) : (
          <EmptyState
            size="sm"
            icon={<FileText />}
            title={crawlActive ? "Your first scan is running" : "No report yet"}
            description={
              crawlActive
                ? "We're reading your pages now. Your SEO, AEO and GEO scores appear here when it finishes."
                : "Scan your website to get SEO, AEO and GEO scores with plain-English fixes."
            }
            action={<LinkButton href={reportHref} variant="secondary">Go to report</LinkButton>}
          />
        )}
      </Card>

      {/* Stats */}
      <section aria-label="AI visibility metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Visibility index"
          icon={<Radar />}
          value={m ? <>{Math.round(m.visibilityIndex)}<span className="text-small font-normal text-muted"> / 100</span></> : "—"}
          hint={m ? "One number combining the three rates" : "Run an AI visibility check to measure"}
          footer={sampleFooter}
        />
        <Stat label="Mentioned" icon={<MessageSquare />} value={pct(m?.mentionRate)} hint="AI answers that name your brand" footer={sampleFooter} />
        <Stat label="Linked to your site" icon={<Link2 />} value={pct(m?.citationRate)} hint="AI answers citing one of your pages" footer={sampleFooter} />
        <Stat label="Recommended" icon={<ThumbsUp />} value={pct(m?.recommendationRate)} hint="AI answers suggesting you" footer={sampleFooter} />
      </section>

      {/* Trend + share */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Visibility over time"
            description="One point per completed AI visibility check."
            actions={hasDiscontinuity ? <Badge tone="warning">Questions changed</Badge> : undefined}
          />
          <CardBody>
            {d.history.length === 0 ? (
              <EmptyState size="sm" title="No measurements yet" description="Run an AI visibility check to start your trend line." />
            ) : (
              <>
                <TrendChart
                  name="Visibility index"
                  data={d.history.map((h) => ({
                    label: fmtDate(h.at),
                    value: h.visibilityIndex,
                    discontinuity: h.discontinuity,
                    promptSetVersion: h.promptSetVersion,
                  }))}
                />
                {hasDiscontinuity && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                    <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden />
                    Dashed lines mark where the questions we ask changed, so values before and after aren&apos;t directly comparable.
                  </p>
                )}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="You vs competitors" description="Share of brand mentions in AI answers." />
          <CardBody>
            {m && Object.keys(m.competitorShare).length > 0 ? (
              <ShareBarChart brand={brandNames} data={Object.entries(m.competitorShare).map(([name, share]) => ({ name, share }))} />
            ) : (
              <EmptyState size="sm" title="No competitor data" description="Add competitors to the project and run an AI visibility check." />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Top issues + actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Top issues"
            description={report ? "The most important things to fix, from your latest scan." : "Open problems from your latest scan."}
            actions={<LinkButton href={`${reportHref}#issues`} variant="ghost" size="sm" iconRight={<ArrowRight />}>All issues</LinkButton>}
          />
          {topIssues.length > 0 ? (
            <ul className="divide-y divide-border">
              {topIssues.map((i) => (
                <li key={i.id}>
                  <Link
                    href={`${reportHref}#${encodeURIComponent(i.id)}`}
                    className="focus-ring flex items-start gap-3 px-5 py-3.5 hover:bg-surface-2 sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-small font-medium text-fg">{i.title}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <ImpactChip impact={i.impact} />
                        <EffortChip effort={i.effort} />
                        <span className="inline-flex h-[22px] items-center rounded-full border border-border px-2 text-xs font-medium text-muted">
                          {PILLAR_SHORT[i.pillar]}
                        </span>
                      </div>
                    </div>
                    <ArrowRight size={16} aria-hidden className="mt-1 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : d.findings.totalOpen > 0 ? (
            <CardBody>
              <ul className="space-y-2.5">
                {Object.entries(d.findings.bySeverity).map(([sev, n]) => (
                  <li key={sev} className="flex items-center justify-between text-small">
                    <SeverityBadge severity={sev} />
                    <span className="tabular-nums">
                      {n} <span className="text-muted">open</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          ) : (
            <CardBody>
              <EmptyState
                size="sm"
                title={d.findings.crawledAt ? "Nothing to fix right now" : "Not scanned yet"}
                description={d.findings.crawledAt ? "We didn't find problems in your latest scan." : "Scan your website to find problems worth fixing."}
              />
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Suggested changes"
            description={`${d.actions.byStatus.awaiting_approval ?? 0} waiting for your approval · ${d.actions.byStatus.succeeded ?? 0} done`}
            actions={
              <LinkButton href={`/app/projects/${project.id}/actions`} variant="ghost" size="sm" iconRight={<ArrowRight />}>
                Actions center
              </LinkButton>
            }
          />
          {d.actions.top.length === 0 ? (
            <CardBody>
              <EmptyState size="sm" title="No suggested changes yet" description="Suggestions appear after a scan or AI visibility check is analysed." />
            </CardBody>
          ) : (
            <ul className="divide-y divide-border">
              {d.actions.top.map((a) => {
                const target = (a.target as { url?: string } | null)?.url;
                return (
                  <li key={a.id}>
                    <Link
                      href={`/app/projects/${project.id}/actions`}
                      className="focus-ring flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-surface-2 sm:px-6"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-small font-medium text-fg">{humanize(a.type)}</div>
                        <div className="truncate text-xs text-muted">{target ?? a.rationale}</div>
                      </div>
                      <RiskBadge riskClass={a.riskClass} compact />
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent runs */}
      <Card>
        <CardHeader title="Recent checks" description="Website scans and AI visibility checks, newest first." />
        {d.recentRuns.length === 0 ? (
          <CardBody>
            <EmptyState
              size="sm"
              title="No checks yet"
              description="Start a website scan or an AI visibility check to see progress here."
              action={<LinkButton href={`/app/projects/${project.id}/prompts`} variant="secondary">Choose AI questions</LinkButton>}
            />
          </CardBody>
        ) : (
          <Table caption="Recent checks">
            <THead>
              <tr>
                <TH>Check</TH>
                <TH>Status</TH>
                <TH>Progress</TH>
                <TH>Started</TH>
                <TH>Finished</TH>
              </tr>
            </THead>
            <tbody>
              {d.recentRuns.map((r) => {
                const unit = r.kind === "crawl" ? "pages" : "answers";
                return (
                  <TR key={r.id}>
                    <TD className="font-medium text-fg">{r.kind === "crawl" ? "Website scan" : "AI visibility check"}</TD>
                    <TD>
                      <StatusBadge status={r.status} />
                      {r.error && (
                        <div className="mt-1 max-w-xs truncate text-xs text-danger" title={r.error}>
                          {r.error}
                        </div>
                      )}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <Meter
                            value={r.progress.done}
                            max={Math.max(1, r.progress.total)}
                            label={`${r.kind === "crawl" ? "Scan" : "Check"} progress`}
                            tone="accent"
                            size="xs"
                          />
                        </div>
                        <span className="text-xs tabular-nums text-muted">
                          {r.progress.done}/{r.progress.total || "?"} {unit}
                        </span>
                      </div>
                    </TD>
                    <TD className="text-muted">{fmtRelative(r.createdAt)}</TD>
                    <TD className="text-muted">{r.finishedAt ? fmtDate(r.finishedAt, true) : "—"}</TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {d.activePromptCount === 0 && (
        <p className="text-small text-muted">
          You aren&apos;t tracking any AI questions yet.{" "}
          <Link href={`/app/projects/${project.id}/prompts`} className="font-medium text-primary hover:underline">
            Add or generate questions
          </Link>{" "}
          before running an AI visibility check.
        </p>
      )}
    </div>
  );
}
