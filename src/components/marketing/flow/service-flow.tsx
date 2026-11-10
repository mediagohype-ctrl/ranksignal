// Done-for-you "how we work with you": each service step split into what you do and what our team does.
// Server component. All words are HTML text; arrows and the loop line are decorative.
import clsx from "clsx";
import { ArrowRight, RotateCw } from "lucide-react";

type Step = { when: string; title: string };

/** What you do and what we do at each step, in the same order as the steps passed in. */
const LANES: { you: string; team: string }[] = [
  {
    you: "Give us access to your website and a manager role on your Google Business Profile.",
    team: "Read your website, check your profile and ask AI assistants about your business.",
  },
  {
    you: "About an hour to agree the customer questions and approve the first fix plan.",
    team: "Research the questions your customers really ask.",
  },
  {
    you: "Quick OKs for anything that changes what your business says publicly.",
    team: "Make the agreed fixes on your site, profile and listings, each one recorded.",
  },
  {
    you: "Read the report and approve next month’s plan — about 30 minutes.",
    team: "Report what we did, what changed, what didn’t and what’s next.",
  },
];

function Lane({ who, children }: { who: "You" | "Our team"; children: React.ReactNode }) {
  return (
    <div className={clsx("flex flex-col gap-2 rounded-2xl p-4", who === "You" ? "border border-border bg-surface" : "bg-fg text-bg")}>
      <span
        className={clsx(
          "inline-flex h-6 items-center self-start rounded-full px-2.5 text-[11px] font-medium",
          who === "You" ? "border border-border-strong text-fg" : "bg-bg/15 text-bg",
        )}
      >
        {who}
      </span>
      <p className={clsx("text-small leading-relaxed", who === "You" ? "text-fg-soft" : "text-bg/85")}>{children}</p>
    </div>
  );
}

/** Swimlane flow for /services: four steps across, "You" and "Our team" rows, then month to month. */
export function ServiceFlow({ steps, className }: { steps: Step[]; className?: string }) {
  return (
    <figure className={clsx("min-w-0", className)}>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[auto_1fr_1fr] lg:gap-x-6 lg:gap-y-3">
        {steps.map((s, i) => {
          const lane = LANES[i];
          if (!lane) return null;
          return (
            <li key={s.title} className="mk-reveal relative grid min-w-0 gap-3 lg:row-span-3 lg:grid-rows-subgrid">
              <div className="flex items-baseline gap-3 border-t-2 border-primary pt-3">
                <span className="text-small font-medium tabular-nums text-primary">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-muted">{s.when}</span>
                  <span className="block text-[1rem] font-semibold tracking-[-0.015em] text-fg">{s.title}</span>
                </span>
              </div>
              <Lane who="You">{lane.you}</Lane>
              <Lane who="Our team">{lane.team}</Lane>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -right-6 top-1 z-10 hidden size-6 items-center justify-center rounded-full border border-border bg-surface text-muted lg:inline-flex"
                >
                  <ArrowRight size={13} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {/* Steps 3 and 4 repeat every month. */}
      <div aria-hidden className="relative hidden h-8 lg:block">
        <div className="absolute inset-y-0 left-[62.5%] right-[12.5%] rounded-b-[16px] border-2 border-t-0 border-dashed border-border-strong" />
      </div>
      <figcaption className="mt-5 inline-flex items-start gap-2 text-small text-fg-soft lg:mt-3">
        <RotateCw aria-hidden size={15} className="mt-0.5 shrink-0 text-primary" />
        Who does what at each step. Steps 3 and 4 repeat every month, so your part stays small.
      </figcaption>
    </figure>
  );
}
