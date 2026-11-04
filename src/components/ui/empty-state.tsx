import clsx from "clsx";
import { Inbox } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

/** Simple inline pictures for empty states (brief: picture, one sentence, one button). They follow the theme colours. */
export type EmptyPicture = "website" | "chart" | "search" | "list" | "done" | "ai";

function Picture({ kind, className }: { kind: EmptyPicture; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 120 96" className={clsx("text-primary", className)} aria-hidden focusable="false">
      <ellipse cx="60" cy="86" rx="40" ry="5" className="fill-current opacity-10" />
      <rect x="18" y="12" width="84" height="62" rx="10" className="fill-current opacity-[0.08]" />
      <rect x="18" y="12" width="84" height="62" rx="10" {...common} className="opacity-60" />
      {kind === "website" && (
        <g {...common}>
          <path d="M18 26h84" className="opacity-60" />
          <circle cx="27" cy="19" r="1.5" />
          <circle cx="34" cy="19" r="1.5" />
          <path d="M30 40h36M30 50h52M30 60h28" className="opacity-80" />
        </g>
      )}
      {kind === "chart" && (
        <g {...common}>
          <path d="M30 62V50M46 62V40M62 62V46M78 62V30" />
          <path d="M28 64h62" className="opacity-60" />
        </g>
      )}
      {kind === "search" && (
        <g {...common}>
          <circle cx="56" cy="42" r="14" />
          <path d="M66 52l12 12" />
        </g>
      )}
      {kind === "list" && (
        <g {...common}>
          <path d="M32 32h4M44 32h34M32 44h4M44 44h28M32 56h4M44 56h22" />
        </g>
      )}
      {kind === "done" && (
        <g {...common}>
          <circle cx="60" cy="43" r="17" />
          <path d="M52 43l6 6 11-12" />
        </g>
      )}
      {kind === "ai" && (
        <g {...common}>
          <path d="M34 34h40a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H52l-10 8v-8h-8a6 6 0 0 1-6-6V40a6 6 0 0 1 6-6z" />
          <path d="M44 45h.01M54 45h.01M64 45h.01" strokeWidth={5} />
        </g>
      )}
    </svg>
  );
}

/**
 * Empty state. Preferred form (brief): a picture, one sentence and one button —
 * `<EmptyState picture="website" title="No website check yet." actionLabel="Check website" actionHref="/…" />`.
 * The older icon + description + custom action form still works.
 */
export function EmptyState({
  title,
  description,
  action,
  actionLabel,
  actionHref,
  secondaryAction,
  icon,
  picture,
  size = "md",
  bordered,
  className,
}: {
  /** The one sentence. */
  title: string;
  description?: React.ReactNode;
  /** Primary CTA, e.g. <Button>…</Button> or <LinkButton>…</LinkButton>. */
  action?: React.ReactNode;
  /** Shorthand for the one button: a link styled as the primary button (ignored when `action` is given). */
  actionLabel?: string;
  actionHref?: string;
  secondaryAction?: React.ReactNode;
  icon?: React.ReactNode;
  /** Show a small illustration instead of the icon. */
  picture?: EmptyPicture;
  size?: "sm" | "md" | "lg";
  /** Dashed border box — use when the empty state is not inside a Card. */
  bordered?: boolean;
  className?: string;
}) {
  const primary = action ?? (actionLabel && actionHref ? <LinkButton href={actionHref}>{actionLabel}</LinkButton> : null);
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "px-4 py-6" : size === "lg" ? "px-6 py-16" : "px-6 py-12",
        bordered && "rounded-2xl border border-dashed border-border-strong bg-surface-2/40",
        className,
      )}
    >
      {picture ? (
        <Picture kind={picture} className={clsx("mb-4", size === "sm" ? "h-16 w-20" : size === "lg" ? "h-28 w-36" : "h-24 w-30")} />
      ) : (
        <div
          className={clsx(
            "mb-4 flex items-center justify-center rounded-2xl bg-primary-soft text-primary-soft-fg ring-8 ring-primary-soft/40",
            size === "sm" ? "size-10 [&_svg]:size-5" : "size-12 [&_svg]:size-6",
          )}
          aria-hidden
        >
          {icon ?? <Inbox />}
        </div>
      )}
      <h3 className="text-h4 text-fg">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-small text-muted">{description}</p>}
      {(primary || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primary}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
