import clsx from "clsx";

/**
 * Responsive table. Wraps in a horizontal scroll container.
 * - `stickyHeader`: header stays visible inside a scrolling container (set `maxHeight` or a className height).
 * - `zebra`: alternate row backgrounds. Rows always get a hover tint.
 * - `density`: "comfortable" (default) or "compact".
 */
export function Table({
  className,
  children,
  caption,
  stickyHeader,
  zebra,
  density = "comfortable",
  maxHeight,
  framed,
}: {
  className?: string;
  children: React.ReactNode;
  caption?: string;
  stickyHeader?: boolean;
  zebra?: boolean;
  density?: "comfortable" | "compact";
  /** e.g. "28rem" — enables vertical scrolling (pairs with stickyHeader). */
  maxHeight?: string;
  /** Draw its own rounded border (use when not already inside a Card). */
  framed?: boolean;
}) {
  return (
    <div
      className={clsx(
        "group/table w-full overflow-x-auto",
        maxHeight && "overflow-y-auto",
        framed && "rounded-xl border border-border bg-surface",
        className,
      )}
      style={maxHeight ? { maxHeight } : undefined}
      data-sticky={stickyHeader || undefined}
      data-zebra={zebra || undefined}
      data-density={density}
      tabIndex={maxHeight ? 0 : undefined}
      role={maxHeight ? "region" : undefined}
      aria-label={maxHeight ? caption : undefined}
    >
      <table className="w-full border-collapse text-left text-small">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function THead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <thead
      className={clsx(
        "border-b border-border bg-surface-2 text-caption uppercase tracking-[0.05em] text-muted",
        "group-data-[sticky]/table:sticky group-data-[sticky]/table:top-0 group-data-[sticky]/table:z-10 group-data-[sticky]/table:shadow-[0_1px_0_var(--border)]",
        className,
      )}
    >
      {children}
    </thead>
  );
}

export function TH({
  children,
  className,
  align,
  scope = "col",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  scope?: "col" | "row";
}) {
  return (
    <th
      scope={scope}
      className={clsx(
        "whitespace-nowrap px-4 py-3 font-semibold group-data-[density=compact]/table:py-2",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TR({ children, className, ...rest }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={clsx(
        "border-b border-border transition-colors last:border-0 hover:bg-surface-2/60 group-data-[zebra]/table:even:bg-surface-2/40",
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  className,
  colSpan,
  align,
  numeric,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
  align?: "left" | "right" | "center";
  /** Right-aligned tabular numbers. */
  numeric?: boolean;
}) {
  return (
    <td
      colSpan={colSpan}
      className={clsx(
        "px-4 py-3 align-top text-fg-soft group-data-[density=compact]/table:py-2",
        (align === "right" || numeric) && "text-right",
        align === "center" && "text-center",
        numeric && "tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}
