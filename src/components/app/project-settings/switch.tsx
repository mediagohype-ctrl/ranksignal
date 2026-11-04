"use client";
// One on/off row: label + one line of help + a switch. Used by Settings (brief 5.8) and Progress ("Email me monthly").
import clsx from "clsx";
import { Spinner } from "@/components/ui";

export function SwitchRow({
  id,
  label,
  help,
  checked,
  onChange,
  disabled,
  busy,
}: {
  id: string;
  label: string;
  help?: React.ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className={clsx("block text-small font-medium text-fg", !disabled && "cursor-pointer")}>
          {label}
        </label>
        {help && (
          <p id={`${id}-help`} className="text-small text-muted">
            {help}
          </p>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-2">
        {busy && <Spinner size={14} />}
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={help ? `${id}-help` : undefined}
          disabled={disabled || busy}
          onClick={() => onChange(!checked)}
          className={clsx(
            "focus-ring relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
            checked ? "bg-primary" : "bg-score-track",
          )}
        >
          <span className="sr-only">{checked ? "On" : "Off"}</span>
          <span
            aria-hidden
            className={clsx(
              "inline-block size-5 rounded-full bg-surface shadow transition-transform",
              checked ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </span>
    </div>
  );
}
