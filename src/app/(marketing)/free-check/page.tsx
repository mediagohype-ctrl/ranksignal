import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bot, Search, ShieldCheck, Sparkles } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { IconTile, JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { FreeCheckTool } from "@/components/marketing/free-check-tool";
import { SectionHeading } from "@/components/ui";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { MAX_KEY_PAGES } from "@/lib/free-check/run";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const DESCRIPTION = PAGE_SEO["/free-check"].description;

export const metadata: Metadata = staticPageMetadata("/free-check");

const WHAT: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Search />, title: "SEO basics", body: "Your Google headlines and summaries, main headings, secure address (the padlock), and whether your pages can appear on Google." },
  { icon: <Sparkles />, title: "Answer-readiness (AEO)", body: "Whether your pages answer real customer questions clearly enough to be quoted." },
  { icon: <Bot />, title: "AI access (GEO)", body: "Whether the robots of ChatGPT, Perplexity and Claude are allowed in, and whether AI can tell who you are." },
  { icon: <ShieldCheck />, title: "Trust signs", body: "Your business details, About and Contact pages, and links to your social profiles." },
];

export default async function FreeCheckPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
      <PageHero
        eyebrow="Free tool"
        title="Free website SEO checker: is your site ready for Google and AI?"
        intro={
          <p>
            Type your website. We&apos;ll read your homepage and up to four main pages, then score them for SEO, answer
            engines (AEO) and AI assistants (GEO) — with your top 3 fixes, in plain words.
          </p>
        }
      />
      <section aria-label="Run the free check" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing">
          <FreeCheckTool initialUrl={initialUrl} />
        </div>
      </section>
      <Section labelledBy="fc-what" tone="surface">
        <SectionHeading id="fc-what" size="lg" align="center" eyebrow="What we check" title="What the free check looks at" />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHAT.map((w) => (
            <li key={w.title} className="rounded-2xl border border-border bg-bg p-6">
              <IconTile>{w.icon}</IconTile>
              <h3 className="mt-4 text-h4 text-fg">{w.title}</h3>
              <p className="mt-2 text-small leading-relaxed text-muted">{w.body}</p>
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-10 max-w-2xl text-center text-small text-muted">
          This free check reads your website. It does <strong className="font-semibold text-fg">not</strong> ask
          ChatGPT — the full check does, after you sign up. We never store the pages we read.
        </p>
      </Section>
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
        {inrN(starter.maxPagesPerCrawl)} pages per check on the {starter.name} plan, up to{" "}
        {inrN(PLANS.agency.maxPagesPerCrawl)} on Agency, and asks ChatGPT, Gemini and others your customers&apos; real
        questions. Plans start at ₹{inrN(starter.priceInrMonthly ?? 0)} a month after a {TRIAL_DAYS}-day free trial.
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
