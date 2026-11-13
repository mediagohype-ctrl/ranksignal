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

const PATH = "/compare/se-ranking" as const;
export const metadata: Metadata = staticPageMetadata(PATH);

const SE = COMPETITORS["se-ranking"];

const ROWS: Row[] = [
  { label: "Website audit", cells: [OUR_CELLS.audit, { s: "yes", note: "250,000 audited pages a month on Core" }] },
  { label: "Backlink database", cells: [OUR_CELLS.backlinks, { s: "yes", note: "Backlink checker" }] },
  { label: "Keyword research", cells: [OUR_CELLS.keywords, { s: "yes", note: "5.5 billion keywords, 188 country databases (their figures)" }] },
  { label: "Rank tracking", cells: [OUR_CELLS.rank, { s: "yes", note: "2,000 keywords tracked daily on Core" }] },
  { label: "AI answer tracking", cells: [OUR_CELLS.ai, { s: "yes", note: "25 prompts a day across 5 AI engines on Core and Growth; more from $71/mo" }] },
  { label: "Plain-English to-do list", cells: [OUR_CELLS.todo, { s: "unknown" }] },
  { label: "Fixes published to your site with approval and undo", cells: [OUR_CELLS.publish, { s: "unknown" }] },
  { label: "Done-for-you service", cells: [OUR_CELLS.service, { s: "unknown" }] },
  { label: "Prices shown in", cells: [OUR_CELLS.currency, { text: "USD", note: "On their pricing page" }] },
  { label: "Starting price", cells: [OUR_CELLS.from, { text: "$129/mo", note: "Core; $103.20/mo billed annually" }] },
  { label: "Free option", cells: [OUR_CELLS.free, { text: "14-day trial", note: "No credit card required" }] },
];

const FAQ: Qa[] = [
  {
    q: "Is SE Ranking or MyWebRank better for a small business?",
    a: (
      <>
        It depends on who does the work. SE Ranking gives you more data for the money, including rank tracking and backlinks,
        from $129 a month. MyWebRank gives you a shorter, plain-English to-do list and fixes after your OK, from{" "}
        {OUR.fromPrice} a month. If you have a marketer, SE Ranking; if you don&apos;t, MyWebRank.
      </>
    ),
  },
  {
    q: "Do both track AI answers?",
    a: (
      <>
        Yes. SE Ranking&apos;s Core and Growth plans include 25 AI prompts a day across 5 AI engines, with an add-on from $71
        a month for more. MyWebRank includes AI answer tracking on {OUR.self.name}: {OUR.engines}, with{" "}
        {OUR.self.ai.answersPerMonth.toLocaleString("en-IN")} AI answers a month.
      </>
    ),
  },
  {
    q: "Which has the longer free trial?",
    a: (
      <>
        SE Ranking offers 14 days with no credit card. MyWebRank offers {OUR.trialDays} days, plus a free website check you
        can run without signing up. Both are enough to see the main problems on a small website before you pay.
      </>
    ),
  },
  {
    q: "Can MyWebRank replace SE Ranking for an agency?",
    a: (
      <>
        Only partly. For agencies we offer a {OUR.custom.name} plan (many websites, reports with your logo, AI
        tracking), priced after a conversation, but it has no rank tracker or backlink data. Agencies that report rankings to clients will still need a tool like SE
        Ranking for that part.
      </>
    ),
  },
  {
    q: "How are MyWebRank fixes published?",
    a: (
      <>
        {OUR.publishing}. Every change waits for your OK. On WordPress the old version is saved
        first, and you can undo it in one click. On GitHub, changes arrive as pull requests for your developer to review.
      </>
    ),
  },
];

