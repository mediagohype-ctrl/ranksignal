import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { FinalCta, IconTile, JsonLd, PageHero } from "@/components/marketing/ui";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";
import { FEATURES } from "@/components/marketing/content";
import { QaSection, SourcesList, type Qa } from "@/components/marketing/answers";
import { MARKETING_PLANS, TRIAL_AI, TRIAL_DAYS, inr, num } from "@/components/marketing/plans";

export const metadata: Metadata = staticPageMetadata("/features");

export default function FeaturesPage() {
  return (
    <>
      <JsonLd data={[webPageLd("/features"), faqLdFromQa(featureFacts()), breadcrumbLd([{ name: "Features", path: "/features" }])]} />
      <PageHero
        eyebrow="Features"
        title="SEO, AEO and GEO features, explained"
        intro={
          <p>
            {BRAND.name} checks your website, asks AI about you, and helps you fix what&apos;s wrong — safely. Here&apos;s
            what each part does, and what it doesn&apos;t.
          </p>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <LinkButton href="/signup" size="lg" variant="accent" iconRight={<ArrowRight />}>
            Start your free trial
          </LinkButton>
          <LinkButton href="/#sample" size="lg" variant="secondary">
            See a sample report
          </LinkButton>
        </div>
      </PageHero>

      <div className="bg-bg py-16 sm:py-20">
        <div className="container-marketing grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-14">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-caption uppercase tracking-[0.06em] text-muted">On this page</p>
              <ul className="mt-3 space-y-0.5 border-l border-border">
                {FEATURES.map((f) => (
                  <li key={f.slug}>
                    <a
                      href={`#${f.slug}`}
                      className="-ml-px block border-l border-transparent py-1.5 pl-4 text-small text-muted transition-colors hover:border-primary hover:text-fg"
                    >
                      {f.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="space-y-6">
            {FEATURES.map((f, i) => (
              <section
                key={f.slug}
                id={f.slug}
                aria-labelledby={`${f.slug}-title`}
                className="scroll-mt-24 rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8"
              >
                <div className="flex items-start gap-4">
                  <IconTile>
                    <f.icon />
                  </IconTile>
                  <div className="min-w-0">
                    <p className="eyebrow">Feature {String(i + 1).padStart(2, "0")}</p>
                    <h2 id={`${f.slug}-title`} className="mt-1 text-h3 text-fg">
                      {f.title}
                    </h2>
                  </div>
                </div>
                <p className="mt-4 text-lead text-fg-soft">{f.summary}</p>
                <ul className="mt-6 space-y-3 border-t border-border pt-6">
                  {f.details.map((d) => (
                    <li key={d} className="flex gap-3 text-body leading-relaxed text-fg-soft">
                      <Check aria-hidden size={18} className="mt-1 shrink-0 text-success" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="pt-2 text-small text-muted">
              Want the step-by-step flow? Read{" "}
              <Link href="/how-it-works" className="font-medium text-primary underline-offset-4 hover:underline">
                how it works
              </Link>{" "}
              or the{" "}
              <Link href="/docs" className="font-medium text-primary underline-offset-4 hover:underline">
                getting-started guide
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      <QaSection
        id="features-numbers"
        tone="surface"
        eyebrow="In numbers"
        title="What each plan measures"
        description="The limits below come straight from our plan settings, so they match what the app enforces."
        items={featureFacts()}
      >
        <SourcesList
          title="Standards our checks are based on"
          className="rounded-2xl border border-border bg-bg p-6"
          links={[
            { href: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", label: "Google Search Central: SEO Starter Guide" },
            { href: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data", label: "Google Search Central: introduction to structured data" },
            { href: "https://schema.org/Organization", label: "schema.org: Organization and LocalBusiness" },
            { href: "https://datatracker.ietf.org/doc/html/rfc9309", label: "IETF RFC 9309: Robots Exclusion Protocol" },
            { href: "https://web.dev/articles/vitals", label: "web.dev: Core Web Vitals" },
          ]}
        />
      </QaSection>

      <FinalCta
        title="Try every feature on your website"
        body={<p>Every feature is included in the free trial, within the trial&apos;s limits.</p>}
      />
    </>
  );
}

function featureFacts(): Qa[] {
  const [starter, growth, agency] = MARKETING_PLANS;
  return [
    {
      q: "How many pages does the website check read?",
      a: (
        <>
          Each website check reads up to {num(starter.limits.maxPagesPerCrawl)} pages on the {starter.name} plan,{" "}
          {num(growth.limits.maxPagesPerCrawl)} on {growth.name} and {num(agency.limits.maxPagesPerCrawl)} on {agency.name}. It
          scores four areas — SEO, AEO, GEO and Brand — each from 0 to 100, and turns every problem into a plain-English to-do.
        </>
      ),
    },
    {
      q: "How many AI answers do I get?",
      a: (
        <>
          {starter.name} covers {num(starter.ai.answersPerMonth)} AI answers a month, asked across {starter.ai.engines} AI
          assistants. {growth.name} covers {num(growth.ai.answersPerMonth)} answers across {growth.ai.engines} assistants, and{" "}
          {agency.name} covers {num(agency.ai.answersPerMonth)}. One answer is one customer question asked to one AI assistant.
        </>
      ),
    },
    {
      q: "What does it cost to try?",
      a: (
        <>
          Nothing for {TRIAL_DAYS} days: the free trial includes {TRIAL_AI.summary} and a full website check. After that, plans
          cost {inr(starter.price)}, {inr(growth.price)} or {inr(agency.price)} a month. See{" "}
          <Link href="/pricing">pricing</Link> for every limit.
        </>
      ),
    },
  ];
}
