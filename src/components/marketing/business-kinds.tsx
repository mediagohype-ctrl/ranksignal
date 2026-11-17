// Homepage: "Whatever you sell" — four kinds of business, each with an example customer search.
// Tabs WITHOUT JavaScript: four radio buttons and CSS (:has). Every panel is in the HTML, so Google and AI crawlers
// read all four; browsers without :has() simply show the four panels one under another.
// The searches are examples only (labelled as such) — no real customers, no results promised.
import { Search } from "lucide-react";
import { CUSTOM_PLAN } from "@/components/marketing/plans";

// The class names are written out in full so Tailwind can see them (no string building).
const KINDS = [
  {
    id: "kind-local",
    label: "Local business",
    search: "best dentist near me open on Sunday",
    title: "Be the one named in your area",
    body: "People search for what you do, plus where. We check that Google and AI can tell what you do and where you are.",
    hide: "group-has-[#kind-local:not(:checked)]/kinds:hidden",
  },
  {
    id: "kind-store",
    label: "Online store",
    search: "which running shoes are good for flat feet",
    title: "Be in the answer when shoppers ask",
    body: "Shoppers ask before they buy. We check that your product pages can be read, and that they answer what buyers ask.",
    hide: "group-has-[#kind-store:not(:checked)]/kinds:hidden",
  },
  {
    id: "kind-b2b",
    label: "B2B",
    search: "payroll software for a 50-person company in India",
    title: "Be on the shortlist",
    body: "Buyers ask AI for a shortlist before they call anyone. We show you whether you are named, and who is named instead.",
    hide: "group-has-[#kind-b2b:not(:checked)]/kinds:hidden",
  },
  {
    id: "kind-agency",
    label: "Agency",
    search: "why is my client not showing up in ChatGPT",
    title: "Look after many client websites",
    body: `Check each client's website and AI answers in one place. Reports with your logo are part of the ${CUSTOM_PLAN.name} plan.`,
    hide: "group-has-[#kind-agency:not(:checked)]/kinds:hidden",
  },
] as const;

export function BusinessKinds({ className }: { className?: string }) {
  return (
    <div className={"group/kinds " + (className ?? "")}>
      <div role="radiogroup" aria-label="Your kind of business" className="flex flex-wrap gap-2">
        {KINDS.map((k, i) => (
          <label
            key={k.id}
            htmlFor={k.id}
            className="inline-flex h-11 cursor-pointer items-center rounded-full border border-border-strong bg-surface px-5 text-small font-medium text-fg-soft transition-colors hover:bg-surface-2 has-[:checked]:border-fg has-[:checked]:bg-fg has-[:checked]:text-bg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
          >
            <input id={k.id} type="radio" name="business-kind" defaultChecked={i === 0} className="sr-only" />
            {k.label}
          </label>
        ))}
      </div>
      <div className="mt-6 space-y-4">
        {KINDS.map((k) => (
          <div key={k.id} className={"rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8 " + k.hide}>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
              {k.label} · example search
            </p>
            <p className="mt-3 flex min-h-12 items-center gap-3 rounded-full border border-border-strong bg-surface-2/60 px-4 py-2 text-[0.9375rem] text-fg sm:px-5">
              <Search aria-hidden size={18} className="shrink-0 text-muted" />
              <span>{k.search}</span>
            </p>
            <h3 className="mt-6 text-[1.25rem] font-semibold tracking-[-0.015em] text-fg">{k.title}</h3>
            <p className="mk-body mt-2 max-w-2xl text-fg-soft">{k.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
