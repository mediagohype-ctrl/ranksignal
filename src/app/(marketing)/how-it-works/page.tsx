import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { RiskBadge } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";
import { HOW_STEPS, RISK_CLASSES } from "@/components/marketing/content";
import { FreeCheckLauncher } from "@/components/marketing/free-check-launcher";
import { MARKETING_PLANS, SERVICE_FROM_PRICE, TRIAL_DAYS, inr, num } from "@/components/marketing/plans";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import {
  BaselineVignette,
  FixQueueVignette,
  ImpactReportVignette,
  ScheduleVignette,
  SetupVignette,
  ShipComposition,
  WorkLogVignette,
} from "@/components/marketing/how-it-works-ui";

export const metadata: Metadata = staticPageMetadata("/how-it-works");

const STEP_DETAILS: string[][] = [
  [
    "Add your website, your business name and the country and language you sell in.",
    "Pick the competitors you want to compare with — you can add more later.",
    "If you like, connect WordPress or GitHub. Connecting never changes your site until you say OK to a change.",
  ],
  [
    "We read your pages gently (following your site's robot rules file) and look for problems that matter to Google and AI.",
    "We ask each AI assistant on your plan your customer questions, so you have a starting point.",
    "You get your scores, how often AI names you and how often it links to you — each with the number of answers behind it.",
  ],
  [
    "Problems become a to-do list, most useful first, each explained in plain words.",
    "Every fix shows why it's there, whether it needs your OK, and a draft ready to review.",
    "Edit drafts freely. Editing cancels any earlier OK, so you always approve exactly what goes live.",
  ],
  [
    "Approve the exact change. We publish it through your connected website, or you copy it in by hand.",
    "We save the page before every change we make, so you can undo it from the change list.",
    "Later checks show what changed afterwards. We report what we saw — we never claim the fix caused it.",
  ],
];

const STEP_UI = [<SetupVignette key="1" />, <BaselineVignette key="2" />, <FixQueueVignette key="3" />, <ShipComposition key="4" />];

/** What happens to each risk class under the default project policy. */
const RISK_DEFAULT: Record<string, string> = {
  A: "Runs on its own. Nothing on your site changes",
  B: "Waits for your OK, unless you let that type of edit go live on its own",
  C: "Always waits for your OK on the exact draft",
  D: "We never make these. Advice only",
};

const REPORT_PARTS = [
  { title: "Scores, before and after", body: "Your overall, SEO, AEO, GEO and Brand scores at the start and end of the month." },
  { title: "Questions won and lost", body: "Which customer questions started or stopped naming you in AI answers, and which competitor is named instead." },
  { title: "Wrong answers caught", body: "Where an AI assistant says something about you that your own site contradicts." },
  { title: "What went live", body: "Every fix that went live, and who did it." },
];

const AUTOMATIC = [
  {
    title: "A weekly website check",
    body: "We read your website again every week, so new problems show up and fixed ones drop off.",
  },
  {
    title: "A monthly AI check",
    body: "Once a month we ask the AI assistants your customer questions again. You can change either schedule, or switch it off, for each website.",
  },
  {
    title: "“Report ready” emails",
    body: "When a website check or AI check is done, Owners and Admins get an email with the main result and a link. Turn them off for each website.",
  },
  {
    title: "Score history you can trust",
    body: "Every result is kept. “Since last time” compares only the questions asked both times, and shows when the question list or our method changed.",
  },
];

const WORK_POINTS = [
  {
    title: "Who did what",
    body: "Every finished task and every change to your site, marked Our team, You or Automated.",
  },
  {
    title: "One click to undo",
    body: "For each change we make on your site, we save the page as it was before, so you can undo it from the change list.",
  },
  {
    title: "Done by hand still counts",
    body: "Made a fix yourself? Mark it done and it counts on your task board and in your monthly report.",
  },
];

const LOOP_INDEX = [...HOW_STEPS.map((s, i) => ({ n: String(i + 1).padStart(2, "0"), title: s.title, href: `#step-${i + 1}` })), {
  n: "05",
  title: "Every month: your report",
  href: "#monthly-report",
}];

