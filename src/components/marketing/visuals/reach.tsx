// Shared marketing visual: the three places a customer finds a business — Google results (SEO), the answer box /
// AI Overview (AEO) and an AI assistant's reply (GEO). Server component, HTML + inline SVG only, so every word stays
// readable by search engines and AI crawlers. All names, sites and answers are sample data and labelled as such.
import clsx from "clsx";
import { ArrowDown, ArrowRight, Link2, Search, Sparkles } from "lucide-react";
import { SampleTag } from "@/components/marketing/home-ui";

type HeadingTag = "h3" | "h4" | "p";

const QUERY = "eggless birthday cake indiranagar";
const BUSINESS = "Greenleaf Bakery";
const SITE = "greenleaf-bakery.example";

const STEPS = [
  {
    key: "seo",
    term: "SEO",
    termName: "Search engines",
    title: "Found on Google",
    line: "Your page shows up in the normal search results, with a clear title and summary.",
  },
  {
    key: "aeo",
    term: "AEO",
    termName: "Answer engines",
    title: "Quoted in the answer box",
    line: "Google's answer box or AI Overview quotes your short, direct answer at the top.",
  },
  {
    key: "geo",
    term: "GEO",
    termName: "Generative AI",
    title: "Named by ChatGPT and Gemini",
    line: "AI assistants recommend your business by name and link to your website.",
  },
] as const;

/* ------------------------------------------------------------------ mocks (sample data, real HTML text) */

