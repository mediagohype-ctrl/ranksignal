import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { QaSection, SourcesList, type Qa } from "@/components/marketing/answers";
import {
  ChooseSection,
  CompareCta,
  ComparisonTable,
  FactSources,
  HeroButtons,
  PricingSection,
  TableSection,
  TrademarkNote,
  type Row,
} from "@/components/marketing/compare/compare-ui";
import { OUR, OUR_CELLS } from "@/components/marketing/compare/ours";
import { COMPETITORS, formatFrom } from "@/lib/compare/competitors";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/compare/ahrefs-alternatives" as const;
export const metadata: Metadata = staticPageMetadata(PATH);

const AH = COMPETITORS.ahrefs;
const SR = COMPETITORS.semrush;
const SE = COMPETITORS["se-ranking"];
const UB = COMPETITORS.ubersuggest;
const GSC = COMPETITORS["search-console"];
const ALL = [AH, SR, SE, UB, GSC];

const ROWS: Row[] = [
  {
    label: "Starting price",
    cells: [
      { text: formatFrom(SR), note: "SEO plan" },
      { text: formatFrom(SE), note: "Core" },
      { text: formatFrom(UB), note: "Or $290 lifetime" },
      { text: "Free" },
      OUR_CELLS.from,
    ],
  },
  {
    label: "Free option",
    cells: [
      { text: "Free plan + 7-day trial" },
      { text: "14-day trial" },
      { text: "7-day trial", note: "Monthly plans only" },
      { text: "Free" },
      OUR_CELLS.free,
    ],
  },
  {
    label: "Website audit",
    cells: [
      { s: "yes" },
      { s: "yes", note: "250,000 pages a month on Core" },
      { s: "unknown" },
      { s: "partial", note: "Index coverage and issue alerts from Google" },
      OUR_CELLS.audit,
    ],
  },
  {
    label: "Backlink data",
    cells: [{ s: "yes" }, { s: "yes" }, { s: "unknown" }, { s: "unknown" }, OUR_CELLS.backlinks],
  },
  {
    label: "Keyword research",
    cells: [
      { s: "yes" },
      { s: "yes" },
      { s: "yes", note: "150 searches a day on Individual" },
      { s: "partial", note: "Your own Google Search traffic only" },
      OUR_CELLS.keywords,
    ],
  },
  {
    label: "Rank tracking",
    cells: [
      { s: "yes", note: "500 keywords daily" },
      { s: "yes", note: "2,000 keywords daily" },
      { s: "yes", note: "125 keywords per project" },
      { s: "unknown" },
      OUR_CELLS.rank,
    ],
  },
  {
    label: "AI answer tracking",
    cells: [
      { s: "partial", note: "From the $199 Starter plan" },
      { s: "yes", note: "25 prompts a day" },
      { s: "unknown" },
      { s: "unknown" },
      OUR_CELLS.ai,
    ],
  },
  {
    label: "Fixes published with your approval",
    cells: [{ s: "unknown" }, { s: "unknown" }, { s: "unknown" }, { s: "unknown" }, OUR_CELLS.publish],
  },
  {
    label: "Prices shown in",
    cells: [{ text: "USD" }, { text: "USD" }, { text: "USD", note: "Localised by region" }, { text: "Free" }, OUR_CELLS.currency],
  },
];

const OPTIONS: { name: string; from: string; best: string; body: string }[] = [
  {
    name: "Semrush",
    from: `From ${formatFrom(SR)} (USD)`,
    best: "Best for marketing teams that want the widest keyword and backlink data.",
    body: "Its own figures: 26 billion+ keywords and 43 trillion+ backlinks. AI tracking starts on the $199 Starter plan.",
  },
  {
    name: "SE Ranking",
    from: `From ${formatFrom(SE)} (USD)`,
    best: "Best for agencies and marketers who want rank tracking, backlinks and AI tracking for less than Ahrefs Lite.",
    body: "Core tracks 2,000 keywords a day and includes 25 AI prompts a day. 14-day trial, no credit card.",
  },
  {
    name: "Ubersuggest",
    from: `From ${formatFrom(UB)} (USD), or $290 lifetime`,
    best: "Best for a solo owner who wants basic keyword research on a small budget.",
    body: "Individual covers 1 website and 150 searches a day. Prices are localised by region.",
  },
  {
    name: "Google Search Console",
    from: "Free",
    best: "Best for everyone, as a starting point. Every website owner should set it up.",
    body: "Google's own data on your Search performance and indexing, with email alerts when Google finds problems.",
  },
  {
    name: "MyWebRank",
    from: `From ${OUR.fromPrice}/month (INR)`,
    best: "Best for Indian small businesses that want problems fixed, and to know what AI assistants say about them.",
    body: `A weekly website check, AI answer tracking and fixes after your OK (one-click with undo on WordPress). ${OUR.dfy.name} from ${OUR.serviceFrom} a month if our team should do the work. No backlink, keyword or rank data.`,
  },
];

