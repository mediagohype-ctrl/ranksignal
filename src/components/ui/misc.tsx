import { cloneElement, isValidElement, useId } from "react";
import clsx from "clsx";

/* ---------------------------------------------------------------- SectionHeading */

export function SectionHeading({
  title,
  description,
  eyebrow,
  actions,
  as: Tag = "h2",
  align = "left",
  size = "md",
  id,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  as?: "h2" | "h3";
  /** "center" for marketing sections. */
  align?: "left" | "center";
  /** "lg" = marketing section (text-h2 + lead), "md" = app section (text-h3), "sm" = text-h4. */
  size?: "sm" | "md" | "lg";
  id?: string;
  className?: string;
}) {
  const center = align === "center";
  return (
    <div
      className={clsx(
        "flex flex-wrap gap-4",
        center ? "flex-col items-center text-center" : "items-end justify-between",
        size === "lg" ? "mb-10 sm:mb-12" : size === "sm" ? "mb-3" : "mb-5",
        className,
      )}
    >
      <div className={clsx("min-w-0", center && "max-w-2xl")}>
        {eyebrow && <div className={clsx("eyebrow", size === "lg" ? "mb-3" : "mb-1.5")}>{eyebrow}</div>}
        <Tag id={id} className={clsx("text-fg", size === "lg" ? "text-h2" : size === "sm" ? "text-h4" : "text-h3")}>
          {title}
        </Tag>
        {description && (
          <p className={clsx("text-muted", size === "lg" ? "mt-4 text-lead" : "mt-1 text-small", !center && "max-w-3xl")}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- KeyValue */

export interface KeyValueItem {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
}

/**
 * Definition list. layout "rows" (label left, value right; default), "stacked" (label above value),
 * or "grid" (stacked items in 2–4 columns).
 */
export function KeyValueList({
  items,
  layout = "rows",
  columns = 2,
  className,
}: {
  items: KeyValueItem[];
  layout?: "rows" | "stacked" | "grid";
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  if (layout === "rows") {
    return (
      <dl className={clsx("divide-y divide-border text-small", className)}>
        {items.map((it, i) => (
          <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5 py-2.5">
            <dt className="text-muted">{it.label}</dt>
            <dd className="min-w-0 text-right font-medium text-fg">
              {it.value}
              {it.hint && <div className="text-xs font-normal text-muted">{it.hint}</div>}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <dl
      className={clsx(
        "grid gap-x-6 gap-y-4 text-small",
        layout === "grid" &&
          (columns === 4 ? "grid-cols-2 lg:grid-cols-4" : columns === 3 ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"),
        className,
      )}
    >
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-caption uppercase tracking-[0.06em] text-muted">{it.label}</dt>
          <dd className="mt-1 break-words font-medium text-fg">{it.value}</dd>
          {it.hint && <dd className="mt-0.5 text-xs text-muted">{it.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Alias of KeyValueList. */
export const KeyValue = KeyValueList;

/* ---------------------------------------------------------------- Avatar */

const AVATAR_TONES = [
  "bg-primary-soft text-primary-soft-fg",
  "bg-accent-soft text-accent",
  "bg-info-soft text-info",
  "bg-warning-soft text-warning",
  "bg-success-soft text-success",
  "bg-sev-critical-soft text-sev-critical",
];

export function initials(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  /** Full name or email — used for initials, colour and alt text. */
  name: string;
  src?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const dim = size === "xs" ? "size-6 text-[10px]" : size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-12 text-base" : "size-10 text-sm";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small avatars from arbitrary hosts
      <img src={src} alt={name} className={clsx("shrink-0 rounded-full object-cover ring-2 ring-surface", dim, className)} />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={clsx(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ring-2 ring-surface",
        AVATAR_TONES[h % AVATAR_TONES.length],
        dim,
        className,
      )}
    >
      <span aria-hidden>{initials(name)}</span>
    </span>
  );
}

/* ---------------------------------------------------------------- Tooltip */

/**
 * CSS-only tooltip shown on hover and keyboard focus. The trigger must be focusable
 * (button, link, or pass `focusable` to add tabIndex=0 to the wrapper).
 * The tip is linked via aria-describedby. Keep content short and non-interactive.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  focusable,
  className,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  focusable?: boolean;
  className?: string;
}) {
  const id = useId();
  const trigger =
    isValidElement<{ "aria-describedby"?: string }>(children) && !focusable
      ? cloneElement(children, { "aria-describedby": id })
      : children;
  return (
    <span
      className={clsx("group/tt relative inline-flex", className)}
      aria-describedby={focusable ? id : undefined}
      tabIndex={focusable ? 0 : undefined}
    >
      {trigger}
      <span
        id={id}
        role="tooltip"
        className={clsx(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-64 -translate-x-1/2 rounded-lg bg-fg px-2.5 py-1.5 text-xs font-medium leading-snug text-bg opacity-0 shadow-lg transition-opacity duration-150",
          "group-hover/tt:opacity-100 group-focus-within/tt:opacity-100 group-focus/tt:opacity-100",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {content}
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------- Divider */

export function Divider({
  label,
  orientation = "horizontal",
  className,
}: {
  /** Centered text, e.g. "or". Horizontal only. */
  label?: React.ReactNode;
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  if (orientation === "vertical") {
    return <span role="separator" aria-orientation="vertical" className={clsx("mx-2 inline-block h-5 w-px self-center bg-border", className)} />;
  }
  if (label) {
    return (
      <div role="separator" className={clsx("my-6 flex items-center gap-3 text-xs text-muted", className)}>
        <span className="h-px flex-1 bg-border" />
        <span>{label}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    );
  }
  return <hr className={clsx("my-6 border-0 border-t border-border", className)} />;
}