function SearchResultsMock() {
  const others = [
    { site: "bangalore-eats.example", title: "10 best cake shops in Bengaluru", w: "w-[82%]" },
    { site: "cake-directory.example", title: "Cake delivery near you", w: "w-[68%]" },
  ];
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <Search aria-hidden size={12} />
        Google · Search results
      </p>
      <div className="mt-2.5 rounded-lg bg-primary-soft/70 p-2.5 ring-1 ring-primary/25">
        <p className="truncate text-[11px] text-fg-soft">{SITE}</p>
        <p className="mt-0.5 text-[13px] font-semibold leading-snug text-primary">
          {BUSINESS} · Eggless cakes in Indiranagar
        </p>
        <p className="mt-1 text-[11px] leading-snug text-fg-soft">Custom and eggless cakes, same-day delivery. Order by 2 pm.</p>
      </div>
      <ul className="mt-2 space-y-2 px-1">
        {others.map((o) => (
          <li key={o.site}>
            <p className="truncate text-[11px] text-muted">{o.site}</p>
            <p className="truncate text-[12px] font-medium text-fg-soft">{o.title}</p>
            <span aria-hidden className={clsx("mt-1 block h-1.5 rounded-full bg-surface-3", o.w)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnswerBoxMock() {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <Sparkles aria-hidden size={12} className="text-chart-4" />
        AI Overview · Answer box
      </p>
      <div className="mt-2.5 rounded-lg border border-chart-4/25 bg-surface-2 p-2.5">
        <p className="text-[12px] leading-snug text-fg">
          <span className="font-semibold">Yes.</span>{" "}
          <mark className="rounded bg-primary-soft px-0.5 font-semibold text-primary-soft-fg">{BUSINESS}</mark> bakes
          eggless birthday cakes and delivers the same day across Indiranagar if you order by 2 pm.
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          Source
          <span className="inline-flex h-5 items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 font-medium text-primary-soft-fg">
            <Link2 aria-hidden size={10} />
            {SITE}
          </span>
        </p>
      </div>
      <div aria-hidden className="mt-2.5 space-y-1.5 px-1">
        <span className="block h-1.5 w-[88%] rounded-full bg-surface-3" />
        <span className="block h-1.5 w-[64%] rounded-full bg-surface-3" />
      </div>
    </div>
  );
}

function AssistantChatMock() {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <span aria-hidden className="size-1.5 rounded-full bg-chart-2" />
        ChatGPT · Gemini · Perplexity
      </p>
      <p className="mt-2.5 ml-auto max-w-[88%] rounded-xl rounded-tr-sm bg-surface-3 px-2.5 py-1.5 text-[12px] leading-snug text-fg">
        Where can I get an eggless cake delivered today?
      </p>
      <div className="mt-2 max-w-[94%] rounded-xl rounded-tl-sm border border-border bg-surface-2 px-2.5 py-2">
        <p className="text-[12px] leading-snug text-fg-soft">
          Try <strong className="font-semibold text-fg">{BUSINESS}</strong> in Indiranagar. They make eggless cakes to
          order and deliver the same day.
        </p>
        <span className="mt-1.5 inline-flex h-5 items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 text-[11px] font-medium text-primary-soft-fg">
          <Link2 aria-hidden size={10} />
          {SITE}
        </span>
      </div>
    </div>
  );
}

const MOCKS = { seo: SearchResultsMock, aeo: AnswerBoxMock, geo: AssistantChatMock } as const;

/* ------------------------------------------------------------------ visual */

/**
 * The customer's journey in four beats: they search, then find the business on Google (SEO), in the answer box
 * (AEO) and in AI assistants (GEO). Stacks on phones with down arrows; a connecting line with arrows on desktop.
 * `headingAs` sets the tag for the three step titles (default h3, for use under a section's h2).
 */
export function ReachVisual({ headingAs = "h3", className }: { headingAs?: HeadingTag; className?: string }) {
  const Heading = headingAs;
  return (
    <figure className={clsx("relative", className)}>
      {/* Beat 0: the customer searches */}
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="flex items-center gap-2">
          <p className="text-small font-medium text-fg">Your customer searches</p>
          <SampleTag />
        </div>
        <div className="mt-3 flex h-12 w-full items-center gap-3 rounded-full border border-border-strong bg-surface px-4 shadow-card sm:px-5">
          <Search aria-hidden size={18} className="shrink-0 text-muted" />
          <p className="min-w-0 flex-1 truncate text-left text-[0.9375rem] text-fg">
            <span className="sr-only">Search: </span>
            {QUERY}
          </p>
          <span aria-hidden className="h-5 w-px animate-pulse bg-primary motion-reduce:animate-none" />
        </div>
        <ArrowDown aria-hidden size={20} className="my-3 text-primary/60 lg:hidden" />
      </div>
      {/* Desktop: the search flows down into step 1, then along the line to steps 2 and 3. x=100/300 of 600 are
          the centres of the first and middle grid columns. */}
      <svg aria-hidden viewBox="0 0 600 44" preserveAspectRatio="none" className="mt-1 hidden h-11 w-full text-primary/45 lg:block">
        <path
          d="M300 0 V10 C300 30 100 18 100 44"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="5 5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Beats 1-3 */}
      <ol className="relative grid gap-3 lg:mt-1 lg:grid-cols-3 lg:gap-8">
        {/* Desktop connecting line behind the numbered badges */}
        <span aria-hidden className="absolute left-[16.67%] right-[16.67%] top-5 hidden border-t-2 border-dashed border-primary/35 lg:block" />
        {STEPS.map((s, i) => {
          const Mock = MOCKS[s.key];
          const last = i === STEPS.length - 1;
          return (
            <li key={s.key} className="relative flex flex-col">
              <div className="flex flex-col items-center text-center">
                <span className="relative z-10 inline-flex h-10 items-center gap-2 rounded-full border border-primary/30 bg-surface px-4 text-small font-semibold text-primary shadow-card">
                  <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-fg">
                    {i + 1}
                  </span>
                  {s.term}
                  <span className="font-normal text-muted">· {s.termName}</span>
                </span>
              </div>
              {!last && (
                <ArrowRight
                  aria-hidden
                  size={18}
                  className="absolute -right-[1.5625rem] top-[0.6875rem] z-10 hidden rounded-full bg-surface text-primary lg:block"
                />
              )}
              <div className="mt-4 flex flex-1 flex-col rounded-[20px] border border-border bg-surface-2/60 p-4 shadow-card sm:p-5">
                <Heading className="text-[1.0625rem] font-semibold tracking-[-0.01em] text-fg">{s.title}</Heading>
                <p className="mt-1.5 text-small leading-snug text-fg-soft">{s.line}</p>
                <div className="mt-4 lg:mt-auto lg:pt-4">
                  <Mock />
                </div>
              </div>
              {!last && <ArrowDown aria-hidden size={20} className="mx-auto mt-3 text-primary/60 lg:hidden" />}
            </li>
          );
        })}
      </ol>

      <figcaption className="mt-6 text-center text-small text-muted">
        One search, three places to be found: Google results (SEO), the answer box or AI Overview (AEO), and AI
        assistants like ChatGPT and Gemini (GEO). Sample business and answers.
      </figcaption>
    </figure>
  );
}