function methodFaq(): Qa[] {
  const [starter, , agency] = MARKETING_PLANS;
  return [
    {
      q: "How does the website check read my pages?",
      a: (
        <>
          Like a search engine. We start at your homepage and sitemap, follow your internal links and obey your robots.txt
          rules, as set out in the{" "}
          <SourceLink href="https://datatracker.ietf.org/doc/html/rfc9309">Robots Exclusion Protocol</SourceLink>. Each check
          reads up to {num(starter.limits.maxPagesPerCrawl)} pages on the {starter.name} plan and up to{" "}
          {num(agency.limits.maxPagesPerCrawl)} on {agency.name}.
        </>
      ),
    },
    {
      q: "How are the scores worked out?",
      a: (
        <>
          Every check belongs to one of four areas: SEO, AEO, GEO or Brand. Each area gets a score from 0 to 100 and a letter
          grade, based on how many of your pages pass each check and how much that check matters. A check we could not measure
          is marked as not measured, never guessed.
        </>
      ),
    },
    {
      q: "How do you measure what AI assistants say about me?",
      a: (
        <>
          We ask each AI assistant on your plan your customers&apos; real questions and record whether the answer names you,
          links to you or names a competitor instead. On {starter.name} that is {num(starter.ai.answersPerMonth)} AI answers a
          month; every score shows how many answers it is based on.
        </>
      ),
    },
  ];
}

const linkClass =
  "inline-flex items-center gap-1.5 text-[1rem] font-medium text-fg underline decoration-border-strong underline-offset-[6px] hover:decoration-fg";

