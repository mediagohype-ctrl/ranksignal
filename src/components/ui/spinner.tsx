import clsx from "clsx";

export function Spinner({ size = 16, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className={clsx("inline-flex items-center gap-2", className)}>
      <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="animate-spin" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label && <span className="text-small text-muted">{label}</span>}
    </span>
  );
}

export function LoadingBlock({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={clsx("flex min-h-40 items-center justify-center text-primary", className)}>
      <Spinner size={22} label={label} />
    </div>
  );
}

/** Shimmering placeholder. Size it with className (e.g. "h-4 w-32"). Decorative: aria-hidden. */
export function Skeleton({ className, rounded = "md" }: { className?: string; rounded?: "sm" | "md" | "lg" | "full" }) {
  return (
    <div
      aria-hidden
      className={clsx(
        "skeleton",
        rounded === "full" ? "rounded-full" : rounded === "lg" ? "rounded-xl" : rounded === "sm" ? "rounded-sm" : "rounded-md",
        className,
      )}
    />
  );
}

/** A few skeleton text lines. Wrap a loading region in role="status" + sr-only text yourself, or use SkeletonCard. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={clsx("space-y-2", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={clsx("h-3.5", i === lines - 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  );
}

/** Card-shaped loading placeholder with an accessible label. */
export function SkeletonCard({ label = "Loading…", lines = 3, className }: { label?: string; lines?: number; className?: string }) {
  return (
    <div role="status" className={clsx("rounded-2xl border border-border bg-surface p-5 shadow-card", className)}>
      <span className="sr-only">{label}</span>
      <Skeleton className="mb-4 h-5 w-2/5" />
      <SkeletonText lines={lines} />
    </div>
  );
}
