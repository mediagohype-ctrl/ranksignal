// Hindi sections for the /hi pages. The English marketing components hard-code their copy, so these mirror their
// look with Hindi text instead of changing the shared components. Server components only.
import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Check } from "lucide-react";
import { inkPill } from "@/components/marketing/ui";
import { inr, planSignupHref, TRIAL_DAYS } from "@/components/marketing/plans";
import type { HiFaq, HindiPlan, HindiServiceTier } from "./content";

const linkCls = "font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg";

/** Website box that opens the Hindi free check (/hi/free-check?url=…). A plain GET form: works without JavaScript. */
export function HiCheckLauncher({ id = "hi-check-url", className }: { id?: string; className?: string }) {
  return (
    <form action="/hi/free-check" method="get" role="search" aria-label="फ्री वेबसाइट चेक" className={clsx("w-full", className)}>
      <label htmlFor={id} className="sr-only">
        आपकी वेबसाइट का पता
      </label>
      <div className="flex flex-col gap-2 rounded-[28px] border border-border-strong bg-surface p-1.5 shadow-md focus-within:border-fg focus-within:ring-4 focus-within:ring-ring/15 sm:flex-row sm:items-center sm:rounded-full">
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
          lang="en"
          className="h-12 min-w-0 flex-1 rounded-full bg-transparent px-5 text-[1.0625rem] text-fg outline-none placeholder:text-muted focus-visible:outline-none sm:h-14"
        />
        <button
          type="submit"
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-fg px-6 text-[1rem] font-medium text-bg hover:bg-fg-soft focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px sm:h-14 sm:px-7 [&_svg]:size-[18px]"
        >
          मेरी वेबसाइट चेक करें
          <ArrowRight aria-hidden />
        </button>
      </div>
      <p className="mt-3 pl-1 text-small text-muted">फ्री · साइन-अप की ज़रूरत नहीं · करीब 30 सेकंड</p>
    </form>
  );
}

