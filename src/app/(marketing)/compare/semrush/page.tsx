import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, PageHero } from "@/components/marketing/ui";
import { QaSection, SourcesList, type Qa } from "@/components/marketing/answers";
import {
  ChooseSection,
  CompareCta,
  ComparisonTable,
  FactSources,
  HeroButtons,
  PricingSection,
  StrengthsSection,
  TableSection,
  TrademarkNote,
  type Row,
} from "@/components/marketing/compare/compare-ui";
import { OUR, OUR_CELLS } from "@/components/marketing/compare/ours";
import { COMPETITORS } from "@/lib/compare/competitors";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/compare/semrush" as const;
export const metadata: Metadata = staticPageMetadata(PATH);

const SR = COMPETITORS.semrush;

const ROWS: Row[] = [
  { label: "Website audit", cells: [OUR_CELLS.audit, { s: "yes", note: "Site Audit checks hundreds of technical and on-page issues" }] },
  { label: "Backlink database", cells: [OUR_CELLS.backlinks, { s: "yes", note: "43 trillion+ backlinks (their figure)" }] },
  { label: "Keyword research", cells: [OUR_CELLS.keywords, { s: "yes", note: "26 billion+ keywords (their figure)" }] },
  { label: "Rank tracking", cells: [OUR_CELLS.rank, { s: "yes", note: "500 keywords tracked daily on the SEO plan" }] },
  {
    label: "AI answer tracking",
    cells: [OUR_CELLS.ai, { s: "partial", note: "Not in the SEO plan; 50 AI prompts a day on Starter ($199/mo)" }],
  },
  { label: "Plain-English to-do list", cells: [OUR_CELLS.todo, { s: "unknown" }] },
  { label: "Fixes published to your site with approval and undo", cells: [OUR_CELLS.publish, { s: "unknown" }] },
  { label: "Done-for-you service", cells: [OUR_CELLS.service, { s: "unknown" }] },
  { label: "Prices shown in", cells: [OUR_CELLS.currency, { text: "USD", note: "On their pricing page" }] },
  { label: "Starting price", cells: [OUR_CELLS.from, { text: "$139/mo", note: "SEO plan; $117.33/mo billed annually" }] },
  { label: "Free option", cells: [OUR_CELLS.free, { text: "Free plan + 7-day trial", note: "Free plan: 10 reports a day" }] },
];

const FAQ: Qa[] = [
  {
    q: "Is MyWebRank cheaper than Semrush?",
    a: (
      <>
        On list price, yes: MyWebRank starts at {OUR.fromPrice} a month in rupees, and Semrush&apos;s SEO plan is $139 a
        month in US dollars. But they don&apos;t do the same job. Semrush includes keyword, backlink and rank data that
        MyWebRank does not have, so compare what you will actually use.
      </>
    ),
  },
  {
    q: "Does Semrush track ChatGPT answers?",
    a: (
      <>
        Yes. Its Starter plan at $199 a month tracks 50 AI prompts a day, and its help centre lists an AI Visibility
        Toolkit at $99 a month that tracks prompts in ChatGPT and Google AI Mode. MyWebRank includes AI answer tracking in
        every plan, across up to 5 AI assistants.
      </>
    ),
  },
  {
    q: "What does MyWebRank do that Semrush doesn't?",
    a: (
      <>
        We didn&apos;t find approval-gated publishing or a done-for-you service on the Semrush pages we checked. MyWebRank
        sends approved fixes to {OUR.connectors}, saves the old version so you can undo, and offers a monthly service where
        our team makes the fixes for you.
      </>
    ),
  },
  {
    q: "Can I try both for free?",
    a: (
      <>
        Yes. Semrush has a free plan with 10 reports a day and a 7-day trial on paid plans. MyWebRank has a free website
        check with no sign-up, and a {OUR.trialDays}-day trial that includes an AI check and approved fixes.
      </>
    ),
  },
  {
    q: "Who should pick Semrush over MyWebRank?",
    a: (
      <>
        Marketers and agencies who live in keyword and competitor data. If you plan content around search volumes, track
        hundreds of rankings daily or research backlinks, Semrush does that well and MyWebRank does not. If you want a short
        list of fixes and someone to publish them, MyWebRank fits better.
      </>
    ),
  },
];

