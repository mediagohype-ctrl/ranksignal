import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { SectionHeading } from "@/components/ui";
import { GuideMaker } from "../_components/guide-maker";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, type Qa } from "@/components/marketing/answers";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/ai-guide-file-maker" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;

export const metadata: Metadata = staticPageMetadata(PATH);

const HOW = [
  { q: "What is an AI guide file?", a: "A short text file on your website (yoursite.com/llms.txt) that tells AI tools what your business does and which pages to read first. Experts call it llms.txt." },
  { q: "Where do I put it?", a: "Upload it to the main folder of your website, next to your home page. Your web person or hosting file manager can do it in a minute." },
  { q: "Will AI tools use it?", a: "Some AI tools read it today and more are starting to. It's free, takes two minutes and does no harm." },
];

export default function AiGuideFileMakerPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "AI guide file maker",
            url: `${base}${PATH}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          },
          // One FAQPage for every visible Q&A block on the page.
          faqLdFromQa([...HOW, ...MORE]),
          webPageLd(PATH, { base }),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: "llms.txt generator", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free tool"
        title="Free llms.txt generator: make an AI guide file for your website"
        intro={<p>Tell ChatGPT and other AI tools who you are and which pages matter. Fill in the boxes, then download your file.</p>}
      />
      <section aria-label="Make your AI guide file" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <GuideMaker />
          <LeadBox tool="ai-guide-file-maker" />
        </div>
      </section>
      <Section labelledBy="guide-how" tone="surface">
        <SectionHeading id="guide-how" size="lg" align="center" eyebrow="Questions" title="How it works" />
        <dl className="mx-auto max-w-3xl space-y-6">
          {HOW.map((h) => (
            <div key={h.q}>
              <dt className="text-h4 text-fg">{h.q}</dt>
              <dd className="mt-1 text-small leading-relaxed text-muted">{h.a}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <QaSection id="guide-more" title="What to put in your AI guide file" items={MORE}>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google Search Central: AI features and your website" },
            { href: "https://developers.google.com/search/docs/crawling-indexing/robots/intro", label: "Google Search Central: introduction to robots.txt" },
            { href: "https://datatracker.ietf.org/doc/html/rfc9309", label: "IETF RFC 9309: Robots Exclusion Protocol" },
          ]}
        />
      </QaSection>
    </>
  );
}

const MORE: Qa[] = [
  {
    q: "What should an llms.txt file include?",
    a: "Your business name, one sentence on what you do, for whom and where, a few key facts such as areas served and opening hours, and links to your most useful pages with a one-line note each. This maker lets you list up to 50 pages and write a summary of up to 500 characters.",
  },
  {
    q: "Where did llms.txt come from?",
    a: "The llms.txt format was proposed in September 2024 as a simple way for websites to point AI tools at their most useful pages. It is a community proposal, not an official standard, so no AI company has promised to read it. That is why we call it a low-cost extra, not a must-have.",
  },
  {
    q: "Is llms.txt the same as robots.txt?",
    a: "No. robots.txt decides which robots may read your pages, and it is an official standard published in 2022 as RFC 9309. llms.txt only suggests what to read first. If your robots.txt blocks AI robots, an llms.txt file will not help, so check your robots.txt rules before anything else.",
  },
  {
    q: "Do I need llms.txt to appear in Google's AI answers?",
    a: "No. Google says you do not need special AI files or markup to appear in its AI features; normal search rules apply. Being crawlable, indexable and genuinely helpful matters far more. An AI guide file is a small extra that may help other AI tools understand your business.",
  },
];
