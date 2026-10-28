import clsx from "clsx";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

export function Stat({
  label,
  value,
  hint,
  footer,
  delta,
  deltaLabel,
  invertDelta,
  icon,
  sparkline,
  size = "md",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  footer?: React.ReactNode;
  /** Numeric change (e.g. +4.2 or -3). Positive = good unless invertDelta. */
  delta?: number | null;
  /** Text after the delta, e.g. "vs last run". Default formats delta with sign. */
  deltaLabel?: React.ReactNode;
  /** Set when a decrease is the good direction (e.g. errors, cost). */
  invertDelta?: boolean;
  icon?: React.ReactNode;
  /** Slot for a tiny chart (e.g. a 80×28 recharts/SVG sparkline). */
  sparkline?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const d = hasDelta ? (delta as number) : 0;
  const good = hasDelta && (invertDelta ? d < 0 : d > 0);
  const bad = hasDelta && (invertDelta ? d > 0 : d < 0);
  const DeltaIcon = d === 0 ? ArrowRight : d > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={clsx("flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-card", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-caption uppercase tracking-[0.06em] text-muted">{label}</div>
        {icon && (
          <span aria-hidden className="text-muted [&_svg]:size-4">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div
          className={clsx(
            "font-semibold tabular-nums tracking-[-0.025em] text-fg",
            size === "sm" ? "text-xl" : size === "lg" ? "text-4xl" : "text-[1.75rem] leading-9",
          )}
        >
          {value}
        </div>
        {sparkline && <div className="h-8 w-24 shrink-0 text-primary">{sparkline}</div>}
      </div>
      {hasDelta && (
        <div
          className={clsx(
            "mt-1.5 inline-flex items-center gap-1 text-xs font-medium tabular-nums",
            good ? "text-success" : bad ? "text-danger" : "text-muted",
          )}
        >
          <DeltaIcon aria-hidden size={14} />
          <span>
            {d > 0 ? "+" : ""}
            {d}
          </span>
          {deltaLabel && <span className="font-normal text-muted">{deltaLabel}</span>}
        </div>
      )}
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
      {footer && <div className="mt-3 border-t border-border pt-3 text-xs text-muted">{footer}</div>}
    </div>
  );
}

export type MeterTone = "auto" | "usage" | "score" | "primary" | "accent" | "success" | "warning" | "danger";

const toneClass: Record<Exclude<MeterTone, "auto" | "usage" | "score">, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/**
 * Horizontal bar. Default tone "usage" (back-compat): accent → warning at 75% → danger at 90%.
 * tone="score": colours by score band of value/max×100 (good ≥80, ok ≥50, poor <50).
 */
export function Meter({
  value,
  max,
  label,
  tone = "usage",
  size = "sm",
  showValue,
  className,
}: {
  value: number;
  max: number;
  label: string;
  tone?: MeterTone;
  size?: "xs" | "sm" | "md";
  /** Render "value / max" text to the right. */
  showValue?: boolean;
  className?: string;
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const pct = ratio * 100;
  let bar: string;
  if (tone === "usage" || tone === "auto") bar = ratio >= 0.9 ? "bg-danger" : ratio >= 0.75 ? "bg-warning" : "bg-accent";
  else if (tone === "score") bar = pct >= 80 ? "bg-score-good" : pct >= 50 ? "bg-score-ok" : "bg-score-poor";
  else bar = toneClass[tone];
  const meter = (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={clsx(
        "w-full overflow-hidden rounded-full bg-score-track",
        size === "xs" ? "h-1" : size === "md" ? "h-2.5" : "h-1.5",
        !showValue && className,
      )}
    >
      <div className={clsx("h-full rounded-full transition-[width] duration-500 ease-out", bar)} style={{ width: `${pct}%` }} />
    </div>
  );
  if (!showValue) return meter;
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      {meter}
      <span className="shrink-0 text-xs tabular-nums text-muted">
        {value}
        <span className="opacity-70"> / {max}</span>
      </span>
    </div>
  );
}
