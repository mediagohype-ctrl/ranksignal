import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/ui";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { QaSection, SourcesList, type Qa } from "@/components/marketing/answers";
import { CheckedOn, CompareCta, ComparisonTable, HeroButtons, TrademarkNote, type Row } from "@/components/marketing/compare/compare-ui";
import { OUR, OUR_CELLS } from "@/components/marketing/compare/ours";
import { BRAND } from "@/lib/brand";
import { COMPARE_PAGES, COMPETITORS, formatFrom } from "@/lib/compare/competitors";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/compare" as const;
export const metadata: Metadata = staticPageMetadata(PATH);

const AH = COMPETITORS.ahrefs;
const SR = COMPETITORS.semrush;
const SE = COMPETITORS["se-ranking"];

const SUMMARY: Record<(typeof COMPARE_PAGES)[number]["path"], string> = {
  "/compare/ahrefs": "Ahrefs leads on backlinks and keyword data. MyWebRank is simpler, tracks AI answers and fixes problems only after you approve them.",
  "/compare/semrush": "Semrush is a large marketing toolkit with keyword, backlink and rank data. MyWebRank focuses on fixes, AI answers and rupee pricing.",
  "/compare/se-ranking": "SE Ranking packs rank tracking, backlinks and AI tracking into one plan. MyWebRank adds approved fixes and a done-for-you service.",
  "/compare/ahrefs-alternatives": "Semrush, SE Ranking, Ubersuggest, Google Search Console and MyWebRank, with who each one suits.",
};

const ROWS: Row[] = [
  { label: "Starting price", cells: [OUR_CELLS.from, { text: formatFrom(AH) }, { text: formatFrom(SR) }, { text: formatFrom(SE) }] },
  {
    label: "AI answer tracking",
    cells: [
      { s: "yes", note: "Every plan" },
      { s: "partial", note: "Limited checks; Brand Radar AI from $199/mo" },
      { s: "partial", note: "From the $199 Starter plan" },
      { s: "yes", note: "25 prompts a day on Core" },
    ],
  },
  { label: "Backlinks, keywords, rank tracking", cells: [{ s: "no" }, { s: "yes" }, { s: "yes" }, { s: "yes" }] },
  { label: "Fixes published with approval and undo", cells: [{ s: "yes" }, { s: "unknown" }, { s: "unknown" }, { s: "unknown" }] },
  { label: "Prices shown in", cells: [{ text: "INR" }, { text: "USD" }, { text: "USD" }, { text: "USD" }] },
];

const FAQ: Qa[] = [
  {
    q: "Why does MyWebRank publish comparisons with other tools?",
    a: (
      <>
        Because people ask us how we differ, and an honest answer saves everyone time. Each page says where the other tool
        is stronger, where {BRAND.name} is stronger, and links every competitor fact to the competitor&apos;s own page so you
        can check it.
      </>
    ),
  },
  {
    q: "How often are these prices checked?",
    a: (
      <>
        We read each competitor&apos;s own pricing page and note the date on every comparison. Prices and plans change
        often, so always confirm on their site before buying. We show their prices in their own currency, US dollars, and
        never convert them to rupees.
      </>
    ),
  },
  {
    q: "What does MyWebRank not do?",
    a: (
      <>
        It has no backlink database, no keyword database and no daily rank tracker. It focuses on a weekly website check, AI
        answer tracking across {OUR.engines}, a plain-English to-do list, and fixes after your OK: one-click with undo on
        WordPress, drafts or copy-paste steps for Shopify, Wix and Webflow.
      </>
    ),
  },
  {
    q: "Can I try MyWebRank before deciding?",
    a: (
      <>
        Yes. The <Link href="/free-check">free check</Link> needs no sign-up. The{" "}
        {OUR.trialDays}-day free trial adds an AI check and approved fixes. After that, {OUR.self.name} costs {OUR.fromPrice} a
        month, or {OUR.dfy.name} costs {OUR.serviceFrom} a month if you want our team to do the work.
      </>
    ),
  },
];

export default function ComparePage() {
  return (
    <>
      <JsonLd
        data={[
          webPageLd(PATH, {
            type: "CollectionPage",
            extra: {
              mainEntity: {
                "@type": "ItemList",
                itemListElement: COMPARE_PAGES.map((p, i) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  name: p.label,
                  url: `${BRAND.appUrl.replace(/\/$/, "")}${p.path}`,
                })),
              },
            },
          }),
          faqLdFromQa(FAQ),
          breadcrumbLd([{ name: "Compare", path: PATH }]),
        ]}
      />
      <PageHero
        eyebrow="Compare"
        title="How MyWebRank compares with other SEO tools"
        intro={
          <p>
            Ahrefs, Semrush and SE Ranking are bigger research tools with backlink, keyword and rank data that MyWebRank does
            not have. MyWebRank is a simpler tool for Indian businesses: a weekly website check, AI answer tracking, and
            fixes only after you approve them (one-click with undo on WordPress), from {OUR.fromPrice} a month in rupees. Each
            comparison below says honestly where the other tool is better.
          </p>
        }
      >
        <HeroButtons />
      </PageHero>

      <Section labelledBy="comparisons">
        <SectionHeading id="comparisons" size="lg" eyebrow="Comparisons" title="Pick a comparison" />
        <ul className="grid gap-4 md:grid-cols-2">
          {COMPARE_PAGES.map((p) => (
            <li key={p.path} className="min-w-0">
              <Link
                href={p.path}
                className="group block h-full rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-border-strong"
              >
                <span className="flex items-center justify-between gap-3 text-h4 text-fg">
                  {p.label}
                  <ArrowRight aria-hidden size={18} className="shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-2 block text-small leading-relaxed text-fg-soft">{SUMMARY[p.path]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="glance" tone="surface">
        <SectionHeading id="glance" size="lg" eyebrow="At a glance" title="The short version" />
        <ComparisonTable caption="MyWebRank, Ahrefs, Semrush and SE Ranking at a glance" columns={["MyWebRank", "Ahrefs", "Semrush", "SE Ranking"]} rows={ROWS} minWidth="44rem" />
        <p className="mt-4 text-caption leading-relaxed text-muted">
          &quot;Not listed&quot; means we could not confirm it on the competitor&apos;s own pages. <CheckedOn competitors={[AH, SR, SE]} />
        </p>
      </Section>

      <QaSection id="faq" title="About these comparisons" items={FAQ}>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", label: "Google Search Central: SEO Starter Guide" },
            { href: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google Search Central: AI features and your website" },
          ]}
        />
      </QaSection>

      <CompareCta />
      <TrademarkNote />
    </>
  );
}
