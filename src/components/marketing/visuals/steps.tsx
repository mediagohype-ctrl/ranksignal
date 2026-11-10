// Small decorative illustrations for the Check → Fix → Grow steps. Shapes only (no words), aria-hidden: the step's
// title and text beside each one already say what it shows.
import clsx from "clsx";

const FRAME = "block h-24 w-full rounded-xl border border-border bg-surface shadow-card";

/** Check: a web page being read under a magnifying glass. */
function CheckArt() {
  return (
    <svg viewBox="0 0 240 96" className={FRAME} aria-hidden>
      <rect x="16" y="14" width="132" height="68" rx="6" className="fill-surface-2 stroke-border" />
      <circle cx="26" cy="23" r="2.5" className="fill-chart-muted" />
      <circle cx="34" cy="23" r="2.5" className="fill-chart-muted" />
      <rect x="26" y="36" width="78" height="6" rx="3" className="fill-chart-muted" />
      <rect x="26" y="49" width="104" height="4" rx="2" className="fill-surface-3" />
      <rect x="26" y="59" width="92" height="4" rx="2" className="fill-surface-3" />
      <rect x="26" y="69" width="60" height="4" rx="2" className="fill-surface-3" />
      <circle cx="150" cy="50" r="22" strokeWidth="5" className="fill-primary-soft/60 stroke-primary" />
      <line x1="166" y1="66" x2="184" y2="84" strokeWidth="7" strokeLinecap="round" className="stroke-primary" />
      <circle cx="212" cy="30" r="15" strokeWidth="4" className="fill-none stroke-score-track" />
      <circle cx="212" cy="30" r="15" strokeWidth="4" strokeDasharray="48 94" strokeLinecap="round" transform="rotate(-90 212 30)" className="fill-none stroke-score-ok" />
    </svg>
  );
}

/** Fix: a short to-do list with the first item ticked. */
function FixArt() {
  const rows = [22, 44, 66];
  return (
    <svg viewBox="0 0 240 96" className={FRAME} aria-hidden>
      {rows.map((y, i) => (
        <g key={y}>
          <rect x="20" y={y - 8} width="16" height="16" rx="4" strokeWidth="2" className={i === 0 ? "fill-score-good stroke-score-good" : "fill-surface stroke-border-strong"} />
          {i === 0 && <path d={`M24 ${y} l3.5 3.5 l6 -7`} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary-fg" />}
          <rect x="46" y={y - 3} width={[104, 120, 88][i]} height="6" rx="3" className={i === 0 ? "fill-surface-3" : "fill-chart-muted"} />
          <rect x="184" y={y - 7} width="36" height="14" rx="7" className="fill-score-good-soft" />
          <rect x="192" y={y - 1.5} width="20" height="3" rx="1.5" className="fill-score-good" />
        </g>
      ))}
    </svg>
  );
}

/** Grow: monthly bars climbing, with a trend line. */
function GrowArt() {
  const bars = [26, 34, 40, 52, 60, 72];
  return (
    <svg viewBox="0 0 240 96" className={FRAME} aria-hidden>
      <line x1="16" x2="224" y1="84" y2="84" className="stroke-border" />
      {bars.map((h, i) => (
        <rect key={i} x={24 + i * 34} y={84 - h} width="22" height={h} rx="4" className={i === bars.length - 1 ? "fill-primary" : "fill-primary-soft"} />
      ))}
      <polyline
        points={bars.map((h, i) => `${35 + i * 34},${84 - h - 6}`).join(" ")}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-score-good"
      />
    </svg>
  );
}

const ART = { Check: CheckArt, Fix: FixArt, Grow: GrowArt } as const;

export function StepArt({ step, className }: { step: string; className?: string }) {
  const Art = ART[step as keyof typeof ART];
  if (!Art) return null;
  return (
    <div aria-hidden className={clsx(className)}>
      <Art />
    </div>
  );
}
