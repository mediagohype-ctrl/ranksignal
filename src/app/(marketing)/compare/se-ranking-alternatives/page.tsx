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

const PATH = "/compare/se-ranking-alternatives" as const;
export const metadata: Metadata = staticPageMetadata(PATH);

const SE = COMPETITORS["se-ranking"];
const SR = COMPETITORS.semrush;
const AH = COMPETITORS.ahrefs;
const UB = COMPETITORS.ubersuggest;
const GSC = COMPETITORS["search-console"];
const ALL = [SE, SR, AH, UB, GSC];

const LINK = "font-medium text-primary underline-offset-4 hover:underline";

const ROWS: Row[] = [
  {
    label: "Starting price",
    cells: [
      { text: formatFrom(SR), note: "SEO plan" },
      { text: formatFrom(AH), note: "Starter; Lite is $129/mo" },
      { text: formatFrom(UB), note: "Or $290 lifetime" },
      { text: "Free" },
      OUR_CELLS.from,
    ],
  },
  {
    label: "Free option",
    cells: [
      { text: "Free plan + 7-day trial" },
      { text: "Free plan", note: "Ahrefs Free" },
      { text: "7-day trial", note: "Monthly plans only" },
      { text: "Free" },
      OUR_CELLS.free,
    ],
  },
  {
    label: "Website audit",
    cells: [
      { s: "yes" },
      { s: "yes", note: "100,000 crawl credits on Lite" },
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
      { s: "yes", note: "26 billion+ keywords (their figure)" },
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
      { s: "yes", note: "750 keywords on Lite" },
      { s: "yes", note: "125 keywords per project" },
      { s: "unknown" },
      OUR_CELLS.rank,
    ],
  },
  {
    label: "AI answer tracking",
    cells: [
      { s: "partial", note: "From the $199 Starter plan" },
      { s: "partial", note: "150 AI prompt checks on Lite; Brand Radar AI from $199/mo" },
      { s: "unknown" },
      { s: "unknown" },
      OUR_CELLS.ai,
    ],
  },
  {
    label: "Ready-to-paste fixes, or a team that makes them",
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
    body: "Its own figures: 26 billion+ keywords and 43 trillion+ backlinks. AI tracking starts on the $199 Starter plan. A limited free plan gives 10 reports a day.",
  },
  {
    name: "Ahrefs",
    from: `From ${formatFrom(AH)} (USD); Lite $129/mo`,
    best: "Best for SEO professionals whose work centres on backlinks.",
    body: "Ahrefs says it crawls about 5 million pages a minute and runs a live backlink index. It has a free plan, and its Brand Radar tracks AI answers from $199 a month.",
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
    best: "Best for Indian small businesses that want plain-English fixes and to know what ChatGPT, Gemini and Perplexity say about them.",
    body: `A weekly website check, AI answer tracking and ready-to-paste fixes with step-by-step help. ${OUR.dfy.name} from ${OUR.serviceFrom} a month if our team should do the work. No backlink, keyword or rank data.`,
  },
];

const FAQ: Qa[] = [
  {
    q: "What is the best SE Ranking alternative in India?",
    a: (
      <>
        It depends on the job. For deeper keyword and backlink data, Semrush and Ahrefs are the closest, both priced in US
        dollars. For an Indian small business that wants its website fixed and its AI visibility tracked, MyWebRank costs{" "}
        {OUR.fromPrice} a month in rupees. Google Search Console is free and worth setting up whichever you choose.
      </>
    ),
  },
  {
    q: "What is a cheaper alternative to SE Ranking?",
    a: (
      <>
        SE Ranking Core is $129 a month, or $103.20 a month billed annually. Google Search Console is free. Ahrefs Starter
        and Ubersuggest Individual both start at $29 a month, and Ubersuggest also sells a $290 lifetime plan. The cheaper
        options do less, so check the table above for what each one covers.
      </>
    ),
  },
  {
    q: "Is there a free SE Ranking alternative?",
    a: (
      <>
        Yes. Google Search Console is free and shows your own Google Search traffic, index coverage and issue alerts. It has
        no backlink or keyword database. Semrush and Ahrefs both have limited free plans, and our{" "}
        <Link href="/free-check">free website check</Link> needs no sign-up.
      </>
    ),
  },
  {
    q: "Is there an SE Ranking alternative priced in rupees?",
    a: (
      <>
        MyWebRank is priced in Indian rupees, from {OUR.fromPrice} a month, with GST invoices. SE Ranking, Semrush and Ahrefs
        show US dollar prices on their pricing pages. Ubersuggest says it localises prices by region, so the price you see
        may differ.
      </>
    ),
  },
  {
    q: "Which SE Ranking alternative tracks AI answers like ChatGPT?",
    a: (
      <>
        Semrush includes AI tracking from its $199 Starter plan. Ahrefs Lite includes 150 AI prompt checks, and Brand Radar
        AI starts from $199 a month. MyWebRank includes it on {OUR.self.name}: {OUR.engines}, with{" "}
        {OUR.self.ai.answersPerMonth} AI answers a month. SE Ranking itself includes 25 AI prompts a day on Core.
      </>
    ),
  },
];

