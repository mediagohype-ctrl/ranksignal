// Server-safe building blocks for the admin back-office (no client JS).
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge, buttonClass, type Tone } from "@/components/ui";
import { qs, type SearchParams } from "@/lib/admin/params";

/* ------------------------------------------------------------------ pagination */

export function Pagination({
  basePath,
  sp,
  page,
  size,
  total,
}: {
  basePath: string;
  sp: SearchParams;
  page: number;
  size: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-small text-muted">
      <span className="tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={`${basePath}${qs(sp, { page: page - 1 })}`} className={buttonClass("secondary", "sm")} rel="prev">
            <ChevronLeft aria-hidden className="size-4" /> Previous
          </Link>
        ) : (
          <span className={clsx(buttonClass("secondary", "sm"), "pointer-events-none opacity-50")} aria-disabled>
            <ChevronLeft aria-hidden className="size-4" /> Previous
          </span>
        )}
        <span className="tabular-nums">
          Page {page} / {pages}
        </span>
        {page < pages ? (
          <Link href={`${basePath}${qs(sp, { page: page + 1 })}`} className={buttonClass("secondary", "sm")} rel="next">
            Next <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : (
          <span className={clsx(buttonClass("secondary", "sm"), "pointer-events-none opacity-50")} aria-disabled>
            Next <ChevronRight aria-hidden className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ link tabs (URL-driven) */

export function LinkTabs({
  tabs,
  active,
  basePath,
  sp,
  param = "tab",
  label,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  basePath: string;
  sp: SearchParams;
  param?: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-border px-1">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id}>
              <Link
                href={`${basePath}${qs({ ...sp, page: undefined }, { [param]: t.id, page: undefined })}`}
                aria-current={on ? "page" : undefined}
                className={clsx(
                  "focus-ring relative -mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-small font-medium transition-colors",
                  on ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg",
                )}
              >
                {t.label}
                {typeof t.count === "number" && (
                  <span className={clsx("rounded-full px-1.5 text-xs tabular-nums", on ? "bg-primary-soft text-primary-soft-fg" : "bg-surface-2 text-muted")}>
                    {t.count.toLocaleString()}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------ range picker */

export function RangePicker({ basePath, sp, active }: { basePath: string; sp: SearchParams; active: string }) {
  return (
    <div role="group" aria-label="Period" className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {["7", "30", "90"].map((r) => (
        <Link
          key={r}
          href={`${basePath}${qs(sp, { range: r })}`}
          aria-current={r === active ? "true" : undefined}
          className={clsx(
            "focus-ring rounded-md px-3 py-1 text-small font-medium tabular-nums transition-colors",
            r === active ? "bg-primary text-primary-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {r}d
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ filter bar (GET form) */

export function FilterBar({ action, children, resetHref }: { action: string; children: React.ReactNode; resetHref?: string }) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-3 border-b border-border px-5 py-4" role="search">
      {children}
      <div className="flex gap-2">
        <button type="submit" className={buttonClass("primary", "sm")}>
          <Search aria-hidden className="size-4" /> Apply
        </button>
        {resetHref && (
          <Link href={resetHref} className={buttonClass("ghost", "sm")}>
            Reset
          </Link>
        )}
      </div>
    </form>
  );
}

const fieldCls =
  "h-9 rounded-lg border border-border bg-surface px-3 text-small text-fg placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30";

export function FilterInput({
  name,
  label,
  defaultValue,
  placeholder,
  type = "text",
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  type?: "text" | "date" | "search";
  className?: string;
}) {
  return (
    <label className={clsx("flex flex-col gap-1", className)}>
      <span className="text-caption uppercase tracking-[0.06em] text-muted">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} className={clsx(fieldCls, type !== "date" && "min-w-48")} />
    </label>
  );
}

export function FilterSelect({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: (string | { value: string; label: string })[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-caption uppercase tracking-[0.06em] text-muted">{label}</span>
      <select name={name} defaultValue={defaultValue ?? ""} className={clsx(fieldCls, "pr-8")}>
        <option value="">All</option>
        {options.map((o) => {
          const v = typeof o === "string" ? { value: o, label: o.replace(/_/g, " ") } : o;
          return (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

/* ------------------------------------------------------------------ JSON viewer */

export function JsonView({ value, label, maxHeight = "24rem", open }: { value: unknown; label: string; maxHeight?: string; open?: boolean }) {
  const empty = value === null || value === undefined;
  let text = "";
  try {
    text = empty ? "null" : JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  return (
    <details className="group rounded-xl border border-border bg-surface-2" open={open}>
      <summary className="focus-ring flex cursor-pointer select-none items-center justify-between gap-2 rounded-xl px-3 py-2 text-small font-medium text-fg">
        <span>{label}</span>
        <span className="text-xs font-normal text-muted">{empty ? "empty" : `${text.length.toLocaleString()} chars`}</span>
      </summary>
      <pre className="overflow-auto border-t border-border px-3 py-2 font-mono text-xs leading-relaxed text-fg-soft" style={{ maxHeight }}>
        {text}
      </pre>
    </details>
  );
}

/* ------------------------------------------------------------------ badges */

const STATUS_TONE: Record<string, Tone> = {
  active: "success",
  trialing: "info",
  past_due: "warning",
  cancelled: "neutral",
  expired: "neutral",
  suspended: "danger",
  new: "info",
  contacted: "primary",
  qualified: "accent",
  converted: "success",
  closed: "neutral",
  draft: "warning",
  reviewed: "info",
  sent: "success",
};

export function StatusPill({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted">—</span>;
  return (
    <Badge tone={STATUS_TONE[status] ?? "neutral"} variant="dot" size="sm" className="capitalize">
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function PlanBadge({ planId }: { planId: string }) {
  const tone: Tone = planId === "trial" ? "warning" : planId === "agency" ? "accent" : "primary";
  return (
    <Badge tone={tone} size="sm" className="capitalize">
      {planId}
    </Badge>
  );
}

export function TierBadge({ tier }: { tier: string | null | undefined }) {
  if (!tier) return <span className="text-xs text-muted">Self-serve</span>;
  return (
    <Badge tone="info" variant="solid" size="sm" className="capitalize">
      {tier}
    </Badge>
  );
}

/** Small "estimated" marker for derived money numbers. */
export function EstimatedTag() {
  return (
    <Badge tone="neutral" variant="outline" size="sm" title="List prices × active customers. Excludes discounts, GST, setup fees and proration.">
      estimated
    </Badge>
  );
}

export function SortHeader({
  label,
  field,
  sort,
  dir,
  basePath,
  sp,
  align,
}: {
  label: string;
  field: string;
  sort: string;
  dir: "asc" | "desc";
  basePath: string;
  sp: SearchParams;
  align?: "right";
}) {
  const on = sort === field;
  const next = on && dir === "desc" ? "asc" : "desc";
  return (
    <Link
      href={`${basePath}${qs(sp, { sort: field, dir: next, page: undefined })}`}
      className={clsx("inline-flex items-center gap-1 hover:text-fg", on && "text-fg", align === "right" && "justify-end")}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <span aria-hidden className="text-[10px]">
        {on ? (dir === "desc" ? "▼" : "▲") : "↕"}
      </span>
    </Link>
  );
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={clsx("font-mono text-xs text-muted", className)}>{children}</span>;
}
