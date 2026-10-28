import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Card, RiskBadge, SectionHeading } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { FinalCta, PageHero, Section } from "@/components/marketing/ui";
import { HOW_STEPS, RISK_CLASSES } from "@/components/marketing/content";

export const metadata: Metadata = {
  title: "How it works",
  description: `How ${BRAND.name} works: connect your site, audit and measure AI visibility, review prioritised fixes, then approve, publish and re-measure — with rollback.`,
  alternates: { canonical: "/how-it-works" },
};

const STEP_DETAILS: string[][] = [
  [
    "Add your website, brand name and the countries and languages you sell in.",
    "Pick the competitors you want to compare against — you can add more later.",
    "Optionally connect WordPress or a Git repository. Connections stay read-only until you turn on publishing.",
  ],
  [
    "A polite crawler (it respects robots.txt and rate limits) checks your pages for SEO, AEO and GEO problems.",
    "Your tracked questions are asked again and again across AI assistants to build a baseline.",
    "You get scores, a mention rate and a citation rate — each with the number of answers behind it.",
  ],
  [
    "Findings become a fix list, ranked by likely impact and effort, each explained in plain English.",
    "Every fix shows its evidence, its risk class and a draft or exact change ready for review.",
    "Edit drafts freely. Editing cancels any earlier approval, so you always approve exactly what ships.",
  ],
  [
    "Approve the exact change. It's published through your connector, or exported for you to apply by hand.",
    "We snapshot the page before every change, so you can roll it back from the change log.",
    "Follow-up checks show what moved afterwards — reported as observed change, not proven cause.",
  ],
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="A measured loop, not a magic button"
        intro={
          <p>
            {BRAND.name} runs a simple, repeatable cycle: measure, fix what the evidence supports, ship only what
            you&apos;ve approved, and measure again.
          </p>
        }
      />

      <Section labelledBy="steps-title">
        <SectionHeading id="steps-title" size="lg" align="center" eyebrow="The process" title="Four steps, on repeat" />
        <ol className="relative mx-auto max-w-4xl space-y-6">
          <span aria-hidden className="absolute bottom-8 left-[3.75rem] top-8 hidden w-px bg-border sm:block" />
          {HOW_STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <Card padding="lg" className="grid gap-5 sm:grid-cols-[56px_1fr] sm:gap-6">
                <span className="relative flex size-12 items-center justify-center rounded-full bg-primary text-h4 text-primary-fg shadow-md ring-8 ring-surface sm:size-14">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-h3 text-fg">{s.title}</h3>
                  <p className="mt-2 text-body text-fg-soft">{s.body}</p>
                  <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                    {STEP_DETAILS[i].map((d) => (
                      <li key={d} className="flex gap-3 text-small leading-relaxed text-fg-soft">
                        <Check aria-hidden size={16} className="mt-0.5 shrink-0 text-success" />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      <Section labelledBy="risk-title" tone="surface">
        <SectionHeading
          id="risk-title"
          size="lg"
          align="center"
          eyebrow="Approval policy"
          title="Risk classes decide what needs a person"
          description="You set the policy per project. The default is careful: everything needs approval, and class D is never run automatically. A workspace kill switch pauses all publishing immediately."
        />
        <ul className="grid gap-6 md:grid-cols-2">
          {RISK_CLASSES.map((r) => (
            <Card as="li" key={r.cls} padding="md">
              <div className="flex flex-wrap items-center gap-2.5">
                <RiskBadge riskClass={r.cls} />
                <h3 className="text-h4 text-fg">{r.name}</h3>
              </div>
              <p className="mt-3 text-small leading-relaxed text-muted">{r.body}</p>
            </Card>
          ))}
        </ul>
      </Section>

      <FinalCta
        title="Start your first measurement cycle"
        body={<p>Connect a site in minutes and get a baseline during the free trial.</p>}
      />
    </>
  );
}
