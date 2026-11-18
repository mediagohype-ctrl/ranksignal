// URL box that starts a free AI-readiness check. A plain GET form to /free-check?url=…, so it works
// without JavaScript and in server components (homepage hero, CTA bands).
import clsx from "clsx";
import { ArrowRight, Globe } from "lucide-react";

export function FreeCheckLauncher({
  id = "free-check-url",
  onDark,
  variant = "default",
  className,
  buttonLabel = "Check my website free",
  hint = "Free · No sign-up · Takes about 30 seconds",
}: {
  id?: string;
  /** Ink (dark) bands: inverted colours. */
  onDark?: boolean;
  /** "hero": the homepage look — a white card with a globe icon and a bright blue button (works on light and ink). */
  variant?: "default" | "hero";
  className?: string;
  buttonLabel?: string;
  hint?: string | null;
}) {
  const hero = variant === "hero";
  return (
    <form action="/free-check" method="get" role="search" aria-label="Free website check" className={clsx("w-full", className)}>
      <label htmlFor={id} className="sr-only">
        Your website address
      </label>
      {hero ? (
        // Phones: input on top, full-width button below. Wider screens: one row.
        <div className="flex flex-col gap-2 rounded-[20px] bg-white p-2 shadow-[0_18px_44px_rgba(11,27,63,0.12)] focus-within:ring-4 focus-within:ring-mk-accent/20 sm:flex-row sm:items-center sm:p-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3 sm:px-3.5">
            <Globe aria-hidden size={20} className="shrink-0 text-mk-text-soft" />
            <input
              id={id}
              name="url"
              type="text"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="yourwebsite.com"
              required
              maxLength={2048}
              className="h-12 min-w-0 flex-1 bg-transparent text-[1.0625rem] text-mk-ink outline-none placeholder:text-mk-text-soft focus-visible:outline-none sm:h-[58px] sm:text-lg"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-[14px] bg-mk-accent px-6 text-[1.0625rem] font-bold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-accent active:translate-y-px sm:h-[58px] sm:px-7 sm:text-lg [&_svg]:size-[18px]"
          >
            {buttonLabel}
            <ArrowRight aria-hidden />
          </button>
        </div>
      ) : (
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
      )}
      {/* Centred under the box: every place the box is used is a centred hero/band. */}
      {hint && <p className={clsx("mt-3 text-center text-small", onDark ? "text-bg/70" : "text-muted")}>{hint}</p>}
    </form>
  );
}
