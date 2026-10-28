"use client";
import { useEffect, useId, useRef } from "react";
import clsx from "clsx";
import { X } from "lucide-react";

const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

/** Modal dialog: focus moves in on open, Escape/backdrop close, focus trapped, focus restored on close, body scroll locked. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  icon,
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof widths;
  /** Icon shown in a tinted circle beside the title. */
  icon?: React.ReactNode;
  /** "danger" tints the icon tile red — use for destructive confirmations. */
  tone?: "default" | "danger" | "warning";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>("input, textarea, select, button:not([data-close])");
    (first ?? el)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && el) {
        const items = Array.from(
          el.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex='-1'])"),
        );
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 animate-fade-in bg-overlay backdrop-blur-[2px]" aria-hidden onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={clsx(
          "relative flex max-h-[calc(100dvh-2rem)] w-full animate-pop-in flex-col rounded-2xl border border-border bg-surface shadow-xl focus:outline-none",
          widths[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span
                aria-hidden
                className={clsx(
                  "flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5",
                  tone === "danger" ? "bg-danger-soft text-danger" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary-soft-fg",
                )}
              >
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 id={titleId} className="text-h4 text-fg">
                {title}
              </h2>
              {description && (
                <div id={descId} className="mt-1 text-small text-muted">
                  {description}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-2 -mt-1 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <X size={18} />
          </button>
        </div>
        {children && <div className="min-h-0 overflow-y-auto px-6 py-3 text-small text-fg-soft">{children}</div>}
        {footer ? (
          <div className="mt-2 flex flex-wrap justify-end gap-2 rounded-b-2xl border-t border-border bg-surface-2/50 px-6 py-3.5">{footer}</div>
        ) : (
          <div className="h-3" />
        )}
      </div>
    </div>
  );
}
