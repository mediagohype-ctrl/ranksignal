import type { Metadata } from "next";
import { FreeCheckFinalCta, FreeCheckSteps, FreeVsFull } from "@/components/marketing/free-check-explainer";
import { SELF_ENGINE_LIST } from "@/components/marketing/engine-names";
import { BRAND, bookCallHref } from "@/lib/brand";
import { JsonLd } from "@/components/marketing/ui";
import { FreeCheckTool, HideWhenFreeCheckResult } from "@/components/marketing/free-check-tool";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { inrGst } from "@/components/marketing/plans";
import { MAX_KEY_PAGES } from "@/lib/free-check/run";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const DESCRIPTION = PAGE_SEO["/free-check"].description;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * /free-check?url=… shows one visitor's result: never indexed, and its main version (canonical) is /free-check.
 * Results are not stored, so there is no page per checked website for Google to find.
 */
export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = await searchParams;
  return staticPageMetadata("/free-check", sp.url !== undefined ? { robots: { index: false, follow: true } } : {});
}

export default async function FreeCheckPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const initialUrl = typeof sp.url === "string" ? sp.url.slice(0, 2048) : "";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${BRAND.name} free website check`,
    url: `${BRAND.appUrl.replace(/\/$/, "")}/free-check`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    description: DESCRIPTION,
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    provider: { "@type": "Organization", name: BRAND.name, url: BRAND.appUrl },
  };

  return (
    <>
      <JsonLd data={[jsonLd, webPageLd("/free-check"), faqLdFromQa(FREE_CHECK_FAQ)]} />
      {/* Short header, then the tool straight away: on a phone the website box is on the first screen. The H1 keeps the
          searched phrase. No entrance animation, so it is readable the moment it loads. */}
      <section aria-labelledby="fc-title" className="relative overflow-hidden">
        <div className="container-marketing pb-6 pt-8 text-center sm:pb-8 sm:pt-14">
          <h1 id="fc-title" className="mk-label text-primary">
            Free website SEO checker
          </h1>
          <p className="mx-auto mt-3 max-w-[20ch] text-balance text-[2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-fg sm:text-[2.75rem]">
            Is your website ready for Google and AI?
          </p>
          <p className="mx-auto mt-3 max-w-[30rem] text-[1.0625rem] text-fg-soft">
            Get your free score and top 3 fixes in 30 seconds.
          </p>
        </div>
      </section>
      <section id="fc-tool" aria-label="Run the free check" className="scroll-mt-24 pb-12 sm:pb-16">
        <div className="container-marketing">
          <FreeCheckTool initialUrl={initialUrl} bookHref={bookCallHref()} />
        </div>
      </section>
      {/* Reading matter: in the HTML for everyone, folded away once a result is on screen. */}
      <HideWhenFreeCheckResult>
      <FreeCheckSteps />
      <FreeVsFull />
      <QaSection id="fc-faq" title="Questions about the free check" items={FREE_CHECK_FAQ}>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/appearance/title-link", label: "Google Search Central: how Google writes page titles in results" },
            { href: "https://developers.google.com/search/docs/appearance/snippet", label: "Google Search Central: meta descriptions and snippets" },
            { href: "https://datatracker.ietf.org/doc/html/rfc9309", label: "IETF RFC 9309: Robots Exclusion Protocol (robots.txt)" },
            { href: "https://schema.org/Organization", label: "schema.org: Organization", note: "the business details we look for" },
          ]}
        />
      </QaSection>
      <FreeCheckFinalCta />
      </HideWhenFreeCheckResult>
    </>
  );
}

const starter = PLANS.starter;
const inrN = (n: number) => n.toLocaleString("en-IN");

const FREE_CHECK_FAQ: Qa[] = [
  {
    q: "How does the free website check work?",
    a: (
      <>
        Type your website address and press the button. We read your robots.txt file, your sitemap, your homepage and up to{" "}
        {MAX_KEY_PAGES} main pages linked from it. Then we run the same checks as the full report and show four scores, each
        from 0 to 100, with your top fixes in plain words. It usually takes about half a minute.
      </>
    ),
  },
  {
    q: "What do the four scores mean?",
    a: (
      <>
        SEO shows whether Google can find and show your pages. AEO shows whether your pages answer questions clearly enough
        to be quoted. GEO shows whether AI assistants can read and understand you. Brand shows whether your business details,
        About and Contact pages are easy to trust. Each score runs from 0 to 100.
      </>
    ),
  },
  {
    q: "How is the free check different from the full report?",
    a: (
      <>
        The free check reads a handful of pages and never asks an AI assistant. The full report reads up to{" "}
        {inrN(starter.maxPagesPerCrawl)} pages per check on the {starter.name} plan, and asks {SELF_ENGINE_LIST} your
        customers&apos; real questions. {starter.name} is {inrGst(starter.priceInrMonthly ?? 0)} a month
        after a {TRIAL_DAYS}-day free trial, no card needed.
      </>
    ),
  },
  {
    q: "Is it safe to run the check on my website?",
    a: (
      <>
        Yes. We only read public pages, the same way a search engine does, and we never change anything on your website. We
        respect the rules in your robots.txt file, as described in the{" "}
        <SourceLink href="https://datatracker.ietf.org/doc/html/rfc9309">Robots Exclusion Protocol</SourceLink>, and we do
        not store the pages we read.
      </>
    ),
  },
];