export default function CompareSeRankingPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageLd(PATH),
          faqLdFromQa(FAQ),
          breadcrumbLd([
            { name: "Compare", path: "/compare" },
            { name: "MyWebRank vs SE Ranking", path: PATH },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Comparison"
        title="MyWebRank vs SE Ranking"
        intro={
          <p>
            SE Ranking is an all-round SEO platform with rank tracking, keyword research, backlinks, a site audit and AI
            tracking, priced in US dollars from $129 a month. MyWebRank is narrower and simpler: a weekly website check, AI
            answer tracking, and fixes only after you approve them (one-click with undo on WordPress), from{" "}
            {OUR.fromPrice} a month in rupees. SE Ranking suits marketers who want data; MyWebRank suits owners who want fixes.
          </p>
        }
      >
        <HeroButtons />
      </PageHero>

      <TableSection id="table" title="MyWebRank vs SE Ranking, feature by feature" competitors={[SE]}>
        <ComparisonTable caption="MyWebRank compared with SE Ranking" columns={["MyWebRank", "SE Ranking"]} rows={ROWS} />
      </TableSection>

      <StrengthsSection
        id="strengths"
        theirName="SE Ranking"
        theirs={[
          "Rank tracking: 2,000 keywords a day on Core and 5,000 on Growth. MyWebRank has no rank tracker.",
          "Keyword research and a backlink checker. MyWebRank has neither.",
          "Bigger audits: 250,000 pages a month on Core, 2 million on Growth.",
          "More projects per plan: 10 on Core, 30 on Growth.",
          "A 14-day free trial with no credit card.",
        ]}
        ours={[
          "A plain-English to-do list, sorted by impact and effort, so you know what to do first.",
          `AI answer tracking included in ${OUR.self.name} at ${OUR.fromPrice} a month.`,
          `${OUR.publishing}, only after your OK.`,
          `${OUR.dfy.name} at ${OUR.serviceFrom} a month, with no setup fee, if you'd rather not do it yourself.`,
          "Rupee pricing with GST invoices, and support from a team based in India.",
        ]}
      />

      <PricingSection id="pricing" competitors={[SE]}>
        <p>
          SE Ranking Core and MyWebRank {OUR.self.name} both include AI tracking. Core costs $129 a month and adds rank
          tracking, keywords and backlinks. {OUR.self.name} costs {OUR.fromPrice} a month, covers one website and adds approved fixes and a
          plain-English to-do list.
        </p>
      </PricingSection>

      <ChooseSection
        id="choose"
        scenarios={[
          { situation: "You report keyword rankings to clients every week", pick: "SE Ranking", why: "Daily rank tracking is built in; MyWebRank has none." },
          { situation: "You need keyword ideas and backlink data in one place", pick: "SE Ranking", why: "It has both. MyWebRank has neither." },
          {
            situation: "You own one business website and want a clear list of what to fix",
            pick: "MyWebRank",
            why: "Plain-English to-dos, and fixes after your OK: one-click with undo on WordPress, copy-paste steps elsewhere.",
          },
          {
            situation: "You want to pay in rupees with a GST invoice",
            pick: "MyWebRank",
            why: "We bill in INR with GST invoices. SE Ranking lists prices in US dollars.",
          },
          {
            situation: "You'd rather hand the work to a team",
            pick: `MyWebRank ${OUR.dfy.name}`,
            why: `Our team does the work for ${OUR.serviceFrom} a month, with no setup fee, and reports what changed.`,
          },
          { situation: "You're an agency with both needs", pick: "both", why: "SE Ranking for rankings and links, MyWebRank for AI tracking and approved fixes." },
        ]}
      />

      <QaSection id="faq" title="MyWebRank vs SE Ranking: common questions" items={FAQ}>
        <p className="text-body text-fg-soft">
          See all our <Link href="/compare" className="font-medium text-primary underline-offset-4 hover:underline">comparisons</Link>{" "}
          or the full <Link href="/pricing" className="font-medium text-primary underline-offset-4 hover:underline">pricing</Link>.
        </p>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", label: "Google Search Central: SEO Starter Guide" },
            { href: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google Search Central: AI features and your website" },
            { href: "https://support.google.com/webmasters/answer/9128668", label: "Search Console Help: about Search Console" },
          ]}
        />
        <FactSources competitors={[SE]} />
      </QaSection>

      <CompareCta />
      <TrademarkNote />
    </>
  );
}
