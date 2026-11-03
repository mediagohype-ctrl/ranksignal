import Link from "next/link";
import { ArrowRight, Clock, FileText, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { getProjectDashboard } from "@/lib/dashboard/data";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { fmtDate } from "@/lib/dashboard/format";
import { readSchedule } from "@/lib/dashboard/project-schema";
import { getPlan } from "@/lib/billing/plans";
import { effectiveIntervalDays } from "@/lib/jobs/scheduler";
import { getStoredReport } from "@/lib/report/stored";
import { scoreLabel } from "@/lib/report/score";
import { log } from "@/lib/log";
import type { IssueEffort, IssueImpact, SiteReport } from "@/lib/report/types";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { RunButtons } from "@/components/app/run-buttons";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, SCORE_BAND_CLASS, ScoreRing, SimulatedDataBanner, scoreBand } from "@/components/ui";

export const metadata = { title: "Home" };

const DAY_MS = 86_400_000;
const EFFORT_TIME: Record<IssueEffort, string> = { quick: "About 15 min", moderate: "About 1 hour", involved: "Half a day or more" };
const IMPACT_TEXT: Record<IssueImpact, string> = { high: "Big win", medium: "Good win", low: "Small win" };

// Home (brief 5.4): one score, two small numbers, the next 3 fixes, one primary button, last/next check.
export default async function HomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const [d, org] = await Promise.all([
    getProjectDashboard(session.organizationId, project.id),
    db.organization.findUnique({ where: { id: session.organizationId }, select: { planId: true } }),
  ]);
  let report: SiteReport | null = null;
  if (d.findings.crawledAt) {
    try {
      // Stored report (built once when the last run finished); a page view never calls the LLM.
      report = await getStoredReport(project.id, session.organizationId);
    } catch (e) {
      log.error("overview.report_failed", { projectId: project.id, orgId: session.organizationId, err: e });
    }
  }

  const m = d.latest?.metrics ?? null;
  const crawlActive = d.activeRuns.some((r) => r.kind === "crawl");
  const visActive = d.activeRuns.some((r) => r.kind === "visibility");
  const base = `/app/projects/${project.id}`;
  const fixes = report?.issues.slice(0, 3) ?? [];
  const firstFixHref = fixes[0] ? `${base}/report/issues/${encodeURIComponent(fixes[0].id)}` : `${base}/audit`;

  const score = report?.overall.score ?? null;
  const partial = report?.overall.partial === true;
  const google = report?.pillars.find((p) => p.pillar === "seo")?.score ?? null;
  const answers = m && !m.simulated ? m.collected : 0;
  const named = m && !m.simulated ? Math.round(m.mentionRate * m.collected) : 0;
  const aiLine = visActive
    ? "We're asking AI tools about you now. Your score updates when the answers arrive."
    : answers === 0
      ? "AI tools haven't been asked about you yet. Run an AI check to finish your score."
      : named === 0
        ? "AI tools don't mention you yet."
        : `AI tools named you in ${named} of ${answers} answers.`;

  const lastChecked = report?.crawl.finishedAt ?? d.findings.crawledAt ?? null;
  const intervalDays = effectiveIntervalDays(readSchedule(project.settings).crawl, getPlan(org?.planId ?? "trial").minScanIntervalDays);
  const nextCheck = lastChecked && intervalDays ? new Date(new Date(lastChecked).getTime() + intervalDays * DAY_MS) : null;

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <PageHeader
        title="Home"
        description={`How ${project.name} shows up on Google and in AI answers.`}
        actions={
          <>
            <AutoRefresh active={d.activeRuns.length > 0} label={crawlActive ? "Checking your website…" : "Asking AI tools…"} />
            <RunButtons
              projectId={project.id}
              crawlActive={crawlActive}
              visibilityActive={visActive}
              canRun={hasRole(session, "member")}
              primary={report ? "none" : "audit"}
              size="sm"
            />
          </>
        }
      />

      {m?.simulated && (
        <SimulatedDataBanner>
          the AI answers behind these numbers came from the built-in simulator, so they don&apos;t count towards your score.
        </SimulatedDataBanner>
      )}

      {report && score !== null ? (
        <>
          <Card as="section" aria-label="Your score" padding="md">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
              <ScoreRing score={score} size="lg" label="Your score" partial={partial} />
              <div className="min-w-0 flex-1">
                <h2 className="text-h2 text-fg">
                  {score} / 100 · <span className={SCORE_BAND_CLASS[scoreBand(score)].text}>{scoreLabel(score)}</span>
                </h2>
                <p className="mt-1 text-body text-fg-soft">{aiLine}</p>
                <dl className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-small sm:justify-start">
                  <div className="flex gap-1.5">
                    <dt className="text-muted">Google health</dt>
                    <dd className="font-semibold tabular-nums text-fg">{google === null ? "—" : `${google} / 100`}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted">AI mentions</dt>
                    <dd className="font-semibold tabular-nums text-fg">
                      <Link href={`${base}/visibility`} className="hover:underline underline-offset-4">
                        {answers ? `${named} of ${answers}` : "Not checked yet"}
                      </Link>
                    </dd>
                  </div>
                </dl>
              </div>
              <LinkButton href={firstFixHref} size="lg" iconRight={<ArrowRight />} className="w-full sm:w-auto">
                Start fixing
              </LinkButton>
            </div>
          </Card>

          <Card as="section" aria-labelledby="next-fixes">
            <CardHeader
              title={<span id="next-fixes">Your next 3 fixes</span>}
              description="The changes that help most for the least work."
              actions={
                <LinkButton href={`${base}/audit`} variant="ghost" size="sm" iconRight={<ArrowRight />}>
                  See all
                </LinkButton>
              }
            />
            {fixes.length === 0 ? (
              <div className="px-5 pb-5 sm:px-6">
                <EmptyState size="sm" icon={<Sparkles />} title="Nothing to fix right now" description="We didn't find problems on the pages we checked." />
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {fixes.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap sm:px-6">
                    <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                      <div className="text-small font-medium text-fg">{f.title}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} aria-hidden /> {EFFORT_TIME[f.effort]}
                        </span>
                        <span>{IMPACT_TEXT[f.impact]}</span>
                      </div>
                    </div>
                    <LinkButton href={`${base}/report/issues/${encodeURIComponent(f.id)}`} variant="secondary" size="sm">
                      Start
                    </LinkButton>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </>
      ) : (
        <Card padding="md">
          <EmptyState
            icon={<FileText />}
            title={crawlActive ? "Reading your website…" : "Let's check your website"}
            description={
              crawlActive
                ? "This takes a few minutes. Your score and first fixes appear here when it's done."
                : "Use the Check website button above. In a few minutes you'll get one score and the first things to fix."
            }
          />
        </Card>
      )}

      <p className="text-center text-small text-muted sm:text-left">
        {lastChecked ? `Last checked ${fmtDate(lastChecked)}` : "Not checked yet"}
        {nextCheck
          ? ` · Next automatic check ${nextCheck.getTime() <= Date.now() ? "due now" : fmtDate(nextCheck)}`
          : lastChecked
            ? " · Automatic checks are off"
            : ""}
        {" · "}
        <Link href={`${base}/report`} className="font-medium text-primary hover:underline">
          Full report
        </Link>
      </p>
    </div>
  );
}