export default function HowItWorksPage() {
  const selfServeFrom = Math.min(...MARKETING_PLANS.map((p) => p.price));

  return (
    <>
      {/* FAQPage repeats the visible "Our method" questions and answers word for word. */}
      <JsonLd data={[webPageLd("/how-it-works"), faqLdFromQa(methodFaq()), breadcrumbLd([{ name: "How it works", path: "/how-it-works" }])]} />
      {/* ------------------------------------------------------------ Hero */}
      <section aria-labelledby="hiw-title" className="relative overflow-hidden">
        <div className="container-marketing pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pb-28 lg:pt-24">
          <p className="mk-label mk-rise">How it works</p>
          <h1 id="hiw-title" className="mk-hero mk-rise mt-6 max-w-[11ch] text-fg lg:max-w-none">
            Check. Fix. Grow.
            <br className="hidden lg:block" /> <span className="text-primary">Then again.</span>
          </h1>

          <div className="mt-10 grid gap-14 lg:mt-16 lg:grid-cols-12 lg:gap-10">
            <div className="mk-rise mk-delay-1 min-w-0 lg:col-span-5">
              <p className="mk-lead max-w-[34rem] text-fg-soft">
                {BRAND.name} repeats a simple cycle: check your website and AI answers, fix what matters, publish only
                what you&apos;ve approved, and check again. No magic button.
              </p>
              <div className="mt-9 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-7">
                <Link href="/signup" className={inkPill("lg")}>
                  Start free
                  <ArrowRight aria-hidden />
                </Link>
                <Link href="/free-check" className={linkClass + " self-start sm:self-auto"}>
                  Or try a free check
                  <ArrowRight aria-hidden size={17} />
                </Link>
              </div>
            </div>
            <nav aria-label="The loop, step by step" className="mk-rise mk-delay-2 min-w-0 lg:col-span-6 lg:col-start-7">
              <ol className="border-t border-fg">
                {LOOP_INDEX.map((l) => (
                  <li key={l.href} className="border-b border-border">
                    <a href={l.href} className="group flex items-center gap-5 py-4 sm:gap-8 sm:py-5">
                      <span className="w-6 text-small font-medium tabular-nums text-primary">{l.n}</span>
                      <span className="flex-1 text-[1.125rem] font-medium tracking-[-0.015em] text-fg sm:text-[1.25rem]">{l.title}</span>
                      <ArrowRight aria-hidden size={18} className="shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-fg" />
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ The four steps */}
      <section id="steps" aria-labelledby="steps-title" className="scroll-mt-20 border-t border-border pt-24 sm:pt-32">
        <div className="container-marketing">
          <div className="mk-reveal grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
            <h2 id="steps-title" className="mk-statement max-w-[12ch] text-fg lg:col-span-7">
              Four steps, on repeat.
            </h2>
            <p className="mk-lead max-w-md text-fg-soft lg:col-span-4 lg:col-start-9">
              Each cycle starts with a check and ends with a new one, so you can see what changed.
            </p>
          </div>

          <ol className="mt-12 lg:mt-16">
            {HOW_STEPS.map((s, i) => {
              const flip = i % 2 === 1;
              return (
                <li
                  key={s.title}
                  id={`step-${i + 1}`}
                  className="grid scroll-mt-24 gap-12 border-t border-border py-16 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:py-28"
                >
                  <div className={"mk-reveal min-w-0 lg:col-span-5 " + (flip ? "lg:order-2 lg:col-start-8" : "")}>
                    <span aria-hidden className="mk-outline-num block text-[clamp(5rem,3.5rem+5vw,9rem)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-6 text-[clamp(1.75rem,1.35rem+1.4vw,2.625rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-fg">
                      <span className="sr-only">Step {i + 1}: </span>
                      {s.title}
                    </h3>
                    <p className="mk-body mt-5 max-w-md text-fg-soft">{s.body}</p>
                    <ul className="mt-8 max-w-md border-t border-border">
                      {STEP_DETAILS[i].map((d) => (
                        <li key={d} className="flex gap-3.5 border-b border-border py-4 text-[1rem] leading-relaxed text-fg-soft">
                          <Check aria-hidden size={18} strokeWidth={2.25} className="mt-1 shrink-0 text-primary" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div
                    className={
                      "mk-reveal min-w-0 lg:col-span-7 lg:self-center " + (flip ? "lg:order-1 lg:col-start-1 lg:col-end-7" : "lg:col-start-6 xl:col-start-7 xl:col-span-6")
                    }
                  >
                    {STEP_UI[i]}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ Every month: the impact report */}
      <section id="monthly-report" aria-labelledby="report-title" className="scroll-mt-20 border-y border-border bg-surface-2/50 py-24 sm:py-32">
        <div className="container-marketing grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="mk-reveal min-w-0 lg:col-span-5">
            <span aria-hidden className="mk-outline-num block text-[clamp(5rem,3.5rem+5vw,9rem)]">
              05
            </span>
            <p className="mt-6 text-small font-medium text-primary">Then it repeats, every month</p>
            <h2 id="report-title" className="mk-statement mt-3 max-w-[11ch] text-fg">
              Your monthly report.
            </h2>
            <p className="mk-lead mt-8 max-w-[34rem] text-fg-soft">
              Early each month, last month&apos;s report is emailed to you and opens as a page you can save as a PDF.
              On done-for-you plans, our team checks it before it&apos;s sent.
            </p>
            <dl className="mt-10 max-w-[34rem] border-t border-fg">
              {REPORT_PARTS.map((r) => (
                <div key={r.title} className="border-b border-border py-5">
                  <dt className="text-[1.0625rem] font-semibold tracking-[-0.015em] text-fg">{r.title}</dt>
                  <dd className="mt-1.5 text-[0.9375rem] leading-relaxed text-fg-soft">{r.body}</dd>
                </div>
              ))}
            </dl>
            <p className="mk-body mt-8 max-w-[34rem] text-fg-soft">
              <strong className="font-semibold text-fg">Honest reporting.</strong> The report shows what changed next to
              the work done. It doesn&apos;t claim one caused the other.
            </p>
          </div>
          <div className="mk-reveal min-w-0 lg:col-span-7 lg:col-start-6 lg:mt-40 lg:self-start lg:sticky lg:top-28">
            <ImpactReportVignette />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Runs on its own */}
      <section id="automatic" aria-labelledby="auto-title" className="scroll-mt-20 py-24 sm:py-32">
        <div className="container-marketing grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="mk-reveal min-w-0 lg:col-span-5">
            <h2 id="auto-title" className="mk-title max-w-[12ch] text-fg">
              Runs on its own.
            </h2>
            <p className="mk-body mt-5 max-w-md text-fg-soft">
              Once your website is set up, the checks run on their own. You don&apos;t have to remember.
            </p>
            <div className="mt-10">
              <ScheduleVignette />
            </div>
          </div>
          <ul className="lg:col-span-6 lg:col-start-7 lg:pt-2">
            {AUTOMATIC.map((a) => (
              <li key={a.title} className="mk-reveal grid gap-2 border-t border-border py-7 first:border-fg sm:grid-cols-[14rem_1fr] sm:gap-8">
                <h3 className="text-[1.125rem] font-semibold tracking-[-0.015em] text-fg">{a.title}</h3>
                <p className="mk-body text-fg-soft">{a.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ Work you can see */}
      <section id="work-log" aria-labelledby="work-title" className="scroll-mt-20 border-t border-border py-24 sm:py-32">
        <div className="container-marketing grid gap-14 lg:grid-cols-12 lg:items-center lg:gap-10">
          <div className="mk-reveal min-w-0 lg:order-2 lg:col-span-5 lg:col-start-8">
            <h2 id="work-title" className="mk-title max-w-[12ch] text-fg">
              Work you can see.
            </h2>
            <p className="mk-body mt-5 max-w-md text-fg-soft">
              The task board is a plain record of the work done. It doesn&apos;t claim any Google position or visitor numbers.
            </p>
            <ul className="mt-10 max-w-md border-t border-fg">
              {WORK_POINTS.map((w) => (
                <li key={w.title} className="border-b border-border py-5">
                  <h3 className="text-[1.0625rem] font-semibold tracking-[-0.015em] text-fg">{w.title}</h3>
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-fg-soft">{w.body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="mk-reveal min-w-0 lg:order-1 lg:col-span-6">
            <WorkLogVignette />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Approval policy */}
      <section id="approval-policy" aria-labelledby="risk-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-24 sm:py-32">
        <div className="container-marketing">
          <div className="mk-reveal grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
            <h2 id="risk-title" className="mk-statement max-w-[13ch] text-fg lg:col-span-7">
              Nothing risky happens without your OK.
            </h2>
            <p className="mk-lead max-w-md text-fg-soft lg:col-span-4 lg:col-start-9">
              You choose the rules for each website. By default every change to your website needs your OK, and risky changes are
              never made by us.
            </p>
          </div>

          <div className="mt-16 lg:mt-24">
            <div aria-hidden className="hidden grid-cols-12 gap-10 border-b border-fg pb-3 text-xs font-medium text-muted lg:grid">
              <span className="col-span-3">Type</span>
              <span className="col-span-5">What it covers</span>
              <span className="col-span-4">By default</span>
            </div>
            <dl className="border-t border-fg lg:border-t-0">
              {RISK_CLASSES.map((r) => (
                <div key={r.cls} className="mk-reveal grid gap-3 border-b border-border py-7 lg:grid-cols-12 lg:items-baseline lg:gap-10 lg:py-8">
                  <dt className="flex flex-wrap items-center gap-3 lg:col-span-3 lg:items-start">
                    <RiskBadge riskClass={r.cls} compact className="h-7 px-1.5 [&>span:first-child]:size-5 [&>span:first-child]:text-xs" />
                    <span className="text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-fg">{r.name}</span>
                  </dt>
                  <dd className="mk-body text-fg-soft lg:col-span-5">{r.body}</dd>
                  <dd className="text-[1rem] font-medium leading-relaxed text-fg lg:col-span-4">
                    <span className="text-muted lg:sr-only">By default: </span>
                    {RISK_DEFAULT[r.cls]}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="mk-reveal mt-14 grid gap-6 rounded-[28px] bg-fg p-8 text-bg sm:p-12 lg:grid-cols-12 lg:items-center lg:gap-10">
            <p className="mk-title text-bg lg:col-span-5">One switch stops it all.</p>
            <p className="mk-body text-bg/80 lg:col-span-7">
              We can pause all publishing for your workspace instantly — just ask. Every change is checked again just before it
              runs, so even changes you&apos;ve already approved wait until publishing is switched back on.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Method: how we measure */}
      <QaSection
        id="method"
        eyebrow="Our method"
        title="How we measure your website and AI answers"
        description="The numbers below come from our plan settings, so they match what the app does."
        items={methodFaq()}
      >
        <SourcesList
          title="Public standards our checks follow"
          links={[
            { href: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", label: "Google Search Central: SEO Starter Guide" },
            { href: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data", label: "Google Search Central: introduction to structured data" },
            { href: "https://datatracker.ietf.org/doc/html/rfc9309", label: "IETF RFC 9309: Robots Exclusion Protocol" },
            { href: "https://schema.org/Organization", label: "schema.org: Organization" },
          ]}
        />
      </QaSection>

      {/* ------------------------------------------------------------ Two ways to run the loop */}
      <section id="two-ways" aria-labelledby="ways-title" className="scroll-mt-20 py-24 sm:py-32">
        <div className="container-marketing">
          <h2 id="ways-title" className="mk-reveal mk-title max-w-[16ch] text-fg">
            Do it yourself, or let us do it.
          </h2>
          <div className="mk-reveal mt-12 grid overflow-hidden rounded-[28px] border border-border lg:mt-16 lg:grid-cols-2">
            <div className="flex flex-col p-8 sm:p-12">
              <p className="text-small font-medium text-muted">Do it yourself</p>
              <p className="mt-3 text-[clamp(1.75rem,1.4rem+1.3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-fg">
                From <span className="tabular-nums">{inr(selfServeFrom)}</span> a month.
              </p>
              <p className="mk-body mt-5 max-w-md flex-1 text-fg-soft">
                You use {BRAND.name} yourself: the scores, the to-do list and ready-made fixes to approve. Publish through
                WordPress or GitHub, or make the fixes by hand.
              </p>
              <p className="mt-4 text-small text-muted">Every plan starts with a {TRIAL_DAYS}-day free trial. Plus GST.</p>
              <Link href="/pricing" className={inkPill("lg", false, "mt-9 self-start")}>
                Compare plans
                <ArrowUpRight aria-hidden />
              </Link>
            </div>
            <div className="flex flex-col bg-fg p-8 text-bg sm:p-12">
              <p className="text-small font-medium text-bg/70">Done for you</p>
              <p className="mt-3 text-[clamp(1.75rem,1.4rem+1.3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.04em] text-bg">
                From <span className="tabular-nums">{inr(SERVICE_FROM_PRICE)}</span> a month.
              </p>
              <p className="mk-body mt-5 max-w-md flex-1 text-bg/80">
                Our team does the work with you: we make the fixes you approve each month and walk you through your
                monthly report.
              </p>
              <p className="mt-4 text-small text-bg/70">Plus GST and setup. We promise the work, not a Google position.</p>
              <Link href="/services" className={inkPill("lg", true, "mt-9 self-start")}>
                See done-for-you plans
                <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Final CTA */}
      <section aria-labelledby="final-cta" className="bg-fg text-bg">
        <div className="container-marketing grid gap-12 py-24 sm:py-32 lg:grid-cols-12 lg:items-end lg:gap-10">
          <h2 id="final-cta" className="mk-statement max-w-[13ch] text-bg lg:col-span-7">
            Start with a free website check.
          </h2>
          <div className="lg:col-span-5">
            <p className="mk-lead max-w-md text-bg/75">
              The free check reads your website in about 30 seconds. To ask ChatGPT and Gemini about you, start the
              free trial.
            </p>
            <FreeCheckLauncher id="hiw-cta-url" onDark className="mt-8" />
            <p className="mt-6">
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 text-[1rem] font-medium text-bg underline decoration-bg/40 underline-offset-[6px] hover:decoration-bg"
              >
                Start your {TRIAL_DAYS}-day free trial
                <ArrowRight aria-hidden size={17} />
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
