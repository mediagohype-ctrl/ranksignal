import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { FaqGenerator } from "../_components/faq-generator";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { AI_TOOL_LIMITS } from "@/lib/free-check/limits";
import { AI_INPUT_LIMITS } from "@/lib/tools/ai-writing-checks";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/faq-generator" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;

export const metadata: Metadata = staticPageMetadata(PATH);

const PROSE =
  "mx-auto max-w-3xl text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline";

export default function FaqGeneratorPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "AI FAQ generator",
            url: `${base}${PATH}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          },
          faqLdFromQa(FAQ),
          webPageLd(PATH, { base }),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: "FAQ generator", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free AI tool"
        title="Free AI FAQ generator with schema code"
        intro={
          <p>
            Give us a page address or paste your text. Get 6–8 questions your customers really ask, with short answers taken only
            from your own words, plus FAQ code to paste on the page.
          </p>
        }
      />
      <section aria-label="Write FAQ drafts" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <FaqGenerator />
          <LeadBox tool="faq-generator" />
        </div>
      </section>

      <Section labelledBy="fg-good" tone="surface">
        <div className={PROSE}>
          <h2 id="fg-good" className="text-h2 text-fg">
            What makes a good FAQ
          </h2>
          <p className="mt-4">
            A good FAQ answers the questions people ask before they buy, call or visit. It saves your customers time, and it gives
            Google and AI assistants short, clear answers they can quote.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-fg">Use real questions.</strong> Think of what customers ask on the phone or on WhatsApp:
              prices, timings, areas you serve, how long things take.
            </li>
            <li>
              <strong className="text-fg">Answer first.</strong> Start with &quot;Yes&quot;, &quot;No&quot; or the fact, then add
              one or two details. 40–80 words is enough for most answers.
            </li>
            <li>
              <strong className="text-fg">Only state facts you stand behind.</strong> Our AI uses only your page text. When the
              page doesn&apos;t say, it writes &quot;Not stated on the page — add this&quot; instead of guessing, so you can fill
              in the real answer.
            </li>
            <li>
              <strong className="text-fg">Show it on the page.</strong> Publish the same questions and answers as visible text.
              Google&apos;s rules say FAQ markup must match content visitors can see.
            </li>
          </ul>
          <p className="mt-4">
            The code this tool makes follows the{" "}
            <SourceLink href="https://schema.org/FAQPage">schema.org FAQPage type</SourceLink> and Google&apos;s{" "}
            <SourceLink href="https://developers.google.com/search/docs/appearance/structured-data/faqpage">FAQPage structured data guidelines</SourceLink>.
          </p>
        </div>
      </Section>

      <Section labelledBy="fg-how">
        <div className={PROSE}>
          <h2 id="fg-how" className="text-h2 text-fg">
            How to use the FAQ generator
          </h2>
          <ol className="mt-6 list-decimal space-y-3 pl-5">
            <li>
              Enter the address of one public page, such as your services page. We read its title, headings and main text. Or
              paste up to {AI_INPUT_LIMITS.pageText.toLocaleString("en-IN")} characters of text instead.
            </li>
            <li>Optionally say who your customers are and where you work, so the questions sound like theirs.</li>
            <li>
              Edit the drafts. Fill in every answer marked &quot;Needs your answer&quot;, remove questions you don&apos;t want and
              add your own.
            </li>
            <li>Add the questions and answers to the page as visible text, word for word.</li>
            <li>
              Copy the FAQ code and paste it into the same page, for example in a WordPress &quot;Custom HTML&quot; block. Then test
              it with Google&apos;s <SourceLink href="https://search.google.com/test/rich-results">Rich Results Test</SourceLink>.
            </li>
          </ol>
          <p className="mt-4">
            You can run the tool {AI_TOOL_LIMITS.perIp} times an hour for free. We don&apos;t save your page or your answers.
            Rows you haven&apos;t answered are left out of the code automatically.
          </p>
          <h3 className="mt-8 text-h4 text-fg">Common FAQ mistakes</h3>
          <p className="mt-2">
            Avoid putting the same FAQ block on every page; each page should answer questions about its own topic. Don&apos;t
            use FAQ code for adverts or for questions nobody asks. Keep answers up to date when your prices, hours or service
            areas change, and update the code at the same time, because outdated answers mislead both customers and AI
            assistants that quote them.
          </p>
        </div>
      </Section>

      <QaSection id="fg-faq" tone="surface" title="FAQ generator: common questions" items={FAQ}>
        <p className="text-body leading-relaxed text-fg-soft">
          See which of your pages already have FAQ code, and what else to fix:{" "}
          <Link href="/free-check" className="font-medium text-primary underline-offset-4 hover:underline">
            run the free website check
          </Link>{" "}
          or{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            start a 7-day free trial
          </Link>
          .
        </p>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/appearance/structured-data/faqpage", label: "Google Search Central: FAQ (FAQPage) structured data" },
            { href: "https://developers.google.com/search/blog/2023/08/howto-faq-changes", label: "Google Search Central blog: changes to HowTo and FAQ rich results (2023)" },
            { href: "https://schema.org/FAQPage", label: "schema.org: FAQPage" },
          ]}
        />
      </QaSection>
    </>
  );
}

const FAQ: Qa[] = [
  {
    q: "Where do the questions and answers come from?",
    a: (
      <>
        From the page or text you give us, and nothing else. The AI suggests the questions customers are likely to ask, then
        answers each one using only that text. If the text doesn&apos;t cover a question, the answer says &quot;Not stated on the
        page — add this&quot; so you can write it yourself.
      </>
    ),
  },
  {
    q: "Will FAQ code get me the drop-down answers in Google?",
    a: (
      <>
        Probably not by itself. Since August 2023, Google shows FAQ rich results mainly for well-known government and health
        websites. The code still helps, because it tells search engines and AI assistants exactly which text is a question and
        which is its answer.
      </>
    ),
  },
  {
    q: "Do the questions have to be visible on my page?",
    a: (
      <>
        Yes. Google&apos;s guidelines say FAQ markup must describe content that visitors can read on the same page. Add the
        questions and answers as normal text, for example in an FAQ section near the bottom, then paste the code. Hidden FAQ code
        can be ignored or treated as spam.
      </>
    ),
  },
  {
    q: "How many questions should a page have?",
    a: (
      <>
        Enough to cover what customers really ask about that page, usually 4 to 10. This tool drafts 6 to 8. Quality matters
        more than number: one clear, specific answer about price or timing beats five vague ones.
      </>
    ),
  },
  {
    q: "Can I edit the answers before I copy the code?",
    a: (
      <>
        Yes, and you should. Every question and answer is an editable box, and the code updates as you type. Fix the wording,
        add missing facts, delete questions you don&apos;t need or add your own, then copy the finished code.
      </>
    ),
  },
];
