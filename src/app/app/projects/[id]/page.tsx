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
import { PINNED_FIRST_ID, placesLine, problemCounts, problemsLine, sortByBiggestFix } from "@/lib/report/counts";
import { listSnapshots } from "@/lib/snapshots";
import { freeCheckGapLine } from "@/lib/snapshots/explain";
import { explainScoreChangeFor } from "@/lib/snapshots/explain-server";
import { FREE_CHECK_PAGES, freeCheckScoreFor } from "@/lib/dashboard/free-check-score";
import { getUserTimeZone } from "@/lib/dashboard/tz";
import { DismissibleNote } from "@/components/app/home/dismissible-note";
import { ReferralCard } from "@/components/app/referral-card";
import { timeLabel, todoHref } from "@/lib/tasks/todo";
import { loadTodo } from "@/lib/tasks/todo-server";
import { log } from "@/lib/log";
import type { SiteReport } from "@/lib/report/types";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { AiCheckRefresh } from "@/components/app/fix/ai-check-refresh";
import { aiCheckCopy, aiCheckInFlight } from "@/lib/visibility/run-state";
import { aiCheckEmailsOn, getAiCheckState } from "@/lib/visibility/run-state-server";
import { todoItemHref } from "@/components/app/nav";
import { RunButtons } from "@/components/app/run-buttons";
import { SetupBanner } from "@/components/app/onboarding/setup-banner";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, SCORE_BAND_CLASS, ScoreRing, SimulatedDataBanner, Spinner, scoreBand } from "@/components/ui";

export const metadata = { title: "Home" };

const DAY_MS = 86_400_000;

