import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { SeoTitleGenerator } from "../_components/seo-title-generator";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { TITLE_MAX, TITLE_MIN } from "@/lib/audit/rules";
import { AI_TOOL_LIMITS } from "@/lib/free-check/limits";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/seo-title-generator" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;

export const metadata: Metadata = staticPageMetadata(PATH);

const PROSE =
  "mx-auto max-w-3xl text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline";

export default function SeoTitleGeneratorPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "SEO title generator",
            url: `${base}${PATH}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          },
          faqLdFromQa(FAQ),
          webPageLd(PATH, { base }),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: "SEO title generator", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free AI tool"
        title="Free AI SEO title generator"
        intro={
          <p>
            Tell us what the page is about and the words people search for. Get 5 title ideas that fit Google&apos;s space, with
            your keyword first and your brand last. Each one is checked for length and common mistakes.
          </p>
        }
      />
      <section aria-label="Write SEO titles" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <SeoTitleGenerator />
          <LeadBox tool="seo-title-generator" />
        </div>
      </section>

      <Section labelledBy="tg-good" tone="surface">
        <div className={PROSE}>
          <h2 id="tg-good" className="text-h2 text-fg">
            What makes a good page title
          </h2>
          <p className="mt-4">
            The page title is the text inside the <code>&lt;title&gt;</code> tag. Google often uses it as the blue headline of
            your search result, and browsers show it on the tab. It is one of the first things a searcher reads, so it decides
            whether they click.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-fg">Keep it short.</strong> Google shows about 50–60 characters of a title on most
              screens. Our checks pass titles between {TITLE_MIN} and {TITLE_MAX} characters, the same limits our full website
              audit uses.
            </li>
            <li>
              <strong className="text-fg">Put the main keyword first.</strong> People scan the start of each result. If the
              words they typed appear early, they know at a glance the page matches.
            </li>
            <li>
              <strong className="text-fg">Put the brand last.</strong> Your name helps people trust the result, but it matters
              less than what the page offers. Add it at the end after a &quot;|&quot; or &quot;-&quot;.
            </li>
            <li>
              <strong className="text-fg">Make every title unique.</strong> Each page needs its own title that describes that
              page. Repeating one title across the site makes pages hard to tell apart.
            </li>
            <li>
              <strong className="text-fg">Be plain and honest.</strong> No ALL CAPS, no &quot;you won&apos;t believe&quot;, no
              claims the page can&apos;t back up. Google may replace titles that don&apos;t match the page.
            </li>
          </ul>
          <p className="mt-4">
            Google explains how it picks the headline in its{" "}
            <SourceLink href="https://developers.google.com/search/docs/appearance/title-link">guide to title links</SourceLink>.
            The <SourceLink href="https://developer.mozilla.org/en-US/docs/Web/HTML/Element/title">MDN reference for the title element</SourceLink>{" "}
            shows where the tag goes in your HTML.
          </p>
        </div>
      </Section>

      <Section labelledBy="tg-how">
        <div className={PROSE}>
          <h2 id="tg-how" className="text-h2 text-fg">
            How to use the title generator
          </h2>
          <ol className="mt-6 list-decimal space-y-3 pl-5">
            <li>Describe the page in one sentence, such as &quot;emergency plumbing repairs for homes and offices&quot;.</li>
            <li>Add the main keyword people type into Google, your brand name and, for a local business, your city.</li>
            <li>
              Pick the page type. A blog post title reads differently from a product or home page title, and the AI adjusts the
              style.
            </li>
            <li>
              Read the 5 drafts. A green &quot;Pass&quot; means the length, keyword and brand position look right. &quot;Check&quot;
              lists what to fix.
            </li>
            <li>
              Copy your favourite, edit it so every word is true for the page, and paste it into your website&apos;s SEO title
              field. In WordPress, plugins such as Yoast or Rank Math have a box for it.
            </li>
          </ol>
          <p className="mt-4">
            Each run writes fresh drafts with AI, so you can run the tool {AI_TOOL_LIMITS.perIp} times an hour for free. We
            don&apos;t save what you type.
          </p>
        </div>
      </Section>

      <QaSection id="tg-faq" tone="surface" title="SEO titles: common questions" items={FAQ}>
        <p className="text-body leading-relaxed text-fg-soft">
          Want to see every page title on your site in one go?{" "}
          <Link href="/free-check" className="font-medium text-primary underline-offset-4 hover:underline">
            Run the free website check
          </Link>{" "}
          or{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            start a 7-day free trial
          </Link>{" "}
          for a full audit with fixes.
        </p>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/appearance/title-link", label: "Google Search Central: influencing title links" },
            { href: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", label: "Google Search Central: SEO starter guide" },
            { href: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/title", label: "MDN: the <title> element" },
          ]}
        />
      </QaSection>
    </>
  );
}

const FAQ: Qa[] = [
  {
    q: "How long should an SEO title be?",
    a: (
      <>
        Aim for {TITLE_MIN} to {TITLE_MAX} characters, including spaces. Google cuts longer titles to fit the screen, usually
        after about 50–60 characters, and adds &quot;…&quot;. Put the important words first so they survive even when the end
        is cut off.
      </>
    ),
  },
  {
    q: "Will Google always show the title I write?",
    a: (
      <>
        No. Google uses your title tag most of the time, but it can show other text from the page, such as the main heading, if
        it thinks that describes the page better. Titles that are accurate, unique and not stuffed with keywords are the ones
        Google keeps.
      </>
    ),
  },
  {
    q: "Should my brand name be in every title?",
    a: (
      <>
        Usually yes, at the end and kept short, like &quot;Tax filing for freelancers | Mehta &amp; Co&quot;. On the home page
        the brand can come first, because people searching your name want that page. If a title gets too long, shorten the
        brand before you cut the keyword.
      </>
    ),
  },
  {
    q: "Is the title the same as the H1 heading?",
    a: (
      <>
        Not quite. The title shows in search results and browser tabs. The H1 is the main heading visitors see on the page. They
        should talk about the same thing, but the H1 can be longer and friendlier. Our free heading checker shows your H1 and the
        rest of your headings.
      </>
    ),
  },
  {
    q: "Can I trust AI-written titles as they are?",
    a: (
      <>
        Treat them as drafts. The AI only knows what you typed, so it can&apos;t check your prices, services or locations. Read
        each one, fix anything that isn&apos;t true, and make sure the title matches what the page actually says.
      </>
    ),
  },
];
