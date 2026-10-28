import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import clsx from "clsx";

/**
 * Up/down change indicator. Direction is shown by arrow + sign (not colour alone).
 * `invert` = lower is better (e.g. open issues). `unit` "pts" for scores, "pp" for rate percentage points.
 */
export function DeltaChip({ delta, unit = "pts", invert = false, className }: { delta: number | null; unit?: "pts" | "pp"; invert?: boolean; className?: string }) {
  if (delta === null) return <span className={clsx("text-caption text-muted", className)}>no comparison</span>;
  const value = unit === "pp" ? Math.round(delta * 1000) / 10 : Math.round(delta);
  if (value === 0) {
    return (
      <span className={clsx("inline-flex items-center gap-0.5 text-caption text-muted tabular-nums", className)}>
        <Minus size={12} aria-hidden /> no change
      </span>
    );
  }
  const good = invert ? value < 0 : value > 0;
  const Icon = value > 0 ? ArrowUp : ArrowDown;
  const label = `${value > 0 ? "+" : "−"}${Math.abs(value)}${unit === "pp" ? " pts" : ""}`;
  return (
    <span
      className={clsx("inline-flex items-center gap-0.5 text-caption font-semibold tabular-nums", good ? "text-success" : "text-danger", className)}
      aria-label={`${value > 0 ? "up" : "down"} ${Math.abs(value)}${unit === "pp" ? " percentage points" : " points"}`}
    >
      <Icon size={12} aria-hidden />
      {label}
    </span>
  );
}
