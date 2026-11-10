// Small building blocks for the /features illustrations. Server components only: HTML text + token colours, with
// decorative SVG marked aria-hidden (the same facts are always written next to it as real text).
import type { ReactNode } from "react";
import clsx from "clsx";
import { SampleTag } from "@/components/marketing/home-ui";

/** Card that holds one illustration: title row, the visual, and a one-sentence caption. */
export function VisualFrame({
  label,
  caption,
  sample = true,
  children,
}: {
  label: string;
  caption: string;
  /** Shows the "Sample" tag. Leave on whenever the visual contains example data. */
  sample?: boolean;
  children: ReactNode;
}) {
  return (
    <figure className="flex min-h-[15rem] flex-col rounded-2xl border border-border bg-bg p-4">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <p className="truncate text-xs font-semibold text-fg">{label}</p>
        {sample && <SampleTag />}
      </div>
      <div className="mt-3 flex-1">{children}</div>
      <figcaption className="mt-3 border-t border-border pt-2.5 text-xs leading-snug text-muted">{caption}</figcaption>
    </figure>
  );
}

export type Tone = "good" | "ok" | "poor" | "neutral" | "primary";

const PILL: Record<Tone, string> = {
  good: "bg-score-good-soft text-score-good",
  ok: "bg-score-ok-soft text-score-ok",
  poor: "bg-score-poor-soft text-score-poor",
  neutral: "bg-surface-2 text-fg-soft",
  primary: "bg-primary-soft text-primary-soft-fg",
};

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[11px] font-medium leading-none",
        PILL[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const BAR: Record<Tone, string> = {
  good: "bg-score-good",
  ok: "bg-score-ok",
  poor: "bg-score-poor",
  neutral: "bg-chart-muted",
  primary: "bg-primary",
};

/** Labelled horizontal bar. The value is written as text; the bar itself is decorative. */
export function BarRow({
  label,
  value,
  pct,
  tone = "neutral",
  strong,
}: {
  label: ReactNode;
  value: ReactNode;
  pct: number;
  tone?: Tone;
  strong?: boolean;
}) {
  return (
    <li className="text-xs">
      <div className="flex items-baseline justify-between gap-3">
        <span className={clsx("min-w-0 truncate", strong ? "font-semibold text-fg" : "text-fg-soft")}>{label}</span>
        <span className="shrink-0 tabular-nums text-fg">{value}</span>
      </div>
      <div aria-hidden className="mt-1 h-1.5 rounded-full bg-score-track">
        <div className={clsx("h-full rounded-full", BAR[tone])} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </li>
  );
}

export function scoreTone(score: number): Tone {
  return score >= 75 ? "good" : score >= 50 ? "ok" : "poor";
}

/** Small decorative line chart (aria-hidden). `values` are plotted left to right; `invert` puts low numbers on top. */
export function Sparkline({
  values,
  invert,
  className,
}: {
  values: number[];
  invert?: boolean;
  className?: string;
}) {
  const w = 240;
  const h = 64;
  const pad = 6;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
    const t = (v - min) / span;
    const y = pad + (invert ? t : 1 - t) * (h - pad * 2);
    return [x, y] as const;
  });
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg aria-hidden viewBox={`0 0 ${w} ${h}`} className={clsx("block h-auto w-full", className)}>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={w} y1={h * f} y2={h * f} className="stroke-chart-grid" strokeWidth={1} />
      ))}
      <path d={d} fill="none" className="stroke-chart-1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r={4} className="fill-chart-1" />
    </svg>
  );
}