export default function SeRankingAlternativesPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageLd(PATH),
          faqLdFromQa(FAQ),
          breadcrumbLd([
            { name: "Compare", path: "/compare" },
            { name: "SE Ranking alternatives in India", path: PATH },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Comparison"
        title="Best SE Ranking alternatives in India"
        intro={
          <p>
            SE Ranking Core costs $129 a month. The main alternatives are Semrush (from $139/mo) and Ahrefs (from $29/mo,
            Lite $129/mo) if you need deeper keyword and backlink data, Ubersuggest (from $29/mo) for basic keyword research,
            Google Search Console (free) for your own Google data, and MyWebRank (from {OUR.fromPrice}/mo, billed in rupees) if
            you want your website fixed and your AI visibility tracked rather than research data.
          </p>
        }
      >
        <HeroButtons />
      </PageHero>

      <Section labelledBy="options">
        <SectionHeading id="options" size="lg" eyebrow="The options" title="Five SE Ranking alternatives, and who each one suits" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

      <TableSection id="table" title="SE Ranking alternatives side by side" competitors={ALL}>
        <ComparisonTable
          caption="SE Ranking alternatives compared"
          columns={["Semrush", "Ahrefs", "Ubersuggest", "Search Console", "MyWebRank"]}
          rows={ROWS}
          minWidth="58rem"
        />
      </TableSection>

      <Section labelledBy="ser-good" tone="surface">
        <div className="mx-auto max-w-3xl text-body leading-relaxed text-fg-soft">
          <h2 id="ser-good" className="text-h2 text-fg">
            When to stay with SE Ranking
          </h2>
          <p className="mt-4">
            If you are an agency or marketer who wants rank tracking, backlinks, a site audit and AI tracking in one plan, SE
            Ranking covers all of that in its entry plan. Core tracks 2,000 keywords a day, audits 250,000 pages a month
            and includes 25 AI prompts a day, and SE Ranking lists 188 country databases.
          </p>
          <p className="mt-4">
            Where MyWebRank is better for a small business: a plain-English to-do list, ready-to-paste fixes with
            step-by-step help, {OUR.dfy.name} at {OUR.serviceFrom} a month with no setup fee, and rupee pricing with GST
            invoices. See{" "}
            <Link href="/compare/se-ranking" className={LINK}>
              MyWebRank vs SE Ranking
            </Link>{" "}
            for the full comparison.
          </p>
        </div>
      </Section>

      <Section labelledBy="ai-visibility">
        <div className="mx-auto max-w-3xl text-body leading-relaxed text-fg-soft">
          <h2 id="ai-visibility" className="text-h2 text-fg">
            If AI visibility is why you are looking
          </h2>
          <p className="mt-4">
            SE Ranking already tracks AI answers on Core, so if that is all you need it may be enough. If you would rather see
            what ChatGPT, Gemini and Perplexity say about your business in plain words, with fixes attached, try the free{" "}
            <Link href="/tools/ai-visibility-checker" className={LINK}>
              AI visibility checker
            </Link>
            , read how{" "}
            <Link href="/features/ai-visibility-tracking" className={LINK}>
              AI visibility tracking
            </Link>{" "}
            works in MyWebRank, or compare the{" "}
            <Link href="/learn/best-ai-visibility-tools" className={LINK}>
              best AI visibility tools
            </Link>
            .
          </p>
          <p className="mt-4">
            Also weighing Semrush or Ahrefs? See{" "}
            <Link href="/compare/semrush" className={LINK}>
              MyWebRank vs Semrush
            </Link>{" "}
            and{" "}
            <Link href="/compare/ahrefs-alternatives" className={LINK}>
              Ahrefs alternatives in India
            </Link>
            .
          </p>
        </div>
      </Section>

      <PricingSection id="pricing" competitors={[SR, AH, UB, GSC]} maxFacts={2}>
        <p>
          SE Ranking Core is $129 a month, or $103.20 a month billed annually. MyWebRank&apos;s full price list is on the{" "}
          <Link href="/pricing" className={LINK}>
            pricing page
          </Link>
          .
        </p>
      </PricingSection>

      <ChooseSection
        id="choose"
        scenarios={[
          {
            situation: "You need deeper backlink and keyword data",
            pick: "Semrush or Ahrefs",
            why: "Both cover keywords, backlinks, rank tracking and audits, billed in US dollars.",
          },
          { situation: "You're a solo owner on a tight budget", pick: "Search Console, then Ubersuggest", why: "Start free with Google's own data; add Ubersuggest for keyword ideas." },
          {
            situation: "You want your site fixed, not more reports",
            pick: "MyWebRank",
            why: "Plain-English to-dos, and ready-to-paste fixes for any website, with step-by-step help.",
          },
          {
            situation: "You want AI visibility tracking billed in rupees",
            pick: "MyWebRank",
            why: `${OUR.engines} on ${OUR.self.name}, from ${OUR.fromPrice} a month with GST invoices.`,
          },
        ]}
      />

      <QaSection id="faq" title="SE Ranking alternatives: common questions" items={FAQ}>
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
      <TrademarkNote names={["SE Ranking", "Semrush", "Ahrefs", "Ubersuggest", "Google Search Console"]} />
    </>
  );
}
