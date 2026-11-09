import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ARTICLES } from "@/lib/learn/articles";
import { breadcrumbLd, faqLdFromQa, siteUrl, webPageLd } from "@/lib/seo/schema";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { JsonLd, PageHero } from "@/components/marketing/ui";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";

export const metadata: Metadata = staticPageMetadata("/learn");

export default function LearnPage() {
  const base = siteUrl();
  return (
    <>
      <JsonLd
        data={[
          webPageLd("/learn", {
            type: "CollectionPage",
            base,
            extra: {
              mainEntity: {
                "@type": "ItemList",
                itemListElement: ARTICLES.map((a, i) => ({ "@type": "ListItem", position: i + 1, url: `${base}/learn/${a.slug}`, name: a.title })),
              },
            },
          }),
          // Repeats the visible "Quick answers" section word for word.
          faqLdFromQa(LEARN_FAQ),
          breadcrumbLd([{ name: "Guides", path: "/learn" }], base),
        ]}
      />
      <PageHero
        eyebrow="Guides"
        title="SEO, AEO and GEO guides"
        intro={<p>Plain-English guides to getting found on Google, quoted by answer engines and recommended by AI assistants like ChatGPT.</p>}
      />
      <section className="bg-bg py-12 sm:py-16">
        <ul className="container-marketing grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ARTICLES.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/learn/${a.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-card transition-colors hover:border-border-strong"
              >
                <h2 className="text-h4 text-fg">{a.title}</h2>
                <p className="mt-3 flex-1 text-small leading-relaxed text-fg-soft">{a.description}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-small font-medium text-primary">
                  Read the guide <ArrowRight aria-hidden size={16} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <QaSection id="learn-faq" tone="surface" title="Quick answers before you start" items={LEARN_FAQ}>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", label: "Google Search Central: SEO Starter Guide" },
            { href: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google Search Central: AI features and your website" },
            { href: "https://arxiv.org/abs/2311.09735", label: "Aggarwal et al. (2023): GEO: Generative Engine Optimization" },
            { href: "https://schema.org/docs/gs.html", label: "schema.org: getting started with structured data" },
          ]}
        />
      </QaSection>
    </>
  );
}

const LEARN_FAQ: Qa[] = [
  {
    q: "What is the difference between SEO, AEO and GEO?",
    a: (
      <>
        SEO helps your pages rank in Google&apos;s normal results. AEO shapes your answers so Google, voice assistants and
        chatbots can quote them directly. GEO helps AI assistants like ChatGPT and Gemini name and cite your business. All
        three share the same base: pages that load, can be crawled and say clearly who you are. See{" "}
        <Link href="/learn/seo-vs-aeo-vs-geo">SEO vs AEO vs GEO</Link>.
      </>
    ),
  },
  {
    q: "Does GEO really change what AI assistants say?",
    a: (
      <>
        Research suggests it can. A 2023 study,{" "}
        <SourceLink href="https://arxiv.org/abs/2311.09735">GEO: Generative Engine Optimization</SourceLink>, found that
        adding statistics, quotations and cited sources raised a page&apos;s visibility in AI answers by up to 40%. Results vary
        by topic, so measure your own mention rate rather than trusting any single number.
      </>
    ),
  },
  {
    q: "Which guide should I read first?",
    a: (
      <>
        If you are new, read <Link href="/learn/website-seo-audit-checklist">the website SEO audit checklist</Link> and fix
        the basics first. Then run the <Link href="/free-check">free website check</Link>, which scores SEO, AEO, GEO and Brand
        from 0 to 100 each and shows which guide matters most for your site.
      </>
    ),
  },
];
