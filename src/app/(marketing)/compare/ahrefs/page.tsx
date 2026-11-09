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

const PATH = "/compare/ahrefs" as const;
export const metadata: Metadata = staticPageMetadata(PATH);

const AH = COMPETITORS.ahrefs;

const ROWS: Row[] = [
  { label: "Website audit", cells: [OUR_CELLS.audit, { s: "yes", note: "Site audit; 100,000 crawl credits on Lite" }] },
  { label: "Backlink database", cells: [OUR_CELLS.backlinks, { s: "yes", note: "Live backlink index, updated every 15–30 minutes (their claim)" }] },
  { label: "Keyword research", cells: [OUR_CELLS.keywords, { s: "yes", note: "Own keyword index" }] },
  { label: "Rank tracking", cells: [OUR_CELLS.rank, { s: "yes", note: "750 tracked keywords on Lite, 2,000 on Standard" }] },
  { label: "AI answer tracking", cells: [OUR_CELLS.ai, { s: "partial", note: "150 AI prompt checks on Lite; Brand Radar AI from $199/mo extra" }] },
  { label: "Plain-English to-do list", cells: [OUR_CELLS.todo, { s: "unknown" }] },
  { label: "Fixes published to your site with approval and undo", cells: [OUR_CELLS.publish, { s: "unknown" }] },
  { label: "Done-for-you service", cells: [OUR_CELLS.service, { s: "unknown" }] },
  { label: "Prices shown in", cells: [OUR_CELLS.currency, { text: "USD", note: "On their pricing page" }] },
  { label: "Starting price", cells: [OUR_CELLS.from, { text: "$29/mo", note: "Starter; Lite is $129/mo" }] },
  { label: "Free option", cells: [OUR_CELLS.free, { text: "Free plan", note: "Ahrefs Free" }] },
];

const FAQ: Qa[] = [
  {
    q: "Is MyWebRank a full Ahrefs replacement?",
    a: (
      <>
        No. MyWebRank has no backlink database, no keyword database and no daily rank tracker. If link building or
        keyword research is the core of your work, Ahrefs does that and MyWebRank does not. MyWebRank covers the website
        audit, AI answer tracking and getting fixes published, which many small businesses need first.
      </>
    ),
  },
  {
    q: "Does Ahrefs track AI answers like ChatGPT?",
    a: (
      <>
        Yes. Its Brand Radar tracks ChatGPT, Perplexity, Gemini, Copilot, AI Overviews, AI Mode and Claude. Brand Radar AI
        starts from $199 a month, and Lite includes 150 AI prompt checks. MyWebRank includes AI answer tracking in every
        plan, starting at {OUR.fromPrice} a month.
      </>
    ),
  },
  {
    q: "Can I use Ahrefs and MyWebRank together?",
    a: (
      <>
        Yes, and some teams do. Ahrefs answers &quot;who links to us and which keywords should we target?&quot;. MyWebRank
        answers &quot;what is broken on our site, what do AI assistants say about us, and can someone fix it?&quot;. The two
        overlap mainly on the website audit and AI tracking.
      </>
    ),
  },
  {
    q: "Why does MyWebRank charge in rupees?",
    a: (
      <>
        We are based in India and bill through Razorpay in Indian rupees, with GST invoices for your accounts. Ahrefs shows
        its prices in US dollars on its pricing page. Your bank may add a foreign currency fee on dollar payments, so check
        with them.
      </>
    ),
  },
  {
    q: "Which is easier for a small business owner?",
    a: (
      <>
        MyWebRank is built for owners who are not SEO specialists: every problem becomes a plain-English to-do, and fixes go
        live only after you approve them. Ahrefs is a professional toolkit with far more data, so it suits people who
        already know SEO or have a marketer to use it.
      </>
    ),
  },
];

