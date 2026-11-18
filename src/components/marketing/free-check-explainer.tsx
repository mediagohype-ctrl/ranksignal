// /free-check, before a result is on screen — laid out like /how-it-works: big outlined step numbers, the words on one
// side and a product picture on the other (alternating), a statement section, and a dark closing band.
// Server components; every word is in the HTML. Numbers come from the real limits (MAX_KEY_PAGES, plan helpers) and
// score names from the result screen's own strings; sample pictures carry the "Sample" tag.
import Link from "next/link";
import { ArrowRight, Check, FileText, Globe, Lock, ShieldCheck } from "lucide-react";
import { Meter, ScoreRing } from "@/components/ui";
import { Chip, Panel } from "@/components/marketing/how-it-works-ui";
import { SELF_ENGINE_LIST } from "@/components/marketing/engine-names";
import { SELF_PLAN, TRIAL_DAYS, gstOn, inr, planSignupHref } from "@/components/marketing/plans";
import { inkPill } from "@/components/marketing/ui";
import { MAX_KEY_PAGES } from "@/lib/free-check/run";
import { freeCheckStrings } from "@/lib/free-check/strings";
import { SELF_FIX_LINE } from "@/lib/billing/offer";

const PAGES_READ = MAX_KEY_PAGES + 1; // homepage + main pages
const DOMAIN = "greenleaf-bakery.example";
const NAMES = freeCheckStrings("en").pillarName;

/** The four part scores, named exactly as on the result screen. */
export const FREE_CHECK_SCORES = [
  { name: NAMES.seo, sample: 72 },
  { name: NAMES.aeo, sample: 48 },
  { name: NAMES.geo, sample: 55 },
  { name: NAMES.brand, sample: 66 },
];

/* ------------------------------------------------------------------ pictures */

function TypeVignette() {
  return (
    <Panel title="Free website check" sub="No sign-up · about 30 seconds">
      <div className="px-5 py-7 sm:px-6">
        <div className="flex h-14 items-center gap-2 rounded-full border border-border-strong bg-surface pl-5 pr-1.5 shadow-md">
          <Globe aria-hidden size={18} className="shrink-0 text-muted" />
          <span className="flex-1 truncate text-[1rem] text-fg">{DOMAIN}</span>
          <span className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-fg px-4 text-small font-medium text-bg">
            Check my website free
            <ArrowRight aria-hidden size={15} />
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Chip tone="primary">Free</Chip>
          <Chip>No sign-up</Chip>
          <Chip>No card</Chip>
          <Chip>About 30 seconds</Chip>
        </div>
      </div>
    </Panel>
  );
}

