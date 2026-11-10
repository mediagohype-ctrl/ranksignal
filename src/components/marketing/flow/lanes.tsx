// "What we check" as three labelled lanes: SEO, AEO and GEO, with example checks under each.
// Server component. Example checks are worded like the real checks in the app (src/lib/report/issues.ts).
import clsx from "clsx";
import { Check } from "lucide-react";

type Lane = {
  key: "seo" | "aeo" | "geo";
  label: string;
  name: string;
  where: string;
  body: string;
  checks: string[];
  tone: { text: string; soft: string; bar: string };
};

const LANES: Lane[] = [
  {
    key: "seo",
    label: "SEO",
    name: "Search engine optimisation",
    where: "Found on Google",
    body: "Can Google read your pages and show them in its results?",
    checks: [
      "Pages that can’t show up on Google",
      "Google headlines missing, unclear or too long",
      "Broken links and slow pages",
      "Pages that don’t fit properly on phones",
    ],
    tone: { text: "text-chart-1", soft: "bg-chart-1/10", bar: "bg-chart-1" },
  },
  {
    key: "aeo",
    label: "AEO",
    name: "Answer engine optimisation",
    where: "Quoted in answer boxes and AI Overviews",
    body: "Do your pages give short, clear answers Google can lift straight into an answer?",
    checks: [
      "Do your pages ask the questions customers search for?",
      "A short, direct answer first, not buried",
      "Questions and answers with info for Google and AI",
      "Walls of text that are hard to quote",
    ],
    tone: { text: "text-chart-2", soft: "bg-chart-2/10", bar: "bg-chart-2" },
  },
  {
    key: "geo",
    label: "GEO",
    name: "Generative engine optimisation",
    where: "Named by ChatGPT, Gemini and other AI assistants",
    body: "When people ask AI assistants, do they name you and link to your website?",
    checks: [
      "Are AI assistants allowed to read your site?",
      "Does AI name you, or a competitor instead?",
      "Does AI link to your website?",
      "Wrong things AI says about your business",
    ],
    tone: { text: "text-chart-4", soft: "bg-chart-4/10", bar: "bg-chart-4" },
  },
];

/** Three lanes (SEO / AEO / GEO), each with where it shows up and example checks. */
export function CheckLanes({ className }: { className?: string }) {
  return (
    <figure className={clsx("min-w-0", className)}>
      <ul className="grid gap-4 md:grid-cols-3 lg:gap-5">
        {LANES.map((l) => (
          <li key={l.key} className="mk-reveal flex min-w-0 flex-col overflow-hidden rounded-[22px] border border-border bg-surface">
            <span aria-hidden className={clsx("h-1.5 w-full", l.tone.bar)} />
            <div className="flex items-start gap-4 px-5 pt-5 sm:px-6">
              <span aria-hidden className={clsx("inline-flex size-12 shrink-0 items-center justify-center rounded-2xl", l.tone.soft, l.tone.text)}>
                <LaneGlyph lane={l.key} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[1.25rem] font-semibold leading-tight tracking-[-0.02em] text-fg">
                  <span className={l.tone.text}>{l.label}</span> checks
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {l.name} · {l.where}
                </p>
              </div>
            </div>
            <p className="px-5 pt-4 text-[0.9375rem] leading-relaxed text-fg-soft sm:px-6">{l.body}</p>
            <p className="px-5 pt-5 text-xs font-medium text-muted sm:px-6">Example checks</p>
            <ul className="mt-2 flex-1 px-5 pb-5 sm:px-6">
              {l.checks.map((c) => (
                <li key={c} className="flex gap-2.5 border-t border-border py-3 text-small leading-snug text-fg">
                  <Check aria-hidden size={15} strokeWidth={2.5} className={clsx("mt-0.5 shrink-0", l.tone.text)} />
                  {c}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <figcaption className="mt-5 text-small text-fg-soft">
        The three areas every check belongs to: SEO for Google results, AEO for answer boxes and AI Overviews, GEO for AI
        assistants. A fourth score, Brand, checks your business name, contact details and profiles.
      </figcaption>
    </figure>
  );
}

/** Tiny icon per lane: a results list, an answer box, a chat bubble. */
function LaneGlyph({ lane }: { lane: Lane["key"] }) {
  if (lane === "seo")
    return (
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="10" cy="10" r="5.5" />
        <path d="m14.2 14.2 4.8 4.8" />
        <path d="M7.5 9h5M7.5 11.5h3.5" strokeWidth="1.4" />
      </svg>
    );
  if (lane === "aeo")
    return (
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <path d="M7 9h10M7 12.5h7" />
        <path d="M7 16h4" strokeWidth="1.4" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4 3v-3H6.5a2 2 0 0 1-2-2z" />
      <path d="M12 7.6l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" fill="currentColor" stroke="none" />
    </svg>
  );
}
