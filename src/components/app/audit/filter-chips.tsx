"use client";
import clsx from "clsx";

export interface ChipOption {
  value: string;
  label: string;
  count?: number;
}

/** A labelled row of toggle chips (single-select). Buttons expose aria-pressed for screen readers. */
export function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-caption uppercase tracking-[0.06em] text-muted sm:w-20 sm:shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={clsx(
                "focus-ring inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-small font-medium transition-colors",
                on
                  ? "border-primary bg-primary-soft text-primary-soft-fg"
                  : "border-border bg-surface text-fg-soft hover:border-border-strong hover:text-fg",
              )}
            >
              {o.label}
              {o.count !== undefined && (
                <span
                  className={clsx(
                    "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums leading-5",
                    on ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted",
                  )}
                >
                  {o.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
