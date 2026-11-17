// Homepage: "See where each AI puts you" — one customer question, five AI answers side by side, with the business's
// place in each answer highlighted (or "not named") and who was picked instead. Visual-first, same calm card style
// as the rest of the homepage. Server component; every word stays in the HTML. Sample data, labelled.
// Labels match what the app really shows: Recommended (top of the AI's list or clearly recommended), Named, Not named.
import clsx from "clsx";
import { SampleTag } from "@/components/marketing/home-ui";

const QUESTION = "Who makes the best eggless cakes in Indiranagar?";
const YOU = "Greenleaf Bakery";

type Status = "recommended" | "named" | "missing";

/** Each AI's answer, in its own order. `you` = index of the sample business in the list (null = not named). */
export const AI_POSITIONS: { engine: string; status: Status; picks: string[]; you: number | null }[] = [
  { engine: "ChatGPT", status: "recommended", picks: [YOU, "Sugar Story", "Bake House"], you: 0 },
  { engine: "Gemini", status: "recommended", picks: ["Sugar Story", YOU, "Cake Corner"], you: 1 },
  { engine: "Perplexity", status: "named", picks: ["Bake House", "Sugar Story", "Cake Corner", YOU], you: 3 },
  { engine: "Claude", status: "missing", picks: ["Sugar Story", "Bake House", "Cake Corner"], you: null },
  { engine: "Grok", status: "missing", picks: ["Cake Corner", "Sugar Story", "Bake House"], you: null },
];

const STATUS: Record<Status, { label: string; cls: string }> = {
  recommended: { label: "Recommended", cls: "bg-score-good-soft text-score-good" },
  named: { label: "Named", cls: "bg-primary-soft text-primary-soft-fg" },
  missing: { label: "Not named", cls: "bg-surface-2 text-muted" },
};

export function AiPositionsSection() {
  return (
    <section id="ai-positions" aria-labelledby="ai-positions-title" className="scroll-mt-20 border-t border-border py-16 sm:py-24">
      <div className="container-marketing">
        <div className="mk-reveal mx-auto max-w-2xl text-center">
          <p className="mk-label">Where you appear</p>
          <h2 id="ai-positions-title" className="mk-title mt-4 text-fg">
            See where each AI puts you.
          </h2>
          <p className="mk-body mx-auto mt-4 max-w-xl text-fg-soft">
            One customer question, every AI’s answer. Are you first, in the list, or missing — and who’s there instead?
          </p>
        </div>

        {/* The question everyone was asked */}
        <div className="mk-reveal mt-10 flex flex-col items-center">
          <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-small font-medium text-fg shadow-card">
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" />
            <span className="truncate">“{QUESTION}”</span>
          </p>
          <span aria-hidden className="h-8 border-l-2 border-dashed border-primary/30" />
        </div>

        {/* Five answers, side by side */}
        {/* Phones: one column. Tablets: 3 on top, 2 centred below (no lonely last card). Laptops: all 5 in a row. */}
        <ul className="grid gap-4 sm:grid-cols-6 lg:grid-cols-5">
          {AI_POSITIONS.map((a, idx) => {
            const s = STATUS[a.status];
            return (
              <li
                key={a.engine}
                className={clsx(
                  "mk-reveal flex flex-col rounded-2xl border bg-surface p-4 shadow-card sm:col-span-2 lg:col-span-1",
                  idx === 3 && "sm:col-start-2 lg:col-start-auto",
                  a.status === "missing" ? "border-border" : "border-primary/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-small font-semibold text-fg">{a.engine}</p>
                  <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", s.cls)}>{s.label}</span>
                </div>
                <ol className="mt-3 space-y-1.5" aria-label={`${a.engine}'s answer`}>
                  {a.picks.map((p, i) => {
                    const mine = i === a.you;
                    return (
                      <li
                        key={p}
                        className={clsx(
                          "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                          mine ? "bg-primary-soft font-semibold text-primary-soft-fg ring-1 ring-primary/30" : "text-fg-soft",
                        )}
                      >
                        <span
                          aria-hidden
                          className={clsx(
                            "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                            mine ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted",
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 truncate">{p}</span>
                        {mine && <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.06em]">You</span>}
                      </li>
                    );
                  })}
                  {a.you === null && (
                    <li className="flex items-center gap-2 rounded-lg border border-dashed border-border-strong px-2 py-1.5 text-xs text-muted">
                      <span aria-hidden className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong text-[10px]">
                        ?
                      </span>
                      {YOU} — not named
                    </li>
                  )}
                </ol>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted">
          <SampleTag />
          <span>Sample answers for a sample bakery. We show your real ones, every week.</span>
        </div>
      </div>
    </section>
  );
}
