import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { HeadingChecker } from "../_components/heading-checker";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { ANSWER_MAX_WORDS, ANSWER_MIN_WORDS } from "@/lib/crawler/extract";
import { HEADING_LONG_CHARS } from "@/lib/tools/headings";
import { PAGE_TOOL_LIMITS } from "@/lib/free-check/limits";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/heading-checker" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;
const NAME = "Heading structure checker";

export const metadata: Metadata = staticPageMetadata(PATH);

const prose =
  "mx-auto max-w-3xl text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline";

export default function HeadingCheckerPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: NAME,
            url: `${base}${PATH}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          },
          faqLdFromQa(FAQ),
          webPageLd(PATH, { base }),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: NAME, path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free tool"
        title="Free heading checker: see your H1 to H6 outline"
        intro={
          <p>
            Enter a page address. See its headings as an outline, spot a missing or repeated main heading and skipped levels,
            and count the question headings AI tools can quote. No sign-up.
          </p>
        }
      />
      <section aria-label="Check a page's headings" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <HeadingChecker />
          <LeadBox tool="heading-checker" />
        </div>
      </section>

      <Section labelledBy="hc-what">
        <div className={prose}>
          <h2 id="hc-what" className="text-h2 text-fg">
            What this checker looks at
          </h2>
          <p className="mt-4">
            Headings are the signposts of a page. HTML has six levels: H1 is the page&apos;s main title, H2s are its sections,
            H3s are parts of a section, and so on down to H6. Search engines, AI tools and screen readers all use these levels to
            understand how a page is organised. This tool fetches one page and checks:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>
              <strong>One main heading.</strong> We flag a page with no H1, or with more than one.
            </li>
            <li>
              <strong>Skipped levels</strong>, such as an H2 followed straight by an H4. That usually means a heading was picked
              for its size rather than its place in the outline.
            </li>
            <li>
              <strong>Empty headings</strong>, often left behind by page builders or used to wrap an icon.
            </li>
            <li>
              <strong>Very long headings</strong>, over {HEADING_LONG_CHARS} characters. Headings should be short signposts, not
              paragraphs.
            </li>
            <li>
              <strong>Question headings.</strong> We count H2 and H3 headings phrased as a question, and how many are followed by a
              direct answer of {ANSWER_MIN_WORDS} to {ANSWER_MAX_WORDS} words.
            </li>
          </ul>
          <p className="mt-4">
            We read the HTML the server sends, so headings that only appear after JavaScript runs may be missing. The free tool
            can be used {PAGE_TOOL_LIMITS.perIp} times an hour and shows up to 200 headings per page.
          </p>

          <h2 className="mt-12 text-h2 text-fg">Why heading structure matters</h2>
          <p className="mt-4">
            A clear outline helps people scan a page and find their answer quickly. It also helps machines. Google&apos;s{" "}
            <SourceLink href="https://developers.google.com/search/docs/fundamentals/seo-starter-guide">SEO starter guide</SourceLink>{" "}
            recommends breaking long content into sections with headings so readers and search engines can follow it. For people
            who use screen readers, headings work like a table of contents; the{" "}
            <SourceLink href="https://www.w3.org/WAI/tutorials/page-structure/headings/">W3C accessibility tutorial</SourceLink>{" "}
            asks for headings that reflect the real structure of the page.
          </p>
          <p className="mt-4">
            For AI answers, question headings are useful. When a section is titled with the exact question a customer asks, and
            the first paragraph answers it in plain words, AI assistants can lift that answer and credit your page. That is why we
            count answers of {ANSWER_MIN_WORDS} to {ANSWER_MAX_WORDS} words: long enough to be complete, short enough to quote.
          </p>

          <h2 className="mt-12 text-h2 text-fg">How to read the outline</h2>
          <p className="mt-4">
            The outline lists every heading in the order it appears on the page, indented by level, so it reads like a table of
            contents. A healthy page has one H1 at the top, a handful of H2 sections and H3s only where a section needs parts.
            Labels next to a heading point out a skipped level, a heading that is too long, or a question heading. If the outline
            does not read like a sensible summary of the page, visitors skimming it will struggle too.
          </p>

          <h2 className="mt-12 text-h2 text-fg">How to fix common heading problems</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5">
            <li>
              <strong>No H1:</strong> set the page&apos;s main title to &quot;Heading 1&quot; in your editor. It should say what
              the page is about, such as &quot;Home cleaning in Indore&quot;.
            </li>
            <li>
              <strong>Several H1s:</strong> keep one and change the rest to H2. Logos in the header are a common culprit.
            </li>
            <li>
              <strong>Skipped levels:</strong> change the heading level, then use your theme&apos;s style settings if you want
              it to look bigger or smaller.
            </li>
            <li>
              <strong>No question headings:</strong> turn two or three sections into the questions customers ask, and answer
              each one in the first sentence below it.
            </li>
          </ol>
          <p className="mt-6">
            Want every page checked at once, with Google and AI visibility scores?{" "}
            <Link href="/free-check">Run the free website check</Link> or <Link href="/signup">start the 7-day free trial</Link>.
          </p>
        </div>
      </Section>

      <QaSection id="hc-faq" tone="surface" title="Heading questions, answered" items={FAQ}>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", label: "Google Search Central: SEO starter guide" },
            { href: "https://www.w3.org/WAI/tutorials/page-structure/headings/", label: "W3C WAI: headings tutorial" },
            { href: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/Heading_Elements", label: "MDN: the <h1>–<h6> heading elements" },
            { href: "https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines", label: "WHATWG HTML standard: headings and outlines" },
          ]}
        />
      </QaSection>
    </>
  );
}

const FAQ: Qa[] = [
  {
    q: "Can a page have more than one H1?",
    a: (
      <>
        HTML allows it, and Google has said multiple H1s do not cause a penalty. Still, one H1 that names the page&apos;s topic
        is clearer for visitors, screen reader users and AI tools. Use H2 for the main sections below it. Our checker flags extra
        H1s as something to check, not a failure.
      </>
    ),
  },
  {
    q: "Is skipping a heading level bad for SEO?",
    a: (
      <>
        It will not stop a page from ranking, but it makes the outline harder to follow, especially for people using screen
        readers, who jump between headings by level. Step down one level at a time, from H2 to H3, and change how big a heading
        looks with styling instead.
      </>
    ),
  },
  {
    q: "Why should some headings be questions?",
    a: (
      <>
        People type and speak questions into Google and AI assistants. A heading that matches the question, followed by a short
        direct answer, gives those tools a clean passage to quote. Use it where it is natural, such as FAQs, pricing and how-it-works
        sections, not on every heading.
      </>
    ),
  },
  {
    q: "How long should the answer under a question heading be?",
    a: (
      <>
        Start with {ANSWER_MIN_WORDS} to {ANSWER_MAX_WORDS} words that answer the question completely on their own, ideally with
        one concrete fact such as a price, a time or a place. Add detail, examples and lists after that. Answers this size are
        easy for AI assistants to quote accurately.
      </>
    ),
  },
  {
    q: "Why does the checker show no headings when I can see them?",
    a: (
      <>
        Your site may build the page with JavaScript in the browser, so the HTML we fetch has no headings yet. Some search and AI
        tools have the same problem. The text may also be styled to look like a heading without using a heading tag. Our{" "}
        <Link href="/free-check">free website check</Link> flags JavaScript-only pages.
      </>
    ),
  },
];
