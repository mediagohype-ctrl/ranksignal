import clsx from "clsx";
import { Check, Minus, X } from "lucide-react";

export type StepStatus = "pending" | "active" | "done" | "error" | "skipped";

export interface ProgressStep {
  id: string;
  label: React.ReactNode;
  /** Short line under the label, e.g. "42 of 120 pages". */
  description?: React.ReactNode;
  status: StepStatus;
}

const STATUS_TEXT: Record<StepStatus, string> = {
  pending: "Not started",
  active: "In progress",
  done: "Complete",
  error: "Failed",
  skipped: "Skipped",
};

function Marker({ status, index }: { status: StepStatus; index: number }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-surface",
        status === "done" && "bg-success text-surface",
        status === "active" && "bg-primary text-primary-fg",
        status === "error" && "bg-danger text-danger-fg",
        status === "pending" && "border border-border-strong bg-surface text-muted",
        status === "skipped" && "bg-surface-3 text-muted",
      )}
    >
      {status === "done" ? (
        <Check size={14} strokeWidth={3} />
      ) : status === "error" ? (
        <X size={14} strokeWidth={3} />
      ) : status === "skipped" ? (
        <Minus size={14} strokeWidth={3} />
      ) : (
        index + 1
      )}
      {status === "active" && <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
    </span>
  );
}

/** Step tracker for long-running jobs (crawl → audit → measure → analyze). */
export function ProgressSteps({
  steps,
  orientation = "vertical",
  label = "Progress",
  className,
}: {
  steps: ProgressStep[];
  orientation?: "vertical" | "horizontal";
  label?: string;
  className?: string;
}) {
  const horizontal = orientation === "horizontal";
  return (
    <ol
      aria-label={label}
      className={clsx(horizontal ? "flex flex-col gap-4 sm:flex-row sm:gap-0" : "flex flex-col", className)}
    >
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const connectorDone = s.status === "done" || s.status === "skipped";
        return (
          <li
            key={s.id}
            aria-current={s.status === "active" ? "step" : undefined}
            className={clsx("relative flex gap-3", horizontal ? "sm:flex-1 sm:flex-col sm:items-start" : !last && "pb-6")}
          >
            {!last && (
              <span
                aria-hidden
                className={clsx(
                  "absolute",
                  horizontal
                    ? "left-[13px] top-7 h-[calc(100%-0.25rem)] w-0.5 sm:left-7 sm:right-0 sm:top-[13px] sm:h-0.5 sm:w-auto"
                    : "left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5",
                  connectorDone ? "bg-success" : "bg-border",
                )}
              />
            )}
            <Marker status={s.status} index={i} />
            <div className={clsx("min-w-0", horizontal ? "pt-1 sm:pr-4 sm:pt-0" : "pt-1")}>
              <div
                className={clsx(
                  "text-small font-medium",
                  s.status === "pending" || s.status === "skipped" ? "text-muted" : "text-fg",
                  s.status === "error" && "text-danger",
                )}
              >
                {s.label}
                <span className="sr-only"> — {STATUS_TEXT[s.status]}</span>
              </div>
              {s.description && <div className="mt-0.5 text-xs text-muted">{s.description}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
