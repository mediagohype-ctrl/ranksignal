import clsx from "clsx";

export type ScoreBand = "good" | "ok" | "poor" | "none";
export type GradeLetter = "A" | "B" | "C" | "D" | "F";

/** good ≥ 80, ok 50–79, poor < 50, none = null/undefined/NaN. */
export function scoreBand(score: number | null | undefined): ScoreBand {
  if (score === null || score === undefined || !Number.isFinite(score)) return "none";
  if (score >= 80) return "good";
  if (score >= 50) return "ok";
  return "poor";
}

/** Fallback grade when the data has none: A ≥ 90, B ≥ 80, C ≥ 65, D ≥ 50, F < 50. Prefer the report's own grade. */
export function gradeFromScore(score: number | null | undefined): GradeLetter | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

/** Tailwind classes per band, for custom UI that must match ScoreRing colours. */
export const SCORE_BAND_CLASS: Record<ScoreBand, { text: string; bg: string; soft: string; stroke: string; label: string }> = {
  good: { text: "text-score-good", bg: "bg-score-good", soft: "bg-score-good-soft", stroke: "stroke-score-good", label: "Good" },
  ok: { text: "text-score-ok", bg: "bg-score-ok", soft: "bg-score-ok-soft", stroke: "stroke-score-ok", label: "Needs work" },
  poor: { text: "text-score-poor", bg: "bg-score-poor", soft: "bg-score-poor-soft", stroke: "stroke-score-poor", label: "Poor" },
  none: { text: "text-score-none", bg: "bg-score-none", soft: "bg-surface-2", stroke: "stroke-score-none", label: "Not measured" },
};

const RING = {
  sm: { px: 48, stroke: 5, num: "text-sm", grade: "hidden" },
  md: { px: 88, stroke: 8, num: "text-2xl", grade: "text-[11px]" },
  lg: { px: 140, stroke: 11, num: "text-[2.6rem]", grade: "text-sm" },
} as const;

/**
 * Circular 0–100 score with grade letter, coloured by band.
 * Null score renders a dashed "—" ring ("Not measured").
 */
export function ScoreRing({
  score,
  grade,
  size = "md",
  label = "Score",
  showGrade = true,
  caption,
  className,
}: {
  score: number | null | undefined;
  /** Grade letter to show; defaults to gradeFromScore(score). Pass null to hide. */
  grade?: string | null;
  size?: "sm" | "md" | "lg";
  /** Accessible name, e.g. "SEO score". */
  label?: string;
  showGrade?: boolean;
  /** Text under the ring, e.g. "Overall". */
  caption?: React.ReactNode;
  className?: string;
}) {
  const cfg = RING[size];
  const band = scoreBand(score);
  const value = band === "none" ? 0 : Math.max(0, Math.min(100, Math.round(score as number)));
  const g = grade === undefined ? gradeFromScore(score) : grade;
  const r = (cfg.px - cfg.stroke) / 2;
  const c = 2 * Math.PI * r;
  const aria =
    band === "none"
      ? `${label}: not measured yet`
      : `${label}: ${value} out of 100${g ? `, grade ${g}` : ""} (${SCORE_BAND_CLASS[band].label.toLowerCase()})`;
  return (
    <div className={clsx("inline-flex flex-col items-center gap-2", className)}>
      <div role="img" aria-label={aria} className="relative" style={{ width: cfg.px, height: cfg.px }}>
        <svg width={cfg.px} height={cfg.px} viewBox={`0 0 ${cfg.px} ${cfg.px}`} className="-rotate-90" aria-hidden>
          <circle
            cx={cfg.px / 2}
            cy={cfg.px / 2}
            r={r}
            fill="none"
            strokeWidth={cfg.stroke}
            className="stroke-score-track"
            strokeDasharray={band === "none" ? "3 5" : undefined}
          />
          {band !== "none" && (
            <circle
              cx={cfg.px / 2}
              cy={cfg.px / 2}
              r={r}
              fill="none"
              strokeWidth={cfg.stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - value / 100)}
              className={clsx(SCORE_BAND_CLASS[band].stroke, "transition-[stroke-dashoffset] duration-700 ease-out")}
            />
          )}
        </svg>
        <div aria-hidden className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span className={clsx("font-semibold tabular-nums tracking-[-0.03em] text-fg", cfg.num)}>
            {band === "none" ? "—" : value}
          </span>
          {showGrade && g && band !== "none" && (
            <span className={clsx("mt-1 font-semibold uppercase tracking-wide", cfg.grade, SCORE_BAND_CLASS[band].text)}>
              Grade {g}
            </span>
          )}
        </div>
      </div>
      {caption && <div className="text-caption text-muted">{caption}</div>}
    </div>
  );
}

const GRADE_CLASS: Record<string, string> = {
  A: "bg-score-good-soft text-score-good ring-score-good/25",
  B: "bg-score-good-soft text-score-good ring-score-good/25",
  C: "bg-score-ok-soft text-score-ok ring-score-ok/25",
  D: "bg-sev-high-soft text-sev-high ring-sev-high/25",
  F: "bg-score-poor-soft text-score-poor ring-score-poor/25",
};

/** Letter grade tile A–F. Null grade renders "—" (not measured). */
export function GradeBadge({
  grade,
  size = "md",
  label,
  className,
}: {
  grade: string | null | undefined;
  size?: "sm" | "md" | "lg";
  /** Accessible prefix, e.g. "SEO grade". */
  label?: string;
  className?: string;
}) {
  const g = grade ? grade.toUpperCase() : null;
  return (
    <span
      role="img"
      aria-label={g ? `${label ?? "Grade"} ${g}` : `${label ?? "Grade"}: not measured`}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center font-bold ring-1 ring-inset",
        size === "sm" ? "size-6 rounded-md text-xs" : size === "lg" ? "size-14 rounded-2xl text-3xl" : "size-9 rounded-lg text-base",
        g ? (GRADE_CLASS[g] ?? "bg-surface-2 text-fg-soft ring-border") : "bg-surface-2 text-muted ring-border",
        className,
      )}
    >
      <span aria-hidden>{g ?? "—"}</span>
    </span>
  );
}
