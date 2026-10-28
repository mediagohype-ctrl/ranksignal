import { Download, Sparkles, Wand2 } from "lucide-react";
import { db } from "@/lib/db";
import { buildSiteReport } from "@/lib/report/build";
import type { SiteReport } from "@/lib/report/types";
import { requireAppProject, hasRole } from "@/lib/dashboard/server";
import { fmtDate, fmtRelative, hostOf, isActiveStatus } from "@/lib/dashboard/format";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { PrintButton } from "@/components/app/print-button";
import { RunButtons } from "@/components/app/run-buttons";
import { AiVisibilitySection } from "@/components/app/report/ai-visibility-section";
import { IssueList } from "@/components/app/report/issue-list";
import { PILLAR_EXPLAINER, PILLAR_ICON } from "@/components/app/report/pillars";
import { QuickWins } from "@/components/app/report/quick-wins";
import { ReportInProgress, ReportNoCrawl } from "@/components/app/report/report-progress";
import {
  Badge, Card, CheckList, GradeBadge, Notice, PageHeader, PillarCard, SCORE_BAND_CLASS, ScoreRing, SectionHeading, buttonClass, scoreBand,
} from "@/components/ui";

export const metadata = { title: "SEO, AEO & GEO report" };
export const dynamic = "force-dynamic";

const DONE = ["succeeded", "succeeded_with_warnings"];

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, project } = await requireAppProject(id);
  const where = { organizationId: session.organizationId, projectId: project.id };
  const canRun = hasRole(session, "member");

  const [latestCrawl, lastGoodCrawl, latestVis, promptCount] = await Promise.all([
    db.crawlRun.findFirst({ where, orderBy: { createdAt: "desc" } }),
    db.crawlRun.findFirst({ where: { ...where, status: { in: DONE } }, orderBy: { createdAt: "desc" }, select: { id: true } }),
    db.visibilityRun.findFirst({ where, orderBy: { createdAt: "desc" } }),
    db.trackedPrompt.count({ where: { ...where, active: true } }),
  ]);
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
  const issuesById = new Map(r.issues.map((i) => [i.id, i]));
  const quickWins = r.quickWins.map((qid) => issuesById.get(qid)).filter((i): i is NonNullable<typeof i> => !!i);
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

      {/* Hero */}
      <Card as="section" padding="lg" aria-labelledby="report-hero" className="break-inside-avoid">
        <div className="flex flex-col gap-8 md:flex-row md:items-center">
          <div className="flex shrink-0 flex-col items-center gap-3">
            <ScoreRing score={r.overall.score} grade={null} size="lg" label="Overall score" caption="Overall score" />
            {r.overall.grade && (
              <span className="inline-flex items-center gap-2">
                <GradeBadge grade={r.overall.grade} label="Overall grade" size="sm" />
                <span className={`text-small font-medium ${SCORE_BAND_CLASS[scoreBand(r.overall.score)].text}`}>
                  {SCORE_BAND_CLASS[scoreBand(r.overall.score)].label}
                </span>
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="report-hero" className="text-h2 text-balance text-fg">
              {r.overall.headline}
            </h2>
            <div className="mt-4 flex items-center gap-2">
              {r.executiveSummarySource === "llm" ? (
                <Badge tone="primary" icon={<Sparkles />}>
                  AI-written summary
                </Badge>
              ) : (
                <Badge tone="neutral" icon={<Wand2 />}>
                  Automatic summary
                </Badge>
              )}
            </div>
            <p className="mt-3 whitespace-pre-line text-body leading-relaxed text-fg-soft">{r.executiveSummary}</p>
          </div>
        </div>
      </Card>

      {/* Pillars */}
      <section aria-labelledby="pillars" className="space-y-4">
        <SectionHeading
          id="pillars"
          title="Your four scores"
          description="Each score is out of 100 and comes from real checks on your pages and real AI answers."
        />
        <div className="grid gap-6 md:grid-cols-2">
          {r.pillars.map((p) => (
            <PillarCard
              key={p.pillar}
              {...p}
              icon={PILLAR_ICON[p.pillar]}
              className="break-inside-avoid"
              summary={
                <>
                  <span className="block text-fg-soft">{p.summary}</span>
                  <span className="mt-1.5 block text-xs text-muted">{PILLAR_EXPLAINER[p.pillar]}</span>
                </>
              }
              href="#issues"
              linkLabel="See what to fix"
            />
          ))}
        </div>
      </section>

      {/* Quick wins */}
      {quickWins.length > 0 && (
        <section aria-labelledby="quick-wins" className="space-y-4">
          <SectionHeading
            id="quick-wins"
            title="Fix these first"
            description="High-value fixes that are quick to do. Click one to see the step-by-step instructions."
          />
          <QuickWins issues={quickWins} />
        </section>
      )}

      {/* Issues */}
      <section aria-labelledby="issues" className="scroll-mt-24 space-y-4">
        <SectionHeading
          id="issues"
          title="What's wrong & how to fix it"
          description="Every problem we found, explained simply, with why it matters and the steps to fix it. Most important first."
        />
        <IssueList issues={r.issues} quickWins={r.quickWins} projectId={project.id} />
      </section>

      {/* AI visibility */}
      <section aria-labelledby="ai-visibility" className="space-y-4">
        <SectionHeading
          id="ai-visibility"
          title="How AI assistants see you"
          description={
            r.aiVisibility.measured
              ? `Based on ${r.aiVisibility.collected ?? r.aiVisibility.sampleSize} answers from ${r.aiVisibility.providers.join(", ") || "AI assistants"}${r.aiVisibility.measuredAt ? `, collected ${fmtDate(r.aiVisibility.measuredAt)}` : ""}.`
              : "We ask AI assistants the questions your customers ask, and check whether you come up."
          }
        />
        <AiVisibilitySection
          ai={r.aiVisibility}
          brand={r.brand}
          projectId={project.id}
          canRun={canRun}
          visibilityActive={visActive}
        />
      </section>

      {/* Strengths */}
      {r.strengths.length > 0 && (
        <section aria-labelledby="strengths" className="space-y-4">
          <SectionHeading id="strengths" title="What you're already doing well" description="Keep these in place as you make changes." />
          <Card padding="md" className="break-inside-avoid">
            <CheckList checks={r.strengths.map((s, i) => ({ id: `s-${i}`, label: s, status: "pass" }))} />
          </Card>
        </section>
      )}

      {/* Limitations + methodology */}
      <footer className="space-y-3 break-inside-avoid">
        {r.limitations.length > 0 && (
          <Notice tone="neutral" title="Limitations of this report">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {r.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </Notice>
        )}
        <p className="text-xs text-muted">
          Scores are estimates from the pages we could read and a sample of AI answers; they don&apos;t guarantee rankings or AI placements.
          Methodology v{r.methodologyVersion} · Report generated {fmtDate(r.generatedAt, true)}.
        </p>
      </footer>
    </div>
  );
}