/** Software plan cards (prices and limits from the billing constants). */
export function HiPlanCards({ plans, limit }: { plans: HindiPlan[]; limit?: number }) {
  return (
    <ul className="grid gap-6 md:grid-cols-3">
      {plans.map((p) => (
        <li
          key={p.id}
          className={clsx(
            "mk-reveal flex flex-col rounded-2xl border bg-surface p-6 shadow-card sm:p-8",
            p.featured ? "border-primary ring-1 ring-primary" : "border-border",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-h4 text-fg">{p.name}</h3>
            {p.featured && (
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-soft-fg">सबसे लोकप्रिय</span>
            )}
          </div>
          <p className="mt-4 text-[2.25rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-fg">
            {inr(p.price)}
            {p.suffix}
            <span className="ml-1 text-small font-normal tracking-normal text-muted">/ महीना</span>
          </p>
          <p className="mt-4 text-small text-fg-soft">{p.blurb}</p>
          <ul className="mt-6 flex-1 space-y-3">
            {(limit ? p.highlights.slice(0, limit) : p.highlights).map((h) => (
              <li key={h} className="flex gap-3 text-small text-fg-soft">
                <Check aria-hidden size={16} className="mt-0.5 shrink-0 text-primary" />
                {h}
              </li>
            ))}
          </ul>
          <Link href={planSignupHref(p.id)} className={inkPill("md", false, "mt-8 w-full")}>
            {p.cta}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Done-for-you tier cards. */
export function HiTierCards({ tiers }: { tiers: HindiServiceTier[] }) {
  return (
    <ul className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
      {tiers.map((t) => {
        const ink = !!t.featured;
        return (
          <li key={t.id} className={clsx("mk-reveal relative flex flex-col rounded-[28px] p-7 sm:p-9", ink ? "bg-fg text-bg" : "border border-border bg-surface")}>
            <div className="flex items-center justify-between gap-4">
              <h3 className={clsx("text-[1.75rem] font-semibold leading-none tracking-[-0.03em]", ink ? "text-bg" : "text-fg")}>{t.name}</h3>
              {ink && <span className="inline-flex h-7 items-center rounded-full bg-bg px-3 text-xs font-semibold text-fg">हमारी सलाह</span>}
            </div>
            <p className={clsx("mt-4 text-[1rem] leading-relaxed", ink ? "text-bg/80" : "text-fg-soft")}>{t.blurb}</p>
            <p className="mt-8 flex flex-wrap items-baseline gap-x-2">
              <span className={clsx("text-[clamp(2.25rem,1.9rem+1.2vw,2.875rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums", ink ? "text-bg" : "text-fg")}>
                {inr(t.price)}
              </span>
              <span className={clsx("text-small", ink ? "text-bg/75" : "text-muted")}>हर महीने</span>
            </p>
            <dl className={clsx("mt-4 space-y-1 text-small", ink ? "text-bg/80" : "text-fg-soft")}>
              <div>
                <dt className="sr-only">सेटअप फ़ीस</dt>
                <dd>
                  + <span className="tabular-nums">{inr(t.setup)}</span> एक बार की सेटअप फ़ीस
                </dd>
              </div>
              <div>
                <dt className="sr-only">कम से कम अवधि</dt>
                <dd>
                  कम से कम {t.minimumMonths} महीने
                  {t.termNote ? <span className={ink ? "text-bg/70" : "text-muted"}> · {t.termNote}</span> : null}
                </dd>
              </div>
            </dl>
            <Link href="/hi/contact?topic=services" className={inkPill("lg", ink, "mt-8 w-full")}>
              फ्री स्ट्रैटेजी कॉल बुक करें
              <ArrowRight aria-hidden />
            </Link>
            <div className={clsx("mt-9 flex-1 border-t pt-7", ink ? "border-bg/20" : "border-border")}>
              {t.inherits && <p className={clsx("mb-4 text-small font-semibold", ink ? "text-bg" : "text-fg")}>{t.inherits}</p>}
              <ul className="space-y-3.5">
                {t.includes.map((i) => (
                  <li key={i} className={clsx("flex gap-3 text-[0.9375rem] leading-snug", ink ? "text-bg/85" : "text-fg-soft")}>
                    <Check aria-hidden size={16} className={clsx("mt-0.5 shrink-0", ink ? "text-bg" : "text-primary")} />
                    {i}
                  </li>
                ))}
              </ul>
              <p className={clsx("mt-6 text-small", ink ? "text-bg/70" : "text-muted")}>अपडेट: {t.updates}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** FAQ block: question headings with plain-text answers (the same text goes into FAQPage JSON-LD). */
export function HiFaqSection({ id, title, intro, items }: { id: string; title: string; intro?: ReactNode; items: HiFaq[] }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-border py-20 sm:py-28">
      <div className="container-marketing grid gap-12 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-4">
          <h2 id={`${id}-title`} className="mk-title max-w-[14ch] text-fg">
            {title}
          </h2>
          <div className="mk-body mt-5 max-w-sm text-fg-soft">
            {intro ?? (
              <p>
                कोई और सवाल?{" "}
                <Link href="/hi/contact" className={linkCls}>
                  हमें लिखें
                </Link>
                ।
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-fg lg:col-span-7 lg:col-start-6">
          {items.map((f) => (
            <details key={f.q} className="group border-b border-border">
              <summary className="flex list-none items-start justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
                <h3 className="text-[1.125rem] font-medium leading-snug text-fg sm:text-[1.25rem]">{f.q}</h3>
                <span
                  aria-hidden
                  className="relative mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong text-fg transition-transform duration-200 group-open:rotate-45"
                >
                  <span className="absolute h-px w-3 bg-current" />
                  <span className="absolute h-3 w-px bg-current" />
                </span>
              </summary>
              <p className="mk-body max-w-2xl pb-7 text-fg-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Closing call-to-action band (Hindi version of FinalCta). */
export function HiFinalCta({ title, body }: { title: string; body: ReactNode }) {
  return (
    <section aria-labelledby="hi-final-cta" className="bg-fg text-bg">
      <div className="container-marketing grid gap-10 py-20 sm:py-28 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <h2 id="hi-final-cta" className="mk-statement max-w-[18ch] text-balance text-bg">
            {title}
          </h2>
          <div className="mk-lead mt-6 max-w-xl text-bg/75">{body}</div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:col-span-4 lg:justify-end">
          <Link href="/signup" className={inkPill("lg", true)}>
            फ्री ट्रायल शुरू करें
            <ArrowRight aria-hidden />
          </Link>
          <Link
            href="/hi/pricing"
            className="inline-flex h-14 items-center justify-center rounded-full px-7 text-[1rem] font-medium text-bg ring-1 ring-bg/30 hover:bg-bg/10"
          >
            कीमतें देखें
          </Link>
        </div>
        <p className="text-small text-bg/65 lg:col-span-12">
          {TRIAL_DAYS} दिन का फ्री ट्रायल। हम Google पर कोई जगह पक्की करने का वादा नहीं करते — हम ईमानदारी से मापते हैं।
        </p>
      </div>
    </section>
  );
}

/** Small note for parts of a Hindi page that still appear in English (the free-check results, the contact form). */
export function EnglishNote({ children }: { children: ReactNode }) {
  return <p className="mx-auto mt-4 max-w-2xl rounded-xl bg-surface-2 px-4 py-3 text-small text-fg-soft">{children}</p>;
}
