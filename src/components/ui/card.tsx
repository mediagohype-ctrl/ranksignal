import Link from "next/link";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";

export type CardVariant = "default" | "elevated" | "outlined" | "interactive" | "subtle" | "brand";
export type CardPadding = "none" | "sm" | "md" | "lg";

const cardVariants: Record<CardVariant, string> = {
  default: "border border-border bg-surface shadow-card",
  elevated: "border border-border/70 bg-surface shadow-lg",
  outlined: "border border-border bg-transparent",
  interactive:
    "border border-border bg-surface shadow-card transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card-hover focus-within:border-border-strong",
  subtle: "border border-transparent bg-surface-2",
  brand: "bg-hero border border-border shadow-card",
};

const cardPadding: Record<CardPadding, string> = { none: "", sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" };

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Built-in padding. Default "none" (use CardHeader/CardBody, or pass padding). */
  padding?: CardPadding;
  /** Render as a different element, e.g. "section" or "article". */
  as?: "div" | "section" | "article" | "li" | "aside";
}

export function Card({ className, children, variant = "default", padding = "none", as = "div", ...rest }: CardProps) {
  // Element type is a runtime choice; props are typed as div attributes for simplicity.
  const Tag = as as "div";
  return (
    <Tag className={clsx("relative rounded-2xl", cardVariants[variant], cardPadding[padding], className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  icon,
  eyebrow,
  divider = true,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small icon shown in a tinted tile left of the title. */
  icon?: React.ReactNode;
  eyebrow?: React.ReactNode;
  /** Bottom border between header and body (default true). */
  divider?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-6",
        divider && "border-b border-border",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <span
            aria-hidden
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg [&_svg]:size-[18px]"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h2 className="text-h4 text-fg">{title}</h2>
          {description && <p className="mt-0.5 text-small text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx("px-5 py-4 sm:px-6 sm:py-5", className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "flex flex-wrap items-center justify-end gap-2 rounded-b-2xl border-t border-border bg-surface-2/50 px-5 py-3 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface Crumb {
  label: React.ReactNode;
  href?: string;
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (!items.length) return null;
  return (
    <nav aria-label="Breadcrumb" className={clsx("text-small text-muted", className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="rounded hover:text-fg hover:underline underline-offset-4">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={clsx(last && "text-fg-soft")}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight aria-hidden size={14} className="opacity-60" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  eyebrow,
  meta,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Crumb[];
  /** Small uppercase label above the title. */
  eyebrow?: React.ReactNode;
  /** Row under the description, e.g. badges or "Last crawled 2h ago". */
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={clsx("mb-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} className="no-print mb-3" />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          {icon && (
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg [&_svg]:size-5"
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
            <h1 className="text-h1 text-fg">{title}</h1>
            {description && <p className="mt-2 max-w-3xl text-body text-muted">{description}</p>}
            {meta && <div className="mt-3 flex flex-wrap items-center gap-2 text-small text-muted">{meta}</div>}
          </div>
        </div>
        {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
