import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { SectionHeading } from "@/components/ui";
import { FaqMaker } from "../_components/faq-maker";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { FAQ_MAX_ITEMS } from "@/lib/growth/tools";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/faq-markup-maker" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;

export const metadata: Metadata = staticPageMetadata(PATH);

const HOW = [
  { q: "What is this code?", a: "It's a small hidden note on your page that lists your questions and answers in a format Google and AI tools read easily. Visitors don't see it." },
  { q: "Where do I paste it?", a: "On the same page that shows these questions and answers. In WordPress, add a \"Custom HTML\" block and paste it there." },
  { q: "Does it cost anything?", a: "No. The tool is free and runs in your browser. We don't save what you type." },
];

export default function FaqMarkupMakerPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "FAQ schema generator",
            url: `${base}${PATH}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          },
          // One FAQPage for every visible Q&A block on the page.
          faqLdFromQa([...HOW, ...MORE]),
          webPageLd(PATH, { base }),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: "FAQ schema generator", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free tool"
        title="Free FAQ schema generator: info for Google and AI"
        intro={<p>Type the questions customers ask and your answers. Copy the code onto your page so Google and AI tools can quote you.</p>}
      />
      <section aria-label="Make your FAQ code" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <FaqMaker />
          <LeadBox tool="faq-markup-maker" />
        </div>
      </section>
      <Section labelledBy="faq-how" tone="surface">
        <SectionHeading id="faq-how" size="lg" align="center" eyebrow="Questions" title="How it works" />
        <dl className="mx-auto max-w-3xl space-y-6">
          {HOW.map((h) => (
            <div key={h.q}>
              <dt className="text-h4 text-fg">{h.q}</dt>
              <dd className="mt-1 text-small leading-relaxed text-muted">{h.a}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Section labelledBy="faq-steps">
        <div className="mx-auto max-w-3xl text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          <h2 id="faq-steps" className="text-h2 text-fg">
            How to use the FAQ code maker
          </h2>
          <ol className="mt-6 list-decimal space-y-3 pl-5">
            <li>Pick one page, such as your services or pricing page, and list the questions customers really ask about it.</li>
            <li>
              Type each question and a short, direct answer. You can add up to {FAQ_MAX_ITEMS} questions, each question can be
              up to 300 characters and each answer up to 2,000 characters.
            </li>
            <li>Show the same questions and answers as visible text on that page. The code must match what visitors can read.</li>
            <li>Copy the code and paste it into that page, for example in a WordPress &quot;Custom HTML&quot; block.</li>
            <li>
              Test the page with Google&apos;s{" "}
              <SourceLink href="https://search.google.com/test/rich-results">Rich Results Test</SourceLink> or the{" "}
              <SourceLink href="https://validator.schema.org/">Schema Markup Validator</SourceLink> to confirm the code reads
              correctly.
            </li>
          </ol>
        </div>
      </Section>
      <QaSection id="faq-more" tone="surface" title="FAQ code: what it does and does not do" items={MORE}>
        <SourcesList
          links={[
            { href: "https://schema.org/FAQPage", label: "schema.org: FAQPage", note: "the vocabulary this tool writes" },
            { href: "https://developers.google.com/search/docs/appearance/structured-data/faqpage", label: "Google Search Central: FAQ (FAQPage) structured data" },
            { href: "https://developers.google.com/search/blog/2023/08/howto-faq-changes", label: "Google Search Central blog: changes to HowTo and FAQ rich results (2023)" },
            { href: "https://www.w3.org/TR/json-ld11/", label: "W3C: JSON-LD 1.1", note: "the code format" },
          ]}
        />
      </QaSection>
    </>
  );
}

const MORE: Qa[] = [
  {
    q: "Will FAQ code give me the drop-down answers in Google?",
    a: (
      <>
        Probably not on its own. Since August 2023, Google shows FAQ rich results mainly for well-known government and health
        websites. The code is still worth adding, because it tells Google and AI assistants exactly which text on your page is
        a question and which is its answer.
      </>
    ),
  },
  {
    q: "What makes a good FAQ answer?",
    a: (
      <>
        Answer the question in the first sentence, then add one or two helpful details such as a price, a time or a place.
        Aim for about 40 to 60 words. Write it the way you would say it to a customer, and keep it identical to the visible
        answer on the page.
      </>
    ),
  },
  {
    q: "How do I check that my FAQ code works?",
    a: (
      <>
        Paste your page address into a structured data testing tool and look for an FAQPage item with no errors. Our{" "}
        <Link href="/free-check">free website check</Link> also reports whether your pages carry FAQ code, alongside your other
        scores, each from 0 to 100.
      </>
    ),
  },
];
