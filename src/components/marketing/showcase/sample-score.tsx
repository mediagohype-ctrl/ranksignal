// A sample free-check result (score ring, four area bars, top fixes with "+N points") where every label comes in
// through props, so the Hindi pages can show it in Hindi. Server component. Sample data only — always pass a tag
// that says so ("Sample" / "नमूना").
import clsx from "clsx";
import { scoreBand, SCORE_BAND_CLASS } from "@/components/ui/score";

export interface SampleScoreProps {
  site: string;
  /** "Sample" label, e.g. "नमूना". */
  tag: string;
  score: number;
  /** Accessible sentence for the ring, e.g. "नमूना स्कोर: 100 में से 51". */
  ringLabel: string;
  /** Band word under the number, e.g. "सुधार चाहिए". */
  bandLabel: string;
  headline: string;
  sub: string;
  pillarsTitle: string;
  pillars: { label: string; score: number }[];
  fixes: { title: string; why: string; points: string }[];
  caption: string;
  lang?: string;
}

export function SampleScoreCard(p: SampleScoreProps) {
  const band = scoreBand(p.score);
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <figure lang={p.lang} className="rounded-[22px] border border-border bg-surface p-5 shadow-xl sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <p lang="en" className="min-w-0 truncate text-small font-semibold text-fg">
          {p.site}
        </p>
        <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-border bg-surface px-2.5 text-[11px] font-medium text-muted">
          {p.tag}
        </span>
      </div>

      <div className="mt-6 flex items-center gap-5">
        <div role="img" aria-label={p.ringLabel} className="relative size-[88px] shrink-0">
          <svg viewBox="0 0 88 88" className="size-full -rotate-90" aria-hidden>
            <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" className="stroke-score-track" />
            <circle
              cx="44"
              cy="44"
              r={r}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - p.score / 100)}
              className={SCORE_BAND_CLASS[band].stroke}
            />
          </svg>
          <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="text-2xl font-semibold tabular-nums tracking-[-0.03em] text-fg">{p.score}</span>
            <span className={clsx("mt-1 text-[10px] font-semibold", SCORE_BAND_CLASS[band].text)}>{p.bandLabel}</span>
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[1.25rem] font-semibold tracking-[-0.01em] text-fg">{p.headline}</p>
          <p className="mt-1 text-small text-muted">{p.sub}</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl bg-surface-2/60 p-4">
        <p className="text-xs font-semibold text-fg">{p.pillarsTitle}</p>
        <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {p.pillars.map((x) => (
            <li key={x.label} className="grid grid-cols-[3.25rem_1fr_1.75rem] items-center gap-2 text-xs">
              <span className="font-medium text-fg">{x.label}</span>
              <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-score-track">
                <span className={clsx("block h-full rounded-full", SCORE_BAND_CLASS[scoreBand(x.score)].bg)} style={{ width: `${x.score}%` }} />
              </span>
              <span className="text-right tabular-nums text-fg-soft">{x.score}</span>
            </li>
          ))}
        </ul>
      </div>

      <ol className="mt-4 divide-y divide-border">
        {p.fixes.map((f, i) => (
          <li key={f.title} className="flex items-start gap-3 py-3.5">
            <span aria-hidden className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-fg">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-small font-semibold text-fg">{f.title}</p>
              <p className="mt-0.5 text-xs text-muted">{f.why}</p>
            </div>
            <span className="shrink-0 rounded-full bg-score-good-soft px-2.5 py-1 text-xs font-semibold tabular-nums text-score-good">{f.points}</span>
          </li>
        ))}
      </ol>
      <figcaption className="mt-2 border-t border-border pt-3 text-xs text-muted">{p.caption}</figcaption>
    </figure>
  );
}
