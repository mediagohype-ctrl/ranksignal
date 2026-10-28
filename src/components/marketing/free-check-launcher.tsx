// URL box that starts a free AI-readiness check. A plain GET form to /free-check?url=…, so it works
// without JavaScript and in server components (homepage hero, CTA bands).
import clsx from "clsx";
import { ArrowRight } from "lucide-react";

export function FreeCheckLauncher({
  id = "free-check-url",
  onDark,
  className,
  buttonLabel = "Check my site",
  hint = "Free · No card · Results in about a minute",
}: {
  id?: string;
  /** Ink (dark) bands: inverted colours. */
  onDark?: boolean;
  className?: string;
  buttonLabel?: string;
  hint?: string | null;
}) {
  return (
    <form action="/free-check" method="get" role="search" aria-label="Free AI-readiness check" className={clsx("w-full", className)}>
      <label htmlFor={id} className="sr-only">
        Your website address
      </label>
      <div
        className={clsx(
          "flex flex-col gap-2 rounded-[28px] p-1.5 sm:flex-row sm:items-center sm:rounded-full",
          "focus-within:ring-4",
          onDark
            ? "bg-bg/10 ring-1 ring-bg/20 focus-within:ring-bg/30"
            : "border border-border-strong bg-surface shadow-md focus-within:border-fg focus-within:ring-ring/15",
        )}
      >
        <input
          id={id}
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="yourbusiness.com"
          required
          maxLength={2048}
          className={clsx(
            "h-12 min-w-0 flex-1 rounded-full bg-transparent px-5 text-[1.0625rem] outline-none sm:h-14",
            "focus-visible:outline-none",
            onDark ? "text-bg placeholder:text-bg/60" : "text-fg placeholder:text-muted",
          )}
        />
        <button
          type="submit"
          className={clsx(
            "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-[1rem] font-medium sm:h-14 sm:px-7",
            "focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px [&_svg]:size-[18px]",
            onDark ? "bg-bg text-fg hover:bg-surface-3 focus-visible:outline-bg" : "bg-fg text-bg hover:bg-fg-soft",
          )}
        >
          {buttonLabel}
          <ArrowRight aria-hidden />
        </button>
      </div>
      {hint && <p className={clsx("mt-3 pl-1 text-small", onDark ? "text-bg/70" : "text-muted")}>{hint}</p>}
    </form>
  );
}