function ReadVignette() {
  const pages = ["/", "/about", "/services", "/contact", "/menu"].slice(0, PAGES_READ);
  return (
    <Panel title="Reading your website" sub={DOMAIN}>
      <ul className="divide-y divide-border">
        {[{ path: "robots.txt and sitemap", kind: "Robot rules" }, ...pages.map((p, i) => ({ path: p, kind: i === 0 ? "Homepage" : "Main page" }))].map((r) => (
          <li key={r.path} className="flex items-center gap-3 px-5 py-3 text-small sm:px-6">
            <FileText aria-hidden size={15} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate font-medium text-fg">{r.path}</span>
            <span className="hidden text-xs text-muted sm:inline">{r.kind}</span>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <Check aria-hidden size={13} strokeWidth={2.5} />
              Read
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-border bg-surface-2/60 px-5 py-3 text-xs text-muted sm:px-6">
        Public pages only, like a search engine. Nothing on your website changes.
      </p>
    </Panel>
  );
}

function ResultVignette() {
  const fixes = [
    { title: "Say what you sell and where, on your homepage", pts: 8 },
    { title: "Add a Google summary to 4 pages", pts: 3 },
    { title: "Let AI robots read your website", pts: 2 },
  ];
  return (
    <Panel title="Your result" sub={DOMAIN}>
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <div className="flex items-center gap-4 border-b border-border px-5 py-5 sm:border-b-0 sm:border-r sm:px-6">
          <ScoreRing score={61} size="md" label="Sample Found Score" />
          <div>
            <p className="text-small font-semibold text-fg">Found Score</p>
            <p className="text-xs text-muted">61 / 100 · Needs work</p>
          </div>
        </div>
        <ul className="space-y-2.5 px-5 py-5 sm:px-6">
          {FREE_CHECK_SCORES.map((s) => (
            <li key={s.name} className="grid grid-cols-[1fr_5rem_1.5rem] items-center gap-2 text-xs">
              <span className="truncate text-fg-soft">{s.name}</span>
              <Meter value={s.sample} max={100} label={`Sample ${s.name}`} tone="score" size="sm" />
              <span className="text-right tabular-nums text-fg-soft">{s.sample}</span>
            </li>
          ))}
        </ul>
      </div>
      <ol className="divide-y divide-border border-t border-border">
        {fixes.map((f, i) => (
          <li key={f.title} className="flex items-center gap-3 px-5 py-3 sm:px-6">
            <span aria-hidden className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-fg">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-small text-fg">{f.title}</span>
            <span className="shrink-0 rounded-full bg-score-good-soft px-2.5 py-1 text-xs font-semibold tabular-nums text-score-good">+{f.pts} points</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/* ------------------------------------------------------------------ 01 · 02 · 03 */

const STEPS: { title: string; body: string; points: string[]; Ui: () => React.ReactNode }[] = [
  {
    title: "Type your website",
    body: "Just your website address. Nothing to install, nothing to connect.",
    points: ["Free, with no sign-up and no card.", "Takes about 30 seconds.", "Works for any website: WordPress, Shopify, Wix, Framer and more."],
    Ui: TypeVignette,
  },
  {
    title: `We read ${PAGES_READ} pages`,
    body: "We read your website the way Google and AI robots do.",
    points: [
      `Your homepage and up to ${MAX_KEY_PAGES} main pages linked from it.`,
      "Your robot rules file (robots.txt) and your sitemap.",
      "Public pages only. We never change anything, and we don't keep the pages we read.",
    ],
    Ui: ReadVignette,
  },
  {
    title: "See your score and top 3 fixes",
    body: "One score out of 100, and the three fixes that help most.",
    points: [
      "Your Found Score, and what it means in plain words.",
      `Four part scores: ${FREE_CHECK_SCORES.map((s) => s.name.split(" · ")[0]).join(", ").replace(/, ([^,]*)$/, " and $1")}.`,
      "Your top 3 fixes, biggest gain first, each with its first steps.",
    ],
    Ui: ResultVignette,
  },
];

export function FreeCheckSteps() {
  return (
    <section id="fc-steps" aria-labelledby="fc-steps-title" className="scroll-mt-20 border-t border-border">
      <div className="container-marketing">
        <h2 id="fc-steps-title" className="sr-only">
          How the free check works
        </h2>
        <ol>
          {STEPS.map((s, i) => {
            const flip = i % 2 === 1;
            return (
              <li key={s.title} className="grid grid-cols-1 gap-12 border-b border-border py-16 last:border-0 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:py-24">
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
                  <s.Ui />
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ free check vs full check (statement) */

export function FreeVsFull() {
  const pages = SELF_PLAN.limits.maxPagesPerCrawl.toLocaleString("en-IN");
  const rows: { label: string; free: string | null; full: string }[] = [
    { label: "Pages read", free: `${PAGES_READ} pages`, full: `Up to ${pages}, every week` },
    { label: "Asks AI assistants about you", free: null, full: `${SELF_ENGINE_LIST}, every week` },
    { label: "Fixes", free: "Your top 3", full: SELF_FIX_LINE },
    { label: "Your score over time", free: null, full: "Score history and a monthly report" },
  ];
  const price = `${inr(SELF_PLAN.price)}/month${gstOn() ? " + GST" : ""}`;
  return (
    <section id="fc-vs" aria-labelledby="fc-vs-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-20 sm:py-28">
      <div className="container-marketing grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
        <div className="mk-reveal lg:col-span-5">
          <h2 id="fc-vs-title" className="mk-statement max-w-[12ch] text-fg">
            A quick look, free. The full check goes deep.
          </h2>
          <Link href={planSignupHref(SELF_PLAN.id)} className={inkPill("lg", false, "mt-10")}>
            Start {TRIAL_DAYS}-day free trial
            <ArrowRight aria-hidden />
          </Link>
          <p className="mt-4 text-small text-muted">No card needed. Then {price}. Cancel any time.</p>
        </div>
        <div className="mk-reveal lg:col-span-7">
          <div className="grid grid-cols-[1fr_1fr] gap-x-4 border-b border-fg pb-3 text-small font-semibold text-fg sm:grid-cols-[11rem_1fr_1fr]">
            <span className="hidden sm:block" />
            <span>Free check</span>
            <span className="text-primary">Full check · {SELF_PLAN.name}</span>
          </div>
          <ul>
            {rows.map((r) => (
              <li key={r.label} className="grid grid-cols-[1fr_1fr] gap-x-4 gap-y-1 border-b border-border py-4 text-small sm:grid-cols-[11rem_1fr_1fr]">
                <span className="col-span-2 font-medium text-fg sm:col-span-1">{r.label}</span>
                {r.free ? (
                  <span className="text-fg-soft">{r.free}</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <Lock aria-hidden size={14} /> Not included
                  </span>
                )}
                <span className="inline-flex items-start gap-1.5 text-fg">
                  <Check aria-hidden size={16} strokeWidth={2.25} className="mt-0.5 shrink-0 text-primary" />
                  {r.full}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex gap-2.5 text-small text-fg-soft">
            <ShieldCheck aria-hidden size={18} className="mt-0.5 shrink-0 text-primary" />
            Both read only public pages. Nothing on your website changes.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ final band (same as /how-it-works) */

export function FreeCheckFinalCta() {
  return (
    <section aria-labelledby="fc-final" className="bg-fg text-bg">
      <div className="container-marketing flex flex-col items-start gap-8 py-20 sm:flex-row sm:items-center sm:justify-between sm:py-24">
        <h2 id="fc-final" className="mk-title max-w-[18ch] text-bg">
          See your score in about 30 seconds.
        </h2>
        <a href="#fc-tool" className={inkPill("lg", true, "w-full sm:w-auto")}>
          Check my website free
          <ArrowRight aria-hidden />
        </a>
      </div>
    </section>
  );
}