// Home (brief 5.4): one score, two small numbers, the next 3 fixes, one primary button, last/next check.
export default async function HomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const [d, ai, org] = await Promise.all([
    getProjectDashboard(session.organizationId, project.id),
    // Running / waiting until tomorrow (AI limit reached) / done / failed — the same helper as the AI answers page.
    getAiCheckState(project.id, session.organizationId),
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
  const visActive = aiCheckInFlight(ai) || d.activeRuns.some((r) => r.kind === "visibility");
  const aiCopy = aiCheckCopy(ai, { willEmail: aiCheckEmailsOn(project.settings) });
  const base = `/app/projects/${project.id}`;
  // The same list, order and "+N points" as the To-do tab (done / skipped problems drop out).
  const todo = report ? await loadTodo(session, project.id, report) : null;
  // ONE rule for "biggest fix", shared with the Full report's headline: most points first, ties go to the quickest
  // (src/lib/report/counts.ts). A JavaScript-only site keeps that one problem first, as in the report.
  const ranked = sortByBiggestFix(todo?.lists.website ?? []);
  const pinned = ranked.findIndex((f) => f.id === PINNED_FIRST_ID);
  if (pinned > 0) ranked.unshift(...ranked.splice(pinned, 1));
  const fixes = ranked.slice(0, 3);
  // The same problem count as the Full report, Progress, project cards and notifications.
  const counts = problemCounts(report);
  const places = placesLine(counts);
  const firstFixHref = fixes[0] ? todoItemHref(project.id, fixes[0].id) : todoHref(project.id);

  const score = report?.overall.score ?? null;
  const partial = report?.overall.partial === true;
  const google = report?.pillars.find((p) => p.pillar === "seo")?.score ?? null;
  const answers = m && !m.simulated ? m.collected : 0;
  const named = m && !m.simulated ? Math.round(m.mentionRate * m.collected) : 0;
  // While the FIRST AI check is in flight the score covers the website only: label it "Waiting for AI results"
  // (docs/PLAIN_WORDS.md "partial") so a number that moves when the answers land isn't read as a final score.
  const waitingForAi = visActive && (partial || answers === 0);
  const aiLine = aiCopy
    ? `${aiCopy.title}: ${aiCopy.detail}${waitingForAi ? " Your score is partial until the answers are in." : ""}`
    : visActive
    ? "We're asking AI tools about you now. Your score updates when the answers arrive."
    : answers === 0
      ? "AI tools haven't been asked about you yet. Run an AI check to finish your score."
      : named === 0
        ? "AI tools don't mention you yet."
        : `AI tools named you in ${named} of ${answers} answers.`;

  const lastChecked = report?.crawl.finishedAt ?? d.findings.crawledAt ?? null;
  const intervalDays = effectiveIntervalDays(readSchedule(project.settings).crawl, getPlan(org?.planId ?? "trial").minScanIntervalDays);
  const nextCheck = lastChecked && intervalDays ? new Date(new Date(lastChecked).getTime() + intervalDays * DAY_MS) : null;

  // Why the score is what it is: (a) after the FIRST full check, why it differs from the free check; (b) after a
  // re-check, the main reason it moved. Both come from stored measurements; neither can fail the page.
  let gapLine: string | null = null;
  let changeLine: string | null = null;
  if (report && score !== null) {
    const tz = await getUserTimeZone(session).catch(() => null);
    const snaps = await listSnapshots(project.id, session.organizationId).catch(() => []);
    const checks = new Set(snaps.map((s) => s.crawlRunId).filter(Boolean));
    if (checks.size <= 1) {
      const firstAt = snaps[0]?.createdAt ?? (lastChecked ? new Date(lastChecked) : new Date());
      const freeScore = await freeCheckScoreFor(project.websiteUrl, firstAt);
      gapLine = freeCheckGapLine({
        freeScore,
        freePages: FREE_CHECK_PAGES,
        fullScore: score,
        fullPages: report.crawl.pagesCrawled || null,
        aiMeasured: !partial && answers > 0,
      });
    } else {
      const why = await explainScoreChangeFor(project.id, session.organizationId, "recheck", {
        snapshots: snaps,
        fmtDate: (d) => fmtDate(d, { timeZone: tz }).replace(/ \d{4}$/, ""),
      });
      changeLine = why?.line ?? null;
    }
  }

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
                <Spinner size={12} /> {aiCopy?.short ?? "Asking AI tools…"}<span className="sr-only"> This page updates automatically.</span>
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

      {/* Old accounts that never finished setup: "Finish setting up: 3 details missing" (nothing when complete). */}
      <SetupBanner project={project} organizationId={session.organizationId} canEdit={hasRole(session, "member")} />

      {m?.simulated && (
        <SimulatedDataBanner>
          the AI answers behind these numbers came from the built-in simulator, so they don&apos;t count towards your score.
        </SimulatedDataBanner>
      )}

      {report && score !== null ? (
        <>
          {gapLine && (
            <DismissibleNote storageKey={`home.free-check-gap.${project.id}`} title="Why this score is different from your free check">
              {gapLine}
            </DismissibleNote>
          )}
          <Card as="section" aria-label="Your score" padding="md">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
              <ScoreRing score={score} size="lg" label="Your score" partial={partial || waitingForAi} />
              <div className="min-w-0 flex-1">
                <h2 className="text-h2 text-fg">
                  {score} / 100 · <span className={SCORE_BAND_CLASS[scoreBand(score)].text}>{scoreLabel(score)}</span>
                </h2>
                {(partial || waitingForAi) && (
                  <p className="mt-1 text-small font-medium text-muted" data-testid="score-partial">
                    Partial score · Waiting for AI results
                  </p>
                )}
                <p className="mt-1 text-body text-fg-soft">{aiLine}</p>
                {changeLine && (
                  <p className="mt-1 text-small text-muted" data-testid="score-change-reason">
                    {changeLine}
                  </p>
                )}
                <dl className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-small sm:justify-start">
                  <div className="flex gap-1.5">
                    <dt className="text-muted">SEO</dt>
                    <dd className="font-semibold tabular-nums text-fg">{google === null ? "—" : `${google} / 100`}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt className="text-muted">AI mentions</dt>
                    <dd className="font-semibold tabular-nums text-fg">
                      <Link href={`${base}/visibility`} className="hover:underline underline-offset-4">
                        {answers ? `${named} of ${answers}` : aiCopy ? aiCopy.short : "Not checked yet"}
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
              description={
                counts.problems > 0
                  ? `The fixes that add the most points, quickest first. ${problemsLine(counts)}${places ? ` (${places})` : ""}.`
                  : "The fixes that add the most points, quickest first."
              }
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

      {report && score !== null && (
        <div className="no-print">
          <ReferralCard compact />
        </div>
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
