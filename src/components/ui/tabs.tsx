"use client";
import { useRef } from "react";
import clsx from "clsx";

export interface TabItem {
  id: string;
  label: React.ReactNode;
  count?: number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

/**
 * Controlled, keyboard-accessible tab list (arrow keys move focus + selection).
 * variant "underline" (default) or "pills" (segmented control look).
 */
export function Tabs({
  tabs,
  value,
  onChange,
  label,
  idPrefix = "tab",
  variant = "underline",
  className,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  idPrefix?: string;
  variant?: "underline" | "pills";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function move(from: number, dir: 1 | -1) {
    for (let step = 1; step <= tabs.length; step++) {
      const j = (from + dir * step + tabs.length) % tabs.length;
      if (!tabs[j].disabled) return j;
    }
    return -1;
  }
  function onKey(e: React.KeyboardEvent, i: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = move(i, 1);
    else if (e.key === "ArrowLeft") next = move(i, -1);
    else if (e.key === "Home") next = move(-1, 1);
    else if (e.key === "End") next = move(0, -1);
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next].id);
      refs.current[next]?.focus();
    }
  }
  const pills = variant === "pills";
  return (
    <div
      role="tablist"
      aria-label={label}
      className={clsx(
        "flex overflow-x-auto",
        pills ? "w-fit max-w-full gap-1 rounded-xl border border-border bg-surface-2 p-1" : "gap-1 border-b border-border",
        className,
      )}
    >
      {tabs.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${idPrefix}-${t.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel`}
            tabIndex={selected ? 0 : -1}
            disabled={t.disabled}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={clsx(
              "flex items-center gap-2 whitespace-nowrap text-small font-medium disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-4",
              pills
                ? clsx(
                    "h-8 rounded-lg px-3",
                    selected ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
                  )
                : clsx(
                    "-mb-px h-10 border-b-2 px-3",
                    selected ? "border-primary text-fg" : "border-transparent text-muted hover:border-border-strong hover:text-fg",
                  ),
            )}
          >
            {t.icon && <span aria-hidden className="contents">{t.icon}</span>}
            {t.label}
            {t.count !== undefined && (
              <span
                className={clsx(
                  "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums leading-5",
                  selected ? "bg-primary text-primary-fg" : "bg-surface-3 text-fg-soft",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  idPrefix = "tab",
  value,
  children,
  className,
}: {
  idPrefix?: string;
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel`}
      aria-labelledby={`${idPrefix}-${value}`}
      tabIndex={0}
      className={clsx("pt-5 focus-visible:outline-offset-4", className)}
    >
      {children}
    </div>
  );
}