export default function CompareAhrefsPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageLd(PATH),
          faqLdFromQa(FAQ),
          breadcrumbLd([
            { name: "Compare", path: "/compare" },
            { name: "MyWebRank vs Ahrefs", path: PATH },
          ]),
        ]}
      />
      <PageHero
        eyebrow="Comparison"
        title="MyWebRank vs Ahrefs"
        intro={
          <p>
            Ahrefs is a deep research tool for backlinks, keywords and rank tracking, priced in US dollars from $29 a month.
            MyWebRank is a simpler tool for Indian businesses: it checks your website, tracks what ChatGPT, Gemini and other
            AI assistants say about you in every plan, and publishes fixes to your site only after you approve them. Plans
            start at {OUR.fromPrice} a month. Pick Ahrefs for link and keyword research; pick MyWebRank to get problems
            found and fixed.
          </p>
        }
      >
        <HeroButtons />
      </PageHero>

      <TableSection id="table" title="MyWebRank vs Ahrefs, feature by feature" competitors={[AH]}>
        <ComparisonTable caption="MyWebRank compared with Ahrefs" columns={["MyWebRank", "Ahrefs"]} rows={ROWS} />
      </TableSection>

      <StrengthsSection
        id="strengths"
        theirName="Ahrefs"
        theirs={[
          "Backlink research. Ahrefs says it crawls about 5 million pages a minute and runs a live backlink index. MyWebRank has no backlink data.",
          "Keyword research and rank tracking, with 750 tracked keywords even on Lite. MyWebRank only reads your own Search Console queries.",
          "Longer history on bigger plans: 2 years of data on Standard and 5 years on Advanced.",
          "AI tracking across more places, including Copilot, AI Overviews and AI Mode, if you pay for Brand Radar.",
          "A free plan with no time limit.",
        ]}
        ours={[
          "A plain-English to-do list instead of raw data, so an owner can act without an SEO background.",
          `AI answer tracking included in every plan, from ${OUR.fromPrice} a month, with no add-on to buy.`,
          `Fixes published to your site (${OUR.connectors}) only after your OK, with one-click undo.`,
          `A done-for-you service from ${OUR.serviceFrom} a month if you'd rather we did the work.`,
          "Prices in rupees with GST invoices, and support from a team based in India.",
        ]}
      />

      <PricingSection id="pricing" competitors={[AH]}>
        <p>
          Like for like, the comparison is not exact. Ahrefs Lite at $129 a month buys deep link and keyword data for one
          user. MyWebRank Starter at {OUR.fromPrice} a month buys a weekly website check of up to{" "}
          {OUR.starter.limits.maxPagesPerCrawl} pages, {OUR.starter.ai.answersPerMonth} AI answers a month and approved fixes
          for one website, for {OUR.starter.limits.seats} team members.
        </p>
      </PricingSection>

      <ChooseSection
        id="choose"
        scenarios={[
          { situation: "You build links or do outreach for a living", pick: "Ahrefs", why: "Backlink data is the job, and MyWebRank doesn't have it." },
          { situation: "You plan content around keyword volumes", pick: "Ahrefs", why: "It has a keyword index and rank tracking; MyWebRank doesn't." },
          {
            situation: "You run a local business and want to know what to fix first",
            pick: "MyWebRank",
            why: "You get a short, ranked to-do list in plain English, and fixes you approve go straight to your site.",
          },
          {
            situation: "You want to know if ChatGPT recommends you, on a small budget",
            pick: "MyWebRank",
            why: `AI answer tracking is in every plan from ${OUR.fromPrice} a month, billed in rupees.`,
          },
          {
            situation: "You have no time to do SEO yourself",
            pick: "MyWebRank's done-for-you service",
            why: "Our team makes the agreed fixes each month and reports what changed. We never promise a ranking.",
          },
          {
            situation: "You have an SEO team and a bigger budget",
            pick: "both",
            why: "Ahrefs for research, MyWebRank for AI answer tracking and approved fixes.",
          },
        ]}
      />

      <QaSection id="faq" title="MyWebRank vs Ahrefs: common questions" items={FAQ}>
        <p className="text-body text-fg-soft">
          See all our <Link href="/compare" className="font-medium text-primary underline-offset-4 hover:underline">comparisons</Link>{" "}
          or the full <Link href="/pricing" className="font-medium text-primary underline-offset-4 hover:underline">pricing</Link>.
        </p>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", label: "Google Search Central: SEO Starter Guide", note: "what a website audit should cover" },
            { href: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google Search Central: AI features and your website" },
            { href: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data", label: "Google Search Central: introduction to structured data" },
          ]}
        />
        <FactSources competitors={[AH]} />
      </QaSection>

      <CompareCta />
      <TrademarkNote />
    </>
  );
}
