import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Clock } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { OFFER_SALES_LINE } from "@/lib/billing/offer";
import { IconTile, JsonLd, PageHero } from "@/components/marketing/ui";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";
import { FEATURE_CARDS } from "@/components/marketing/content";
import { QaSection, type Qa } from "@/components/marketing/answers";
import { SELF_PLAN, TRIAL_AI, TRIAL_DAYS, engineNamesLine, gstOn, inr, num } from "@/components/marketing/plans";
import { comingNext } from "@/components/marketing/features/categories";

export const metadata: Metadata = staticPageMetadata("/features");

export default function FeaturesPage() {
  const { waiting, live } = comingNext();

  return (
    <>
      <JsonLd data={[webPageLd("/features"), faqLdFromQa(featureFacts()), breadcrumbLd([{ name: "Features", path: "/features" }])]} />
      <PageHero
        eyebrow="Features"
        title="What MyWebRank does for your business"
        intro={
          <p>
            {BRAND.name} checks your website, asks AI assistants about you, shows you exactly what to fix and reports what
            changed. Four parts, in plain words.
          </p>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <LinkButton href="/free-check" size="lg" variant="accent" iconRight={<ArrowRight />}>
            Check my website free
          </LinkButton>
        </div>
      </PageHero>

      {/* ------------------------------------------------------------ The four parts */}
      <section aria-labelledby="features-title" className="bg-bg py-16 sm:py-20">
        <div className="container-marketing">
          <h2 id="features-title" className="sr-only">
            The four parts
          </h2>
          <ul className="grid gap-6 md:grid-cols-2">
            {FEATURE_CARDS.map((f) => (
              <li key={f.id} id={f.id} className="mk-reveal scroll-mt-24 rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-8">
                <div className="flex items-center gap-4">
                  <IconTile>
                    <f.icon />
                  </IconTile>
                  <h3 id={`${f.id}-title`} className="text-h2 text-fg">
                    {f.title}
                  </h3>
                </div>
                <p className="mt-4 text-lead text-fg-soft">{f.summary}</p>
                <ul className="mt-6 space-y-3 border-t border-border pt-6">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex gap-3 text-body leading-relaxed text-fg-soft">
                      <Check aria-hidden size={18} className="mt-1 shrink-0 text-success" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <p className="mt-8 max-w-3xl text-body text-fg-soft">
            {OFFER_SALES_LINE}{" "}
            <Link href="/pricing" className="font-medium text-primary underline-offset-4 hover:underline">
              See pricing
            </Link>
            , or read{" "}
            <Link href="/how-it-works" className="font-medium text-primary underline-offset-4 hover:underline">
              how it works
            </Link>
            .
          </p>

          {live.length > 0 && (
            <p className="mt-4 max-w-3xl text-small text-muted">Also included: {live.map((f) => f.title).join(", ")}.</p>
          )}

          {/* ------------------------------------------------------ Coming next: everything that isn't live yet */}
          {waiting.length > 0 && (
            <aside id="coming-next" aria-labelledby="coming-next-title" className="mt-12 scroll-mt-24 rounded-2xl border border-dashed border-border-strong bg-surface-2/60 p-5 sm:p-6">
              <h2 id="coming-next-title" className="flex items-center gap-2 text-h4 text-fg">
                <Clock aria-hidden size={16} className="text-muted" />
                Coming next
              </h2>
              <p className="mt-1 text-small text-muted">Not switched on yet. We will say so here when each one is ready.</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {waiting.map((f) => (
                  <li key={f.slug} className="inline-flex h-8 items-center rounded-full border border-border bg-surface px-3 text-small text-fg-soft">
                    {f.title}
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </section>

      <QaSection
        id="features-numbers"
        tone="surface"
        eyebrow="In numbers"
        title="What you get on Do it myself"
        description="These limits come straight from our plan settings, so they match what the app does."
        items={featureFacts()}
      />
    </>
  );
}

function featureFacts(): Qa[] {
  const starter = SELF_PLAN;
  return [
    {
      q: "How many pages does the website check read?",
      a: (
        <>
          Each website check reads up to {num(starter.limits.maxPagesPerCrawl)} pages on {starter.name}. It scores four
          areas, SEO, AEO, GEO and Brand, each from 0 to 100, and turns every problem into a plain to-do.
        </>
      ),
    },
    {
      q: "Which AI assistants do you check, and how often?",
      a: (
        <>
          {starter.name} checks {engineNamesLine(starter.id)}, {starter.ai.checksPerMonth} times a month. Each check asks up
          to {starter.ai.questionsPerCheck} of your customer questions. That is {num(starter.ai.answersPerMonth)} AI answers
          a month; one answer is one question asked to one AI assistant.
        </>
      ),
    },
    {
      q: "What does it cost to try?",
      a: (
        <>
          Nothing for {TRIAL_DAYS} days: the free trial includes {TRIAL_AI.summary} and a full website check. After that,{" "}
          {starter.name} costs {inr(starter.price)} a month{gstOn() ? " + GST" : ""}. See{" "}
          <Link href="/pricing">pricing</Link>.
        </>
      ),
    },
  ];
}
