import { FlaskConical } from "lucide-react";
import { Badge, IssueCard, Meter, ScoreRing } from "@/components/ui";

/*
 * Illustrative sample report built from the real report primitives.
 * Every number here is made up for demonstration — it is not a real customer's result.
 */

export const SAMPLE_PILLARS = [
  { key: "seo", label: "SEO", name: "Search engines", score: 78, hint: "Google can read most pages" },
  { key: "aeo", label: "AEO", name: "Answer engines", score: 54, hint: "Few direct, quotable answers" },
  { key: "geo", label: "GEO", name: "Generative AI", score: 41, hint: "Rarely named in AI answers" },
  { key: "brand", label: "Brand", name: "Brand facts", score: 86, hint: "AI describes you accurately" },
] as const;

const SAMPLE_OVERALL = 65;

/** Compact overview card used in the hero. */
export function SampleReportPeek() {
  return (
    <div className="relative rounded-2xl border border-border/70 bg-surface p-5 text-fg shadow-xl sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-[0.06em] text-muted">AI visibility report</p>
          <p className="mt-0.5 truncate text-h4 text-fg">greenleaf-bakery.example</p>
        </div>
        <Badge tone="warning" icon={<FlaskConical />}>
          Sample report
        </Badge>
      </div>
      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <ScoreRing score={SAMPLE_OVERALL} size="lg" label="Sample overall score" caption="Overall" />
        <ul className="w-full flex-1 space-y-3">
          {SAMPLE_PILLARS.map((p) => (
            <li key={p.key}>
              <p className="mb-1 flex items-baseline justify-between gap-2 text-small">
                <span className="font-semibold text-fg">{p.label}</span>
                <span className="truncate text-xs text-muted">{p.name}</span>
              </p>
              <Meter value={p.score} max={100} label={`Sample ${p.label} score`} tone="score" size="md" showValue />
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-5 rounded-xl bg-surface-2 px-3.5 py-2.5 text-small text-fg-soft">
        <span className="font-semibold text-fg">Top fix:</span> add short, direct answers to the questions customers
        ask most.
      </p>
    </div>
  );
}

/** Full sample: four pillar rings + one plain-English issue. */
export function SampleReport() {
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-h4 text-fg">Your four scores</h3>
          <Badge tone="warning" icon={<FlaskConical />}>
            Sample data
          </Badge>
        </div>
        <p className="mt-1 text-small text-muted">Each score is 0–100. Higher is better.</p>
        <ul className="mt-5 grid grid-cols-2 gap-3">
          {SAMPLE_PILLARS.map((p) => (
            <li key={p.key} className="flex flex-col items-center rounded-xl bg-surface-2 px-2 py-4 text-center">
              <ScoreRing score={p.score} size="md" label={`Sample ${p.label} score`} />
              <p className="mt-2 text-small font-semibold text-fg">{p.label}</p>
              <p className="text-xs text-muted">{p.hint}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="lg:col-span-3">
        <IssueCard
          title="AI assistants can't find a clear answer to “Do you deliver?”"
          pillarLabel="AEO"
          impact="high"
          effort="quick"
          quickWin
          affectedCount={6}
          whatsWrong="Your delivery details are spread across a footer note and a PDF menu. There is no single sentence that plainly says where and when you deliver."
          whyItMatters="When someone asks an AI assistant “which bakery near me delivers?”, it looks for a short, clear statement it can quote. If it can't find one, it may name a competitor instead. Fixing this improves your chances — it can't guarantee a mention."
          howToFix={[
            "Add a “Delivery” question and a one- or two-sentence answer to your home and contact pages.",
            "Say the areas, days and minimum order in plain words, e.g. “We deliver across Indiranagar, Tuesday to Sunday.”",
            "Mark it up as an FAQ so search engines can read it. We can draft this for you to approve.",
          ]}
          evidence="0 of 6 sampled pages contain a direct answer about delivery."
        />
      </div>
    </div>
  );
}
