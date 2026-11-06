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
import { pointsLabel } from "@/lib/report/points";
import { IMPACT_LABEL } from "@/lib/report/issues";
import { timeLabel, todoHref } from "@/lib/tasks/todo";
import { loadTodo } from "@/lib/tasks/todo-server";
import { log } from "@/lib/log";
import type { SiteReport } from "@/lib/report/types";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { AiCheckRefresh } from "@/components/app/fix/ai-check-refresh";
import { todoItemHref } from "@/components/app/nav";
import { RunButtons } from "@/components/app/run-buttons";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, SCORE_BAND_CLASS, ScoreRing, SimulatedDataBanner, Spinner, scoreBand } from "@/components/ui";

export const metadata = { title: "Home" };

const DAY_MS = 86_400_000;

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
  // The same list, order and "+N points" as the To-do tab (done / skipped problems drop out).
  const todo = report ? await loadTodo(session, project.id, report) : null;
  const fixes = todo?.lists.website.slice(0, 3) ?? [];
  const firstFixHref = fixes[0] ? todoItemHref(project.id, fixes[0].id) : todoHref(project.id);

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
            <AutoRefresh active={crawlActive} label="Checking your website…" />
            {/* AI checks take a while: refresh every ~15 s so new answers and the score land on Home live. */}
            <AiCheckRefresh running={visActive} />
            {!crawlActive && visActive && (
              <span role="status" className="no-print inline-flex items-center gap-2 rounded-full border border-info/30 bg-info-soft px-3 py-1 text-xs font-medium text-info">
                <Spinner size={12} /> Asking AI tools…<span className="sr-only"> This page updates automatically.</span>
              </span>
            )}
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
                    <dt className="text-muted">SEO</dt>
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
                <LinkButton href={todoHref(project.id)} variant="ghost" size="sm" iconRight={<ArrowRight />}>
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
                          <Clock size={12} aria-hidden /> {timeLabel(f.minutes)}
                        </span>
                        {f.points > 0 ? <span className="font-semibold text-success">{pointsLabel(f.points)}</span> : <span>{IMPACT_LABEL[f.impact]}</span>}
                      </div>
                    </div>
                    <LinkButton href={todoItemHref(project.id, f.id)} variant="secondary" size="sm" aria-label={`Start: ${f.title}`}>
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
