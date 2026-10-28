import clsx from "clsx";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  icon,
  size = "md",
  bordered,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  /** Primary CTA, e.g. <Button>…</Button> or <LinkButton>…</LinkButton>. */
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  icon?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Dashed border box — use when the empty state is not inside a Card. */
  bordered?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "px-4 py-6" : size === "lg" ? "px-6 py-16" : "px-6 py-12",
        bordered && "rounded-2xl border border-dashed border-border-strong bg-surface-2/40",
        className,
      )}
    >
      <div
        className={clsx(
          "mb-4 flex items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-fg ring-8 ring-primary-soft/40",
          size === "sm" ? "size-10 [&_svg]:size-5" : "size-12 [&_svg]:size-6",
        )}
        aria-hidden
      >
        {icon ?? <Inbox />}
      </div>
      <h3 className="text-h4 text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-small text-muted">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
