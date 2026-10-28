import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  FileCheck2,
  Power,
  Ruler,
  Scale,
  ScrollText,
  Search,
  Sparkles,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { Badge, Card, LinkButton, Meter, Notice, RiskBadge, SectionHeading } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { EngineChips, FinalCta, HeroEyebrow, IconTile, JsonLd, Section } from "@/components/marketing/ui";
import { SampleReport, SampleReportPeek } from "@/components/marketing/sample-report";
import { FAQS, FEATURES, HOW_STEPS, RISK_CLASSES } from "@/components/marketing/content";
import { MARKETING_PLANS, TRIAL_DAYS, inr } from "@/components/marketing/plans";

const TITLE = `${BRAND.name} — Get found and cited in AI answers`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description:
    "Measure how ChatGPT, Gemini, Perplexity and Google AI Overviews mention and cite your brand, audit your site for AI readiness, and ship approved fixes safely.",
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: BRAND.tagline,
    type: "website",
  },
};

const EXPLAINED: {
  key: string;
  term: string;
  full: string;
  icon: LucideIcon;
  plain: string;
  example: string;
  checks: string[];
}[] = [
  {
    key: "seo",
    term: "SEO",
    full: "Search engine optimisation",
    icon: Search,
    plain: "Making sure Google and Bing can find, read and trust your pages, so you show up in normal search results.",
    example: "Someone searches “cake shop Indiranagar” and sees a list of links.",
    checks: ["Pages load and can be indexed", "Clear titles and descriptions", "No broken links or redirects"],
  },
  {
    key: "aeo",
    term: "AEO",
    full: "Answer engine optimisation",
    icon: Sparkles,
    plain: "Writing clear, direct answers to real questions, so search features and assistants can quote you.",
    example: "Someone asks “do they make eggless cakes?” and gets a one-line answer.",
    checks: ["Direct answers near the top", "FAQ and how-to content", "Structured data search engines understand"],
  },
  {
    key: "geo",
    term: "GEO",
    full: "Generative engine optimisation",
    icon: Bot,
    plain: "Helping AI tools like ChatGPT and Gemini understand who you are, so they name and cite you in their answers.",
    example: "Someone asks “best bakery for a birthday cake near me?” and gets three names.",
    checks: ["How often AI names your brand", "Which sources AI cites", "Whether AI describes you accurately"],
  },
];

const SAFEGUARDS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: FileCheck2,
    title: "You approve the exact change",
    body: "Approval is tied to the precise draft. If anyone edits it afterwards, it needs approving again.",
  },
  { icon: Undo2, title: "One-click rollback", body: "We snapshot every page before changing it, so any change can be undone." },
  { icon: Power, title: "Kill switch", body: "Pause all publishing for your whole workspace instantly." },
  { icon: ScrollText, title: "Full audit trail", body: "Every approval and change is logged with who did what, and when." },
];

const HONEST: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: BarChart3,
    title: "Sample-based numbers",
    body: "AI answers change every time you ask. We ask each question many times and report the pattern, not one screenshot.",
  },
  {
    icon: Ruler,
    title: "Sample size always shown",
    body: "Every figure says how many answers it's based on, with a likely range, so you know how much to trust it.",
  },
  {
    icon: Scale,
    title: "Measured, not claimed",
    body: "We show what changed after a fix. We don't claim the fix caused it — other things change too.",
  },
];

