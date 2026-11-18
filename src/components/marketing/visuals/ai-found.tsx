// Homepage USP: we get your business found inside ChatGPT, Gemini, Claude, Grok and Perplexity.
// Same calm style as the sample result card (white card, thin bars, one "Sample" tag). Server component, all text in
// the HTML. The numbers are an example (labelled), never a promise; which AI tools each plan checks comes from the
// plan limits (engine-names.ts), so the page can't claim more than the app does.
import { Check } from "lucide-react";
import { SampleTag } from "@/components/marketing/home-ui";
import { DFY_ENGINE_COUNT, ENGINE_ORDER, SELF_ENGINE_LIST, listWords } from "@/components/marketing/engine-names";

/** Example only: share of AI answers that named a sample business, at the start and after 3 months. */
export const AI_FOUND_EXAMPLE = [
  { engine: "ChatGPT", before: 4, after: 42 },
  { engine: "Gemini", before: 0, after: 36 },
  { engine: "Perplexity", before: 8, after: 48 },
  { engine: "Claude", before: 0, after: 30 },
  { engine: "Grok", before: 2, after: 26 },
] as const satisfies readonly { engine: (typeof ENGINE_ORDER)[number]; before: number; after: number }[];

const POINTS = [
  "We ask each AI assistant the questions your customers ask, every week.",
  "We show you who it names instead of you, and why.",
  "We fix what stops it naming you — or show you exactly how.",
];

export function AiFoundSection() {
  return (
    <section id="ai-found" aria-labelledby="ai-found-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-16 sm:py-24">
      <div className="container-marketing grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
        <div className="mk-reveal lg:col-span-5">
          <p className="mk-label">What makes us different</p>
          <h2 id="ai-found-title" className="mk-title mt-4 max-w-[18ch] text-fg">
            Found by AI assistants, not just Google.
          </h2>
          <p className="mk-body mt-5 max-w-md text-fg-soft">
            Customers now ask {listWords(ENGINE_ORDER)} who to choose. We help them find and name your business.
          </p>
          <ul className="mt-6 max-w-md space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3 text-small text-fg-soft">
                <Check aria-hidden size={16} className="mt-0.5 shrink-0 text-primary" />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-md text-xs text-muted">
            Do it myself checks {SELF_ENGINE_LIST}. Do it for me checks all {DFY_ENGINE_COUNT}.
          </p>
        </div>

        <div className="mk-reveal min-w-0 lg:col-span-7 lg:col-start-6 xl:col-span-6 xl:col-start-7">
          <figure aria-label="Example: how often AI assistants name a sample business" className="rounded-[22px] border border-border bg-surface p-5 shadow-xl sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-small font-semibold text-fg">How often AI names you</p>
              <SampleTag />
            </div>
            <p className="mt-1 text-xs text-muted">Share of answers that name the business · before → after 3 months</p>

            <ul className="mt-6 space-y-4">
              {AI_FOUND_EXAMPLE.map((r, i) => (
                <li key={r.engine}>
                  <div className="flex items-baseline justify-between gap-3 text-small">
                    <span className="font-medium text-fg">{r.engine}</span>
                    <span className="tabular-nums">
                      <span className="text-muted">{r.before}% → </span>
                      <span className="font-semibold text-fg">{r.after}%</span>
                    </span>
                  </div>
                  <div aria-hidden className="relative mt-2 h-2 overflow-hidden rounded-full bg-score-track">
                    <span
                      className="mk-bar absolute inset-y-0 left-0 rounded-full bg-primary"
                      style={{ width: `${(r.after / 50) * 100}%`, animationDelay: `${i * 80}ms` }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <figcaption className="mt-6 border-t border-border pt-4 text-xs text-muted">
              Example numbers, not a real customer or a promise. Your own numbers come from real AI answers.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
