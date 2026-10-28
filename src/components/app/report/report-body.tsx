// Shared body of the site report (hero → pillars → quick wins → issues → AI visibility → strengths → limitations).
// Used by the in-app report page and the public, read-only /r/[token] page.
import { Sparkles, Wand2 } from "lucide-react";
import type { SiteReport } from "@/lib/report/types";
import { fmtDate } from "@/lib/dashboard/format";
import { AiVisibilitySection } from "@/components/app/report/ai-visibility-section";
import { IssueList } from "@/components/app/report/issue-list";
import { PILLAR_EXPLAINER, PILLAR_ICON } from "@/components/app/report/pillars";
import { QuickWins } from "@/components/app/report/quick-wins";
import { Badge, Card, CheckList, GradeBadge, Notice, PillarCard, SCORE_BAND_CLASS, ScoreRing, SectionHeading, scoreBand } from "@/components/ui";

export function ReportBody({
  report: r,
  projectId,
  canRun = false,
  visibilityActive = false,
  readOnly = false,
  measuredWith,
}: {
  report: SiteReport;
  /** Omit on public pages: no links into the app are rendered. */
  projectId?: string;
  canRun?: boolean;
  visibilityActive?: boolean;
  readOnly?: boolean;
  measuredWith?: React.ReactNode;
}) {
  const issuesById = new Map(r.issues.map((i) => [i.id, i]));
  const quickWins = r.quickWins.map((qid) => issuesById.get(qid)).filter((i): i is NonNullable<typeof i> => !!i);

  return (
    <>
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
        <IssueList issues={r.issues} quickWins={r.quickWins} projectId={readOnly ? undefined : projectId} />
      </section>

      {/* AI visibility */}
      <section aria-labelledby="ai-visibility" className="scroll-mt-24 space-y-4">
        <SectionHeading
          id="ai-visibility"
          title="How AI assistants see you"
          description={
            r.aiVisibility.measured
              ? `Based on ${r.aiVisibility.collected ?? r.aiVisibility.sampleSize} answers${r.aiVisibility.measuredAt ? `, collected ${fmtDate(r.aiVisibility.measuredAt)}` : ""}.`
              : "We ask AI assistants the questions your customers ask, and check whether you come up."
          }
        />
        <AiVisibilitySection
          ai={r.aiVisibility}
          brand={r.brand}
          projectId={readOnly ? undefined : projectId}
          canRun={canRun}
          visibilityActive={visibilityActive}
          readOnly={readOnly}
          measuredWith={r.aiVisibility.measured ? measuredWith : undefined}
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
    </>
  );
}
