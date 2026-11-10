// Pricing visuals: the main plan limits as meters, and "what every plan includes".
// Server components. Every number comes from MARKETING_PLANS (which reads @/lib/billing/plans),
// so the bars always match what the app enforces. Bars are aria-hidden; the number next to each is text.
import clsx from "clsx";
import { BadgeCheck, CalendarClock, History, LineChart, ShieldCheck, Sparkles, Users } from "lucide-react";
import { MARKETING_PLANS, num } from "../plans";

type Metric = { key: string; label: string; hint: string; value: (p: (typeof MARKETING_PLANS)[number]) => number; units?: boolean };

const METRICS: Metric[] = [
  { key: "sites", label: "Websites", hint: "How many websites you can look after", value: (p) => p.limits.maxProjects, units: true },
  { key: "pages", label: "Pages per website check", hint: "How many pages we read each time", value: (p) => p.limits.maxPagesPerCrawl },
  { key: "answers", label: "AI answers per month", hint: "One question asked to one AI assistant", value: (p) => p.ai.answersPerMonth },
];

/** Websites as squares, pages and AI answers as bars, one row per plan. */
export function PlanMeters({ className }: { className?: string }) {
  return (
    <figure className={clsx("min-w-0 rounded-[22px] border border-border bg-surface p-5 sm:p-8", className)}>
      <div className="grid gap-8 md:grid-cols-3 md:gap-8 lg:gap-10">
        {METRICS.map((m) => {
          const max = Math.max(...MARKETING_PLANS.map(m.value));
          return (
            <div key={m.key} className="min-w-0">
              <p className="text-[1.0625rem] font-semibold tracking-[-0.015em] text-fg">{m.label}</p>
              <p className="mt-0.5 text-xs text-muted">{m.hint}</p>
              <dl className="mt-4 space-y-3.5">
                {MARKETING_PLANS.map((p) => {
                  const v = m.value(p);
                  return (
                    <div key={p.id} className="min-w-0">
                      <div className="flex items-baseline justify-between gap-3 text-small">
                        <dt className={clsx("font-medium", p.featured ? "text-fg" : "text-fg-soft")}>{p.name}</dt>
                        <dd className="font-semibold tabular-nums text-fg">
                          {num(v)}
                          {p.suffix}
                        </dd>
                      </div>
                      {m.units ? (
                        <span aria-hidden className="mt-1.5 flex h-3 flex-wrap gap-1 overflow-hidden">
                          {Array.from({ length: Math.min(v, 30) }, (_, i) => (
                            <span key={i} className={clsx("size-3 rounded-[3px]", p.featured ? "bg-primary" : "bg-primary/35")} />
                          ))}
                        </span>
                      ) : (
                        <span aria-hidden className="mt-1.5 block h-3 overflow-hidden rounded-full bg-score-track">
                          <span
                            className={clsx("block h-full rounded-full", p.featured ? "bg-primary" : "bg-primary/35")}
                            style={{ width: `${Math.max(3, (v / max) * 100)}%` }}
                          />
                        </span>
                      )}
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-7 border-t border-border pt-4 text-small text-muted">
        The main limits of each software plan side by side; longer bars mean more. These are the limits the app enforces.
      </figcaption>
    </figure>
  );
}

/** Tiles for what comes with every plan; anything not on all plans says which plans have it. */
export function PlanIncludes({ className }: { className?: string }) {
  const all = <K extends keyof (typeof MARKETING_PLANS)[number]["limits"]>(k: K) => MARKETING_PLANS.every((p) => Boolean(p.limits[k]));
  const engines = MARKETING_PLANS.map((p) => p.ai.engines);
  const minEngines = Math.min(...engines);
  const maxEngines = Math.max(...engines);
  const agency = MARKETING_PLANS.find((p) => p.id === "agency");

  const items: { icon: React.ReactNode; title: string; body: string }[] = [
    {
      icon: <CalendarClock size={20} />,
      title: "Weekly website check",
      body: "We read your website again on a schedule you choose: weekly, monthly or off.",
    },
    {
      icon: <Sparkles size={20} />,
      title: "AI answer checks",
      body:
        minEngines === maxEngines
          ? `Your customer questions asked to ${num(minEngines)} AI assistants, such as ChatGPT and Gemini.`
          : `Your customer questions asked to ${num(minEngines)} to ${num(maxEngines)} AI assistants, such as ChatGPT and Gemini, depending on plan.`,
    },
    {
      icon: <LineChart size={20} />,
      title: "SEO, AEO, GEO and Brand scores",
      body: "Four scores from 0 to 100, with a to-do list of fixes, most useful first.",
    },
    ...(all("competitorTracking")
      ? [{ icon: <Users size={20} />, title: "Competitor comparison", body: "See which competitors AI names instead of you." }]
      : []),
    ...(all("approvalPublishing")
      ? [{ icon: <ShieldCheck size={20} />, title: "Fixes go live only with your OK", body: "Approve the exact change before it is published." }]
      : []),
    { icon: <History size={20} />, title: "Undo and change history", body: "We save the page before every change, so you can put it back." },
  ];

  return (
    <figure className={clsx("min-w-0", className)}>
      <ul className="grid gap-px overflow-hidden rounded-[22px] border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <li key={it.title} className="flex gap-4 bg-surface p-5 sm:p-6">
            <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
              {it.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[1rem] font-semibold tracking-[-0.01em] text-fg">{it.title}</span>
              <span className="mt-1 block text-small leading-relaxed text-fg-soft">{it.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="mt-4 flex items-start gap-2 text-small text-fg-soft">
        <BadgeCheck aria-hidden size={16} className="mt-0.5 shrink-0 text-primary" />
        <span>
          Included in every software plan.
          {agency ? ` ${agency.name} also adds white-label reports and emails with your own name and logo.` : ""}
        </span>
      </figcaption>
    </figure>
  );
}