const FAQ: Qa[] = [
  {
    q: "What is the cheapest alternative to Ahrefs?",
    a: (
      <>
        Google Search Console is free and shows your own Google Search performance. Among paid tools, Ubersuggest starts at
        $29 a month or $290 for a lifetime plan. Ahrefs itself has a free plan and a $29 Starter plan, so check whether those
        cover what you need before you switch.
      </>
    ),
  },
  {
    q: "Which Ahrefs alternative is closest in features?",
    a: (
      <>
        Semrush and SE Ranking. Both offer keyword research, backlink data, rank tracking, a site audit and AI tracking.
        Semrush starts at $139 a month and SE Ranking at $129 a month, both billed in US dollars. MyWebRank and Search Console
        cover only part of what Ahrefs does.
      </>
    ),
  },
  {
    q: "Is there an Ahrefs alternative priced in rupees?",
    a: (
      <>
        MyWebRank is priced in Indian rupees, from {OUR.fromPrice} a month, with GST invoices. Semrush, SE Ranking
        and Ahrefs show US dollar prices on their pricing pages. Ubersuggest says it localises prices by region, so the price
        you see may differ.
      </>
    ),
  },
  {
    q: "Do I still need Google Search Console if I buy a paid tool?",
    a: (
      <>
        Yes. Search Console is Google&apos;s own data about your site, and it is free. Paid tools estimate traffic and
        rankings; Search Console reports what Google actually saw. MyWebRank can read your Search Console data (read-only) to
        add your top queries to its reports.
      </>
    ),
  },
  {
    q: "Which alternative tracks AI answers like ChatGPT?",
    a: (
      <>
        SE Ranking includes 25 AI prompts a day on Core. Semrush includes AI tracking from its $199 Starter plan. MyWebRank
        includes it on {OUR.self.name}: {OUR.engines}, with {OUR.self.ai.answersPerMonth} AI answers a month.
      </>
    ),
  },
];

export default function AhrefsAlternativesPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageLd(PATH),
          faqLdFromQa(FAQ),
          breadcrumbLd([
            { name: "Compare", path: "/compare" },
            { name: "Ahrefs alternatives in India", path: PATH },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Comparison"
        title="Ahrefs alternatives in India"
        intro={
          <p>
            Ahrefs Lite costs $129 a month. The main alternatives are Semrush (from $139/mo) and SE Ranking (from $129/mo) if
            you need similar keyword and backlink data, Ubersuggest (from $29/mo) for basic keyword research, Google Search
            Console (free) for your own Google data, and MyWebRank (from {OUR.fromPrice}/mo, billed in rupees) if you want your
            website fixed and AI answers tracked rather than research data.
          </p>
        }
      >
        <HeroButtons />
      </PageHero>

      <Section labelledBy="options">
        <SectionHeading id="options" size="lg" eyebrow="The options" title="Five alternatives, and who each one suits" />
        <div className="grid gap-4 md:grid-cols-2">
          {OPTIONS.map((o) => (
            <div key={o.name} className="min-w-0 rounded-2xl border border-border bg-surface p-6">
              <h3 className="text-h4 text-fg">{o.name}</h3>
              <p className="mt-1 text-small font-medium text-fg-soft">{o.from}</p>
              <p className="mt-3 text-small font-semibold text-fg">{o.best}</p>
              <p className="mt-2 text-small leading-relaxed text-fg-soft">{o.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <TableSection id="table" title="The alternatives side by side" competitors={ALL}>
        <ComparisonTable
          caption="Ahrefs alternatives compared"
          columns={["Semrush", "SE Ranking", "Ubersuggest", "Search Console", "MyWebRank"]}
          rows={ROWS}
          minWidth="58rem"
        />
      </TableSection>

      <Section labelledBy="ahrefs-good" tone="surface">
        <div className="mx-auto max-w-3xl text-body leading-relaxed text-fg-soft">
          <h2 id="ahrefs-good" className="text-h2 text-fg">
            When to stay with Ahrefs
          </h2>
          <p className="mt-4">
            If backlinks are central to your work, Ahrefs is hard to replace: it says it crawls about 5 million pages a minute.
            It also has a free plan and a $29 Starter plan.
          </p>
          <p className="mt-4">
            Where MyWebRank is better: a plain-English to-do list, AI answer tracking, fixes only after your OK
            (one-click with undo on WordPress), {OUR.dfy.name} at {OUR.serviceFrom} a month with no setup fee, rupee pricing with GST invoices and support
            from India. See{" "}
            <Link href="/compare/ahrefs" className="font-medium text-primary underline-offset-4 hover:underline">
              MyWebRank vs Ahrefs
            </Link>{" "}
            for the full comparison.
          </p>
        </div>
      </Section>

      <PricingSection id="pricing" competitors={[SR, SE, UB, GSC]} maxFacts={2} />

      <ChooseSection
        id="choose"
        scenarios={[
          { situation: "You need Ahrefs-level backlink and keyword data", pick: "Semrush or SE Ranking", why: "Both cover keywords, backlinks, rank tracking and audits." },
          { situation: "You're a solo owner on a tight budget", pick: "Search Console, then Ubersuggest", why: "Start free with Google's own data; add Ubersuggest for keyword ideas." },
          {
            situation: "You want your site fixed, not more reports",
            pick: "MyWebRank",
            why: "Plain-English to-dos, and fixes after your OK: one-click with undo on WordPress, drafts or copy-paste steps elsewhere.",
          },
          {
            situation: "You want to know whether ChatGPT recommends you",
            pick: "MyWebRank or SE Ranking",
            why: `Both include AI tracking in their entry plans; MyWebRank is billed in rupees from ${OUR.fromPrice}.`,
          },
        ]}
      />

      <QaSection id="faq" title="Ahrefs alternatives: common questions" items={FAQ}>
        <SourcesList
          links={[
            { href: "https://support.google.com/webmasters/answer/9128668", label: "Search Console Help: about Search Console" },
            { href: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", label: "Google Search Central: SEO Starter Guide" },
            { href: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google Search Central: AI features and your website" },
          ]}
        />
        <FactSources competitors={ALL} />
      </QaSection>

      <CompareCta />
      <TrademarkNote names={["Ahrefs", "Semrush", "SE Ranking", "Ubersuggest", "Google Search Console"]} />
    </>
  );
}
