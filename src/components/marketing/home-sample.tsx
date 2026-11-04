// Home page block 2: a static, realistic example of a free-check result. Sample data, labelled as such.
import { ScoreRing } from "@/components/ui";
import { SampleTag } from "./home-ui";

export const SAMPLE_SCORE = 51;

export const SAMPLE_FIXES = [
  { title: "Say what you sell and where, on your homepage", why: "Google and ChatGPT can't tell you deliver in Indiranagar.", points: 9 },
  { title: "Add a Google summary to 6 pages", why: "Google is guessing what to show under your name.", points: 6 },
  { title: "Answer “Do you deliver?” in one clear line", why: "AI assistants look for a short answer they can quote.", points: 5 },
] as const;

export function SampleResult() {
  return (
    <figure aria-label="Sample result of a free website check" className="rounded-[22px] border border-border bg-surface p-5 shadow-xl sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-small font-semibold text-fg">greenleaf-bakery.example</p>
        <SampleTag />
      </div>
      <div className="mt-6 flex items-center gap-5">
        <ScoreRing score={SAMPLE_SCORE} size="md" label="Sample website score" />
        <div className="min-w-0">
          <p className="text-[1.375rem] font-semibold tracking-[-0.02em] text-fg">{SAMPLE_SCORE} / 100 · Needs work</p>
          <p className="mt-1 text-small text-muted">3 fixes could add up to 20 points.</p>
        </div>
      </div>
      <ol className="mt-6 divide-y divide-border border-t border-border">
        {SAMPLE_FIXES.map((f, i) => (
          <li key={f.title} className="flex items-start gap-3 py-4">
            <span aria-hidden className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-fg">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-small font-semibold text-fg">{f.title}</p>
              <p className="mt-0.5 text-xs text-muted">{f.why}</p>
            </div>
            <span className="shrink-0 rounded-full bg-score-good-soft px-2.5 py-1 text-xs font-semibold tabular-nums text-score-good">+{f.points} points</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
