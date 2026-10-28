// URL box that starts a free AI-readiness check. A plain GET form to /free-check?url=…, so it works
// without JavaScript and in server components (homepage hero, CTA bands).
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { Button, Input } from "@/components/ui";

export function FreeCheckLauncher({
  id = "free-check-url",
  onDark,
  className,
  buttonLabel = "Check my site free",
}: {
  id?: string;
  /** Navy hero bands: light label text. */
  onDark?: boolean;
  className?: string;
  buttonLabel?: string;
}) {
  return (
    <form action="/free-check" method="get" role="search" aria-label="Free AI-readiness check" className={clsx("w-full", className)}>
      <label htmlFor={id} className={clsx("text-small font-medium", onDark ? "text-navy-fg" : "text-fg")}>
        Your website
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          id={id}
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="yourbusiness.com"
          required
          maxLength={2048}
          inputSize="lg"
          className="sm:flex-1"
        />
        <Button type="submit" size="lg" variant="accent" iconRight={<ArrowRight />}>
          {buttonLabel}
        </Button>
      </div>
      <p className={clsx("mt-2 text-xs", onDark ? "text-navy-fg/70" : "text-muted")}>
        Free, no sign-up. We read your homepage and up to 4 key pages — about 20 seconds.
      </p>
    </form>
  );
}

/** Full-width call-to-action band with the URL box. */
export function FreeCheckBand({ id = "free-check-band" }: { id?: string }) {
  return (
    <section aria-labelledby={`${id}-title`} className="bg-bg py-16 sm:py-20">
      <div className="container-marketing">
        <div className="bg-hero relative grid items-center gap-8 overflow-hidden rounded-2xl px-6 py-10 shadow-lg sm:px-10 lg:grid-cols-[1fr_1.1fr] lg:gap-12 lg:py-12">
          <div>
            <h2 id={`${id}-title`} className="text-balance text-h2 text-navy-fg">
              Can AI assistants read your website?
            </h2>
            <p className="mt-3 text-lead text-navy-fg/80">
              Run a free AI-readiness check: SEO, AEO and GEO scores plus your top five fixes, in about 20 seconds.
            </p>
          </div>
          <FreeCheckLauncher id={`${id}-url`} onDark />
        </div>
      </div>
    </section>
  );
}
