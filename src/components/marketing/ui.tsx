import type { ReactNode } from "react";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { TRIAL_DAYS } from "./plans";

/** AI engines we measure. Text only — no third-party logos. */
export const ENGINES = ["ChatGPT", "Gemini", "Perplexity", "Google AI Overviews"] as const;

/** Standard marketing section: generous vertical rhythm + max-w-6xl container. */
export function Section({
  id,
  children,
  className,
  labelledBy,
  tone = "bg",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  labelledBy?: string;
  /** Alternate section backgrounds: page (`bg`) or card surface (`surface`). */
  tone?: "bg" | "surface";
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={clsx(
        "scroll-mt-20 py-20 sm:py-24",
        tone === "surface" ? "border-y border-border bg-surface" : "bg-bg",
        className,
      )}
    >
      <div className="container-marketing">{children}</div>
    </section>
  );
}

/** Small pill label for use on navy (`bg-hero`) bands, where the regular `eyebrow` colour lacks contrast. */
export function HeroEyebrow({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-navy-fg/20 bg-navy-fg/10 px-3 py-1 text-caption font-semibold text-navy-fg [&_svg]:size-3.5">
      {icon && (
        <span aria-hidden className="contents">
          {icon}
        </span>
      )}
      {children}
    </p>
  );
}

/** Text-only chips for the AI engines we measure. `onDark` for navy bands. */
export function EngineChips({ onDark, className }: { onDark?: boolean; className?: string }) {
  return (
    <ul className={clsx("flex flex-wrap gap-2", className)} aria-label="AI engines we measure">
      {ENGINES.map((e) => (
        <li
          key={e}
          className={clsx(
            "inline-flex h-8 items-center rounded-full border px-3.5 text-small font-medium",
            onDark ? "border-navy-fg/20 bg-navy-fg/10 text-navy-fg" : "border-border bg-surface text-fg-soft",
          )}
        >
          {e}
        </li>
      ))}
    </ul>
  );
}

/** Hero band for inner marketing pages. Contains the page's single h1. */
export function PageHero({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="bg-hero relative overflow-hidden">
      <div className="container-marketing animate-fade-in py-16 sm:py-20 lg:py-24">
        {eyebrow && <HeroEyebrow>{eyebrow}</HeroEyebrow>}
        <h1 className="mt-5 max-w-3xl text-balance text-h1 text-navy-fg">{title}</h1>
        <div className="mt-5 max-w-2xl text-lead text-navy-fg/80">{intro}</div>
        {children && <div className="mt-8">{children}</div>}
      </div>
    </div>
  );
}

/** Icon in a tinted tile. */
export function IconTile({ children, tone = "primary", className }: { children: ReactNode; tone?: "primary" | "accent"; className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
        tone === "primary" ? "bg-primary-soft text-primary-soft-fg" : "bg-accent-soft text-accent",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Renders schema.org JSON-LD. "<" is escaped so content cannot break out of the script element. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** Closing call-to-action band. */
export function FinalCta({ title, body }: { title: string; body: ReactNode }) {
  return (
    <section aria-labelledby="final-cta" className="bg-bg py-20 sm:py-24">
      <div className="container-marketing">
        <div className="bg-hero relative overflow-hidden rounded-2xl px-6 py-14 text-center shadow-lg sm:px-12 sm:py-20">
          <h2 id="final-cta" className="mx-auto max-w-2xl text-balance text-h2 text-navy-fg">
            {title}
          </h2>
          <div className="mx-auto mt-4 max-w-xl text-lead text-navy-fg/80">{body}</div>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton href="/signup" size="lg" variant="accent" iconRight={<ArrowRight />}>
              Get your free AI visibility report
            </LinkButton>
            <LinkButton href="/pricing" size="lg" variant="secondary">
              View pricing
            </LinkButton>
          </div>
          <p className="mt-5 text-small text-navy-fg/70">
            {TRIAL_DAYS}-day free trial · No guaranteed rankings, just honest measurement.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Long-form readable text (docs, legal). */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "max-w-[68ch] space-y-4 text-body leading-[1.7] text-fg-soft",
        "[&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline",
        "[&_code]:rounded-md [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-fg",
        "[&_h2]:mt-12 [&_h2]:scroll-mt-24 [&_h2]:text-h3 [&_h2]:text-fg [&_h2:first-child]:mt-0",
        "[&_h3]:mt-8 [&_h3]:text-h4 [&_h3]:text-fg",
        "[&_strong]:font-semibold [&_strong]:text-fg",
        "[&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:pl-1 [&_li]:marker:text-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}