export default function HomePage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: BRAND.name,
      url: BRAND.appUrl,
      email: BRAND.supportEmail,
      description: BRAND.tagline,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* ------------------------------------------------------------ Hero */}
      <section aria-labelledby="hero-title" className="bg-hero relative overflow-hidden">
        <div className="container-marketing grid items-center gap-14 py-20 sm:py-24 lg:grid-cols-[1.15fr_1fr] lg:gap-16 lg:py-28">
          <div className="animate-fade-in">
            <HeroEyebrow icon={<Sparkles />}>SEO · AEO · GEO in one report</HeroEyebrow>
            <h1 id="hero-title" className="mt-6 text-balance text-display text-navy-fg">
              Get found and cited when people ask&nbsp;AI.
            </h1>
            <p className="mt-6 max-w-xl text-lead text-navy-fg/80">
              See how search engines and AI assistants see your business, in plain English. Get a clear list of what to
              fix, and ship the fixes you approve — with rollback built in.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/signup" size="lg" variant="accent" iconRight={<ArrowRight />}>
                Get your free AI visibility report
              </LinkButton>
              <LinkButton href="#sample" size="lg" variant="secondary">
                See a sample report
              </LinkButton>
            </div>
            <p className="mt-5 text-small text-navy-fg/70">
              {TRIAL_DAYS}-day free trial on every plan. Honest, sample-based numbers — no guaranteed rankings.
            </p>

            <div className="mt-12 border-t border-navy-fg/15 pt-6">
              <p className="text-caption uppercase tracking-[0.08em] text-navy-fg/70">We measure your visibility in</p>
              <EngineChips onDark className="mt-3" />
            </div>
          </div>

          <div className="animate-fade-in lg:pl-4">
            <SampleReportPeek />
            <p className="mt-3 text-center text-xs text-navy-fg/70">
              Illustrative example with made-up numbers — not a real customer.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Sample report */}
      <Section id="sample" labelledBy="sample-title">
        <SectionHeading
          id="sample-title"
          size="lg"
          align="center"
          eyebrow="Sample report"
          title="A report you can actually read"
          description="Four scores, then every problem explained the same way: what's wrong, why it matters, and how to fix it — step by step."
        />
        <SampleReport />
        <Notice tone="neutral" title="This is a sample" className="mx-auto mt-8 max-w-3xl">
          The business, scores and findings above are made up to show the format. Your report uses your real pages
          and real answers from AI assistants.
        </Notice>
      </Section>

      {/* ------------------------------------------------------------ SEO vs AEO vs GEO */}
      <Section id="explained" labelledBy="explained-title" tone="surface">
        <SectionHeading
          id="explained-title"
          size="lg"
          align="center"
          eyebrow="Plain words"
          title="SEO vs AEO vs GEO, explained"
          description="Three names for one goal: when someone looks for what you sell, they should find you — whether they search, ask a question or chat with an AI."
        />
        <ul className="grid gap-6 md:grid-cols-3">
          {EXPLAINED.map((e) => (
            <Card as="li" key={e.key} padding="lg" className="flex flex-col">
              <div className="flex items-center gap-3">
                <IconTile>
                  <e.icon />
                </IconTile>
                <div>
                  <h3 className="text-h3 text-fg">{e.term}</h3>
                  <p className="text-small text-muted">{e.full}</p>
                </div>
              </div>
              <p className="mt-5 text-body text-fg-soft">{e.plain}</p>
              <div className="mt-5 rounded-xl bg-surface-2 px-4 py-3">
                <p className="text-caption uppercase tracking-[0.06em] text-muted">For example</p>
                <p className="mt-1 text-small text-fg-soft">{e.example}</p>
              </div>
              <p className="mt-6 text-caption uppercase tracking-[0.06em] text-muted">What we check</p>
              <ul className="mt-3 space-y-2">
                {e.checks.map((c) => (
                  <li key={c} className="flex gap-2.5 text-small text-fg-soft">
                    <Check aria-hidden size={16} className="mt-0.5 shrink-0 text-success" />
                    {c}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </ul>
        <p className="mx-auto mt-10 max-w-2xl text-center text-small text-muted">
          Your report also includes a <strong className="font-semibold text-fg">Brand</strong> score: whether AI tools
          describe your business correctly.
        </p>
      </Section>

      {/* ------------------------------------------------------------ Features */}
      <Section id="features" labelledBy="features-title">
        <SectionHeading
          id="features-title"
          size="lg"
          align="center"
          eyebrow="Features"
          title="Everything you need to be seen in AI answers"
          description="One workflow, from finding the right questions to measuring what changed."
        />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.slice(0, 9).map((f) => (
            <li key={f.slug}>
              <Link
                href={`/features#${f.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-card transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-card-hover"
              >
                <IconTile>
                  <f.icon />
                </IconTile>
                <h3 className="mt-5 text-h4 text-fg">{f.title}</h3>
                <p className="mt-2 flex-1 text-small leading-relaxed text-muted">{f.summary}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-small font-medium text-primary">
                  Learn more
                  <ArrowRight aria-hidden size={15} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <LinkButton href="/features" variant="secondary" iconRight={<ArrowRight />}>
            Explore every feature
          </LinkButton>
        </div>
      </Section>

      {/* ------------------------------------------------------------ How it works */}
      <Section id="how-it-works" labelledBy="how-title" tone="surface">
        <SectionHeading
          id="how-title"
          size="lg"
          align="center"
          eyebrow="How it works"
          title="From first report to approved fix in four steps"
        />
        <ol className="relative grid gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <span aria-hidden className="absolute left-0 right-0 top-6 hidden h-px bg-border lg:block" />
          {HOW_STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="relative flex size-12 items-center justify-center rounded-full bg-primary text-h4 text-primary-fg shadow-md ring-8 ring-surface">
                {i + 1}
              </span>
              <h3 className="mt-5 text-h4 text-fg">{s.title}</h3>
              <p className="mt-2 text-small leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 text-center">
          <LinkButton href="/how-it-works" variant="ghost" iconRight={<ArrowRight />}>
            See the full process
          </LinkButton>
        </div>
      </Section>

      {/* ------------------------------------------------------------ Safe automation */}
      <Section id="safe-automation" labelledBy="safe-title">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              id="safe-title"
              size="lg"
              eyebrow="Safe automation"
              title="Automation that asks first"
              description="Your website is your business. Every suggested change gets a risk class, and you decide what — if anything — may run without a person checking it."
              className="!mb-8"
            />
            <ul className="grid gap-5 sm:grid-cols-2">
              {SAFEGUARDS.map((s) => (
                <li key={s.title} className="flex gap-4">
                  <IconTile tone="accent" className="size-10">
                    <s.icon />
                  </IconTile>
                  <div>
                    <h3 className="text-body font-semibold text-fg">{s.title}</h3>
                    <p className="mt-1 text-small leading-relaxed text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <Card as="aside" aria-label="Risk classes" padding="none" className="self-start overflow-hidden">
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <h3 className="text-h4 text-fg">Risk classes</h3>
              <p className="mt-0.5 text-small text-muted">Default policy: everything needs your approval.</p>
            </div>
            <ul className="divide-y divide-border">
              {RISK_CLASSES.map((r) => (
                <li key={r.cls} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskBadge riskClass={r.cls} />
                    <span className="text-small font-semibold text-fg">{r.name}</span>
                  </div>
                  <p className="mt-1.5 text-small leading-relaxed text-muted">{r.body}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      {/* ------------------------------------------------------------ Honest measurement */}
      <Section id="honest-measurement" labelledBy="honest-title" tone="surface">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <SectionHeading
              id="honest-title"
              size="lg"
              eyebrow="Honest measurement"
              title="Numbers you can actually trust"
              description="Ask an AI the same question twice and you can get different answers. So we treat visibility as a statistic, not a ranking — and we never promise outcomes."
              className="!mb-8"
            />
            <ul className="space-y-5">
              {HONEST.map((h) => (
                <li key={h.title} className="flex gap-4">
                  <IconTile className="size-10">
                    <h.icon />
                  </IconTile>
                  <div>
                    <h3 className="text-body font-semibold text-fg">{h.title}</h3>
                    <p className="mt-1 text-small leading-relaxed text-muted">{h.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <Card padding="lg">
            <figure aria-label="Example of how a metric is reported">
            <div className="flex items-center justify-between gap-3">
              <p className="text-caption uppercase tracking-[0.06em] text-muted">Mention rate</p>
              <Badge tone="warning">Sample data</Badge>
            </div>
            <p className="mt-3 text-[3.25rem] font-semibold leading-none tracking-[-0.03em] text-fg tabular-nums">31%</p>
            <p className="mt-2 text-small text-fg-soft">
              of AI answers named your brand — likely between <span className="tabular-nums">25%</span> and{" "}
              <span className="tabular-nums">37%</span>.
            </p>
            <Meter value={31} max={100} label="Sample mention rate" tone="accent" size="md" className="mt-5" />
            <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5 text-center">
              {[
                ["240", "answers"],
                ["60", "questions"],
                ["4", "AI engines"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl bg-surface-2 px-2 py-3">
                  <dt className="sr-only">{l}</dt>
                  <dd className="text-h4 tabular-nums text-fg">{v}</dd>
                  <dd className="text-xs text-muted">{l}</dd>
                </div>
              ))}
            </dl>
            <figcaption className="mt-5 text-xs text-muted">
              Every number shows how many answers it&apos;s based on. Small samples move a lot, so we show a range.
            </figcaption>
            </figure>
          </Card>
        </div>
      </Section>

      {/* ------------------------------------------------------------ Pricing teaser */}
      <Section id="pricing" labelledBy="pricing-title">
        <SectionHeading
          id="pricing-title"
          size="lg"
          align="center"
          eyebrow="Pricing"
          title="Simple plans, honest limits"
          description={`Every plan starts with a ${TRIAL_DAYS}-day free trial. Prices in Indian rupees, billed monthly, plus GST.`}
        />
        <ul className="grid gap-6 md:grid-cols-3">
          {MARKETING_PLANS.map((p) => (
            <li
              key={p.id}
              className={
                p.featured
                  ? "relative flex flex-col rounded-2xl border border-primary bg-surface p-6 shadow-lg ring-1 ring-primary sm:p-7"
                  : "flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-7"
              }
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-h4 text-fg">{p.name}</h3>
                {p.featured && <Badge tone="primary">Recommended</Badge>}
              </div>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-h1 tabular-nums text-fg">
                  {inr(p.price)}
                  {p.suffix}
                </span>
                <span className="text-small text-muted">/month</span>
              </p>
              <p className="mt-3 flex-1 text-small leading-relaxed text-muted">{p.blurb}</p>
              <ul className="mt-5 space-y-2 border-t border-border pt-5">
                {p.highlights.slice(0, 3).map((h) => (
                  <li key={h} className="flex gap-2.5 text-small text-fg-soft">
                    <Check aria-hidden size={16} className="mt-0.5 shrink-0 text-success" />
                    {h}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <LinkButton href="/pricing" variant="secondary" iconRight={<ArrowRight />}>
            Compare plans in detail
          </LinkButton>
        </div>
      </Section>

      {/* ------------------------------------------------------------ FAQ */}
      <Section id="faq" labelledBy="faq-title" tone="surface">
        <SectionHeading id="faq-title" size="lg" align="center" eyebrow="FAQ" title="Questions, answered honestly" />
        <div className="mx-auto max-w-3xl divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          {FAQS.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-5 hover:bg-surface-2 sm:px-6 [&::-webkit-details-marker]:hidden">
                <h3 className="text-body font-semibold text-fg">{f.q}</h3>
                <span
                  aria-hidden
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 text-body leading-relaxed text-fg-soft sm:px-6">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <FinalCta
        title="See what AI says about your business"
        body={<p>Get your SEO, AEO and GEO scores and a plain-English fix list during your free trial.</p>}
      />
    </>
  );
}