export default function CompareSemrushPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageLd(PATH),
          faqLdFromQa(FAQ),
          breadcrumbLd([
            { name: "Compare", path: "/compare" },
            { name: "MyWebRank vs Semrush", path: PATH },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Comparison"
        title="MyWebRank vs Semrush"
        intro={
          <p>
            Semrush is a large marketing toolkit with keyword, backlink and rank data, priced in US dollars from $139 a month
            for its SEO plan. AI tracking starts on its $199 Starter plan. MyWebRank is a smaller, simpler tool for Indian
            businesses: a weekly website check, AI answer tracking in every plan, and fixes published to your site only after
            you approve them, from {OUR.fromPrice} a month. Choose Semrush for research depth, MyWebRank for getting fixes done.
          </p>
        }
      >
        <HeroButtons />
      </PageHero>

      <TableSection id="table" title="MyWebRank vs Semrush, feature by feature" competitors={[SR]}>
        <ComparisonTable caption="MyWebRank compared with Semrush" columns={["MyWebRank", "Semrush"]} rows={ROWS} />
      </TableSection>

      <StrengthsSection
        id="strengths"
        theirName="Semrush"
        theirs={[
          "Keyword research from a database of more than 26 billion keywords (their figure). MyWebRank has no keyword database.",
          "Backlink analytics, with more than 43 trillion backlinks in its index (their figure). MyWebRank has none.",
          "Daily rank tracking: 500 keywords on the SEO plan, 1,500 on Pro+.",
          "More websites per plan: 5 on SEO and Starter, 15 on Pro+.",
          "A free plan, plus a 7-day trial on paid plans.",
        ]}
        ours={[
          "A plain-English to-do list, written for owners rather than SEO specialists.",
          `AI answer tracking in every plan from ${OUR.fromPrice} a month, including on our smallest plan.`,
          `Fixes published to ${OUR.connectors} only after your OK, with one-click undo.`,
          `A done-for-you service from ${OUR.serviceFrom} a month: our team makes the fixes and reports monthly.`,
          "Rupee pricing with GST invoices, and support from a team based in India.",
        ]}
      />

      <PricingSection id="pricing" competitors={[SR]}>
        <p>
          Semrush&apos;s cheapest plan with AI tracking is Starter at $199 a month. MyWebRank&apos;s cheapest plan with AI
          tracking is Starter at {OUR.fromPrice} a month, with {OUR.starter.ai.answersPerMonth} AI answers a month. Semrush
          gives you far more research data for the money; MyWebRank gives you fewer, simpler numbers and help fixing them.
        </p>
      </PricingSection>

      <ChooseSection
        id="choose"
        scenarios={[
          { situation: "You run a marketing team that plans content by keyword volume", pick: "Semrush", why: "Its keyword database and rank tracking are the point; MyWebRank has neither." },
          { situation: "You audit backlinks or find link opportunities", pick: "Semrush", why: "It has backlink analytics. MyWebRank does not." },
          {
            situation: "You own a clinic, shop or service business and aren't an SEO person",
            pick: "MyWebRank",
            why: "You get a short to-do list in plain English, and fixes you approve go live on your site.",
          },
          {
            situation: "You mainly want to know whether AI assistants recommend you",
            pick: "MyWebRank",
            why: `AI tracking is in every plan, from ${OUR.fromPrice} a month in rupees.`,
          },
          {
            situation: "You want someone else to do the work",
            pick: "MyWebRank's done-for-you service",
            why: "We make the agreed fixes every month and show you each change. We promise the work, not a ranking.",
          },
          { situation: "You already pay for Semrush", pick: "Semrush, and add MyWebRank if needed", why: "Add MyWebRank only if you want approved fixes published and a plain to-do list." },
        ]}
      />

      <QaSection id="faq" title="MyWebRank vs Semrush: common questions" items={FAQ}>
        <p className="text-body text-fg-soft">
          See all our <Link href="/compare" className="font-medium text-primary underline-offset-4 hover:underline">comparisons</Link>{" "}
          or the full <Link href="/pricing" className="font-medium text-primary underline-offset-4 hover:underline">pricing</Link>.
        </p>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", label: "Google Search Central: SEO Starter Guide" },
            { href: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google Search Central: AI features and your website" },
            { href: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data", label: "Google Search Central: introduction to structured data" },
          ]}
        />
        <FactSources competitors={[SR]} />
      </QaSection>

      <CompareCta />
      <TrademarkNote />
    </>
  );
}
