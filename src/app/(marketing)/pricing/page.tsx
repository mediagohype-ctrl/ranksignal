import type { Metadata } from "next";
import clsx from "clsx";
import { ArrowRight, Check, Minus } from "lucide-react";
import { Badge, Card, LinkButton, Notice, SectionHeading, Table, TD, TH, THead, TR } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { FinalCta, JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { MARKETING_PLANS, TRIAL_DAYS, freq, inr, num } from "@/components/marketing/plans";

export const metadata: Metadata = {
  title: "Pricing and plans",
  description: `${BRAND.name} plans for AI visibility tracking, AI-readiness audits and approval-gated publishing. Starter ₹2,999/mo, Growth ₹7,999/mo, Agency from ₹19,999/mo. ${TRIAL_DAYS}-day free trial.`,
  alternates: { canonical: "/pricing" },
};

type Cell = string | boolean;

const ROWS: { label: string; hint?: string; values: Cell[] }[] = [
  { label: "Websites", values: MARKETING_PLANS.map((p) => num(p.limits.maxProjects)) },
  {
    label: "Tracked AI questions",
    hint: "Questions we ask AI assistants about your category",
    values: MARKETING_PLANS.map((p) => num(p.limits.maxTrackedPrompts)),
  },
  { label: "How often we check", values: MARKETING_PLANS.map((p) => freq(p.limits.minScanIntervalDays)) },
  { label: "Pages per site check", values: MARKETING_PLANS.map((p) => num(p.limits.maxPagesPerCrawl)) },
  { label: "Monthly usage credits", values: MARKETING_PLANS.map((p) => num(p.limits.monthlyCredits)) },
  { label: "Competitor comparison", values: MARKETING_PLANS.map((p) => p.limits.competitorTracking) },
  { label: "Approve-before-publish fixes", values: MARKETING_PLANS.map((p) => p.limits.approvalPublishing) },
  { label: "Rollback & audit log", values: MARKETING_PLANS.map(() => true) },
  { label: "Team seats", values: MARKETING_PLANS.map((p) => num(p.limits.seats)) },
  { label: "White-label reports", values: MARKETING_PLANS.map((p) => (p.id === "agency" ? "Coming later" : false)) },
];

const PRICING_FAQ = [
  {
    q: "What happens after the free trial?",
    a: `Your ${TRIAL_DAYS}-day trial gives you a full report and a first AI visibility baseline. It only turns into a paid plan if you choose one and add payment details.`,
  },
  {
    q: "What are usage credits?",
    a: "Asking AI assistants questions and checking pages costs us money, so each plan includes a monthly pool of credits. The app shows how many you've used and stops before you go over.",
  },
  {
    q: "Do any plans guarantee results?",
    a: "No. Plans cover measurement, auditing and workflow tools. Nobody can honestly guarantee rankings, AI mentions or citations.",
  },
];

function CellValue({ v }: { v: Cell }) {
  if (v === true)
    return (
      <span className="inline-flex items-center justify-center text-success">
        <Check aria-hidden size={18} />
        <span className="sr-only">Included</span>
      </span>
    );
  if (v === false)
    return (
      <span className="inline-flex items-center justify-center text-muted">
        <Minus aria-hidden size={18} />
        <span className="sr-only">Not included</span>
      </span>
    );
  return <span className="tabular-nums">{v}</span>;
}

export default function PricingPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: BRAND.name,
    description: BRAND.tagline,
    brand: { "@type": "Brand", name: BRAND.name },
    offers: MARKETING_PLANS.map((p) => ({
      "@type": "Offer",
      name: `${BRAND.name} ${p.name}`,
      price: String(p.price),
      priceCurrency: "INR",
      url: `${BRAND.appUrl}/pricing`,
      availability: "https://schema.org/InStock",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: String(p.price),
        priceCurrency: "INR",
        unitCode: "MON",
        valueAddedTaxIncluded: false,
        ...(p.suffix ? { minPrice: String(p.price) } : {}),
      },
    })),
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PRICING_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };

  return (
    <>
      <JsonLd data={[jsonLd, faqLd]} />
      <PageHero
        eyebrow="Pricing"
        title="Simple plans, honest limits"
        intro={
          <p>
            Every plan starts with a {TRIAL_DAYS}-day free trial. Prices are indicative, billed monthly in Indian rupees,
            and exclude GST.
          </p>
        }
      />

      <section aria-labelledby="plans-title" className="bg-bg pb-20 sm:pb-24">
        <div className="container-marketing">
          <h2 id="plans-title" className="sr-only">
            Plans
          </h2>
          <ul className="-mt-10 grid gap-6 lg:grid-cols-3 lg:items-stretch">
            {MARKETING_PLANS.map((p) => (
              <li
                key={p.id}
                className={clsx(
                  "relative flex animate-fade-in flex-col rounded-2xl border bg-surface p-6 sm:p-8",
                  p.featured ? "border-primary shadow-xl ring-1 ring-primary lg:-translate-y-2" : "border-border shadow-card",
                )}
              >
                {p.featured && (
                  <Badge tone="primary" variant="solid" size="md" className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    Recommended
                  </Badge>
                )}
                <h3 className="text-h3 text-fg">{p.name}</h3>
                <p className="mt-2 min-h-[3lh] text-small leading-relaxed text-muted">{p.blurb}</p>
                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-h1 tabular-nums text-fg">
                    {inr(p.price)}
                    {p.suffix}
                  </span>
                  <span className="text-small text-muted">/month</span>
                </p>
                <p className="mt-1 text-xs text-muted">+ GST · indicative price</p>
                <LinkButton
                  href={p.id === "agency" ? "/contact" : `/signup?plan=${p.id}`}
                  variant={p.featured ? "primary" : "secondary"}
                  size="lg"
                  fullWidth
                  className="mt-7"
                  iconRight={p.featured ? <ArrowRight /> : undefined}
                >
                  {p.cta}
                </LinkButton>
                <ul className="mt-8 flex-1 space-y-3 border-t border-border pt-6">
                  {p.highlights.map((h) => (
                    <li key={h} className="flex gap-3 text-small text-fg-soft">
                      <Check aria-hidden size={18} className="mt-px shrink-0 text-success" />
                      {h}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-small text-muted">
            Not sure which plan fits? Start the free trial — it mirrors Starter limits with a smaller credit pool, and you can pick a plan later.
          </p>
        </div>
      </section>

      <Section labelledBy="compare-title" tone="surface">
        <SectionHeading
          id="compare-title"
          size="lg"
          align="center"
          eyebrow="Compare"
          title="Compare plans side by side"
          description="Limits below are the same ones the app enforces."
        />
        <Card className="overflow-hidden">
          <Table caption="Feature comparison across Starter, Growth and Agency plans" zebra>
            <THead>
              <tr>
                <TH className="w-[40%]">Feature</TH>
                {MARKETING_PLANS.map((p) => (
                  <TH key={p.id} align="center" className={clsx(p.featured && "text-primary")}>
                    {p.name}
                  </TH>
                ))}
              </tr>
            </THead>
            <tbody>
              {ROWS.map((r) => (
                <TR key={r.label}>
                  <TD className="font-medium text-fg">
                    {r.label}
                    {r.hint && <span className="block text-xs font-normal text-muted">{r.hint}</span>}
                  </TD>
                  {r.values.map((v, i) => (
                    <TD key={i} className="text-center">
                      <CellValue v={v} />
                    </TD>
                  ))}
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
        <Notice tone="neutral" className="mt-6">
          Prices are indicative and exclude GST (charged at the applicable rate). Limits and prices may change before
          general availability; existing subscribers will be told in advance. No plan guarantees rankings, AI mentions or
          citations.
        </Notice>
      </Section>

      <Section labelledBy="pricing-faq-title">
        <SectionHeading id="pricing-faq-title" size="lg" align="center" eyebrow="FAQ" title="Pricing questions" />
        <dl className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
          {PRICING_FAQ.map((f) => (
            <Card key={f.q} padding="md">
              <dt className="text-h4 text-fg">{f.q}</dt>
              <dd className="mt-2 text-small leading-relaxed text-muted">{f.a}</dd>
            </Card>
          ))}
        </dl>
      </Section>

      <FinalCta
        title="Try it on your own site"
        body={<p>Get a full report and a first AI visibility baseline before you commit.</p>}
      />
    </>
  );
}
