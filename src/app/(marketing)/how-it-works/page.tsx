import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, webPageLd } from "@/lib/seo/schema";
import { DFY_PLAN, SELF_PLAN, engineNamesLine, freq, num } from "@/components/marketing/plans";
import { SELF_FIX_LINE } from "@/lib/billing/offer";
import { BaselineVignette, FixQueueVignette, ImpactReportVignette } from "@/components/marketing/how-it-works-ui";

export const metadata: Metadata = staticPageMetadata("/how-it-works");

/** "weekly" on Do it myself (from the plan's website-check interval, so the page can't drift from the plan). */
const SITE_CHECK = freq(SELF_PLAN.limits.minScanIntervalDays).toLowerCase();
const AI_CHECKS = SELF_PLAN.ai.checksPerMonth;

/** The three steps. The longer detail (schedules, method, what needs your OK) lives in /docs. */
const STEPS: { title: string; body: string; points: string[]; ui: React.ReactNode }[] = [
  {
    title: "Check",
    body: "We read your website and ask AI assistants the questions your customers ask.",
    points: [
      `A ${SITE_CHECK} check of your website, up to ${num(SELF_PLAN.limits.maxPagesPerCrawl)} pages.`,
      `${engineNamesLine(SELF_PLAN.id)} checked ${AI_CHECKS} times a month.`,
      "One score out of 100, plus your SEO, AEO, GEO and Brand scores.",
    ],
    ui: <BaselineVignette />,
  },
  {
    title: "Fix",
    body: "You get a short to-do list in plain words, most important first.",
    points: [
      `${SELF_PLAN.name}: we show you exactly what to change, and you make the change.`,
      `${SELF_FIX_LINE}.`,
      `${DFY_PLAN.name}: our team makes the changes on your website.`,
    ],
    ui: <FixQueueVignette />,
  },
  {
    title: "Grow",
    body: "We check again and show you what changed, so more customers can find you.",
    points: [
      `Your website is checked again ${SITE_CHECK}, so fixed problems drop off the list.`,
      "A monthly report you can read in 2 minutes.",
      "We show what changed. We never promise a Google position or an AI mention.",
    ],
    ui: <ImpactReportVignette />,
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <JsonLd data={[webPageLd("/how-it-works"), breadcrumbLd([{ name: "How it works", path: "/how-it-works" }])]} />

      {/* ------------------------------------------------------------ Hero: one heading, one button */}
      <section aria-labelledby="hiw-title" className="relative overflow-hidden">
        <div className="container-marketing pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pb-24 lg:pt-24">
          <p className="mk-label mk-rise">How it works</p>
          <h1 id="hiw-title" className="mk-hero mk-rise mt-6 max-w-[16ch] text-fg">
            Three steps to more customers <span className="text-primary">finding you.</span>
          </h1>
          <p className="mk-lead mk-rise mk-delay-1 mt-8 max-w-[36rem] text-fg-soft">
            Check your website, fix what matters most, and see what changed. Start with a free check. It takes about 30
            seconds and needs no sign-up.
          </p>
          <div className="mk-rise mk-delay-2 mt-9">
            <Link href="/free-check" className={inkPill("lg")}>
              Check my website free
              <ArrowRight aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ The three steps */}
      <section id="steps" aria-labelledby="steps-title" className="scroll-mt-20 border-t border-border">
        <div className="container-marketing">
          <h2 id="steps-title" className="sr-only">
            The three steps
          </h2>
          <ol>
            {STEPS.map((s, i) => {
              const flip = i % 2 === 1;
              return (
                <li
                  key={s.title}
                  id={`step-${i + 1}`}
                  className="grid scroll-mt-24 gap-12 border-b border-border py-16 last:border-0 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:py-24"
                >
                  <div className={"mk-reveal min-w-0 lg:col-span-5 " + (flip ? "lg:order-2 lg:col-start-8" : "")}>
                    <span aria-hidden className="mk-outline-num block text-[clamp(5rem,3.5rem+5vw,9rem)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-6 text-[clamp(2rem,1.5rem+1.8vw,3rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-fg">
                      <span className="sr-only">Step {i + 1}: </span>
                      {s.title}
                    </h3>
                    <p className="mk-lead mt-5 max-w-md text-fg-soft">{s.body}</p>
                    <ul className="mt-8 max-w-md border-t border-border">
                      {s.points.map((d) => (
                        <li key={d} className="flex gap-3.5 border-b border-border py-4 text-[1rem] leading-relaxed text-fg-soft">
                          <Check aria-hidden size={18} strokeWidth={2.25} className="mt-1 shrink-0 text-primary" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div
                    className={
                      "mk-reveal min-w-0 lg:col-span-7 lg:self-center " +
                      (flip ? "lg:order-1 lg:col-start-1 lg:col-end-7" : "lg:col-start-6 xl:col-span-6 xl:col-start-7")
                    }
                  >
                    {s.ui}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ Safety line */}
      <section id="safety" aria-labelledby="safety-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-20 sm:py-28">
        <div className="container-marketing grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
          <h2 id="safety-title" className="mk-reveal mk-statement max-w-[14ch] text-fg lg:col-span-7">
            Nothing on your website changes without you.
          </h2>
          <div className="mk-reveal lg:col-span-5">
            <ul className="border-t border-fg">
              <li className="flex gap-3.5 border-b border-border py-5">
                <ShieldCheck aria-hidden size={20} className="mt-0.5 shrink-0 text-primary" />
                <p className="mk-body text-fg-soft">
                  <strong className="font-semibold text-fg">{SELF_PLAN.name}:</strong> {" "}
                  we change nothing on your website. You make each change yourself, with our steps.
                </p>
              </li>
              <li className="flex gap-3.5 border-b border-border py-5">
                <ShieldCheck aria-hidden size={20} className="mt-0.5 shrink-0 text-primary" />
                <p className="mk-body text-fg-soft">
                  <strong className="font-semibold text-fg">{DFY_PLAN.name}:</strong> our team makes the changes, and asks
                  for your OK first.
                </p>
              </li>
            </ul>
            <p className="mt-6 text-small text-muted">
              Want the detail?{" "}
              <Link href="/docs" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                Read how checks, scores and approvals work
              </Link>
              , or{" "}
              <Link href="/pricing" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                compare the two plans
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Final button (the same one) */}
      <section aria-labelledby="final-cta" className="bg-fg text-bg">
        <div className="container-marketing flex flex-col items-start gap-8 py-20 sm:flex-row sm:items-center sm:justify-between sm:py-24">
          <h2 id="final-cta" className="mk-title max-w-[18ch] text-bg">
            Start with step 1. It&apos;s free.
          </h2>
          <Link href="/free-check" className={inkPill("lg", true, "w-full sm:w-auto")}>
            Check my website free
            <ArrowRight aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
