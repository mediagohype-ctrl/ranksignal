import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { MetaDescriptionGenerator } from "../_components/meta-description-generator";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { DESCRIPTION_MAX } from "@/lib/audit/rules";
import { AI_TOOL_LIMITS } from "@/lib/free-check/limits";
import { DESCRIPTION_TARGET_MAX, DESCRIPTION_TARGET_MIN } from "@/lib/tools/ai-writing-prompts";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/meta-description-generator" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;

export const metadata: Metadata = staticPageMetadata(PATH);

const PROSE =
  "mx-auto max-w-3xl text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline";

export default function MetaDescriptionGeneratorPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Meta description generator",
            url: `${base}${PATH}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          },
          faqLdFromQa(FAQ),
          webPageLd(PATH, { base }),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: "Meta description generator", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free AI tool"
        title="Free AI meta description generator"
        intro={
          <p>
            Describe your page and get 5 short summaries Google can show under your result, each {DESCRIPTION_TARGET_MIN}–
            {DESCRIPTION_TARGET_MAX} characters with your keyword and a reason to click.
          </p>
        }
      />
      <section aria-label="Write meta descriptions" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <MetaDescriptionGenerator />
          <LeadBox tool="meta-description-generator" />
        </div>
      </section>

      <Section labelledBy="md-good" tone="surface">
        <div className={PROSE}>
          <h2 id="md-good" className="text-h2 text-fg">
            What makes a good meta description
          </h2>
          <p className="mt-4">
            A meta description is a one- or two-sentence summary in your page&apos;s HTML. Visitors don&apos;t see it on the
            page, but Google often uses it as the grey text under your search result. A clear summary helps people decide to click
            your result instead of the next one.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>
              <strong className="text-fg">Aim for {DESCRIPTION_TARGET_MIN}–{DESCRIPTION_TARGET_MAX} characters.</strong> Google
              has no fixed limit, but it trims snippets to fit the screen. Our full audit flags descriptions longer than{" "}
              {DESCRIPTION_MAX} characters, so we keep drafts a little shorter than that.
            </li>
            <li>
              <strong className="text-fg">Say what the page offers.</strong> Name the product or service, who it is for and,
              for local businesses, where.
            </li>
            <li>
              <strong className="text-fg">Use the keyword once.</strong> Google highlights the words people searched for, which
              makes your result stand out. Repeating it doesn&apos;t help.
            </li>
            <li>
              <strong className="text-fg">Give a reason to click.</strong> A real detail, such as same-day delivery or a free
              first visit, works better than vague praise.
            </li>
            <li>
              <strong className="text-fg">Write one for each page.</strong> Google says unique descriptions per page work best.
              Copying one description everywhere makes your results look the same.
            </li>
          </ul>
          <p className="mt-4">
            Read Google&apos;s own advice in its{" "}
            <SourceLink href="https://developers.google.com/search/docs/appearance/snippet">guide to snippets and meta descriptions</SourceLink>.
            The tag itself is <code>&lt;meta name=&quot;description&quot; content=&quot;…&quot;&gt;</code>, described in{" "}
            <SourceLink href="https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name">MDN&apos;s list of standard meta names</SourceLink>.
          </p>
        </div>
      </Section>

      <Section labelledBy="md-how">
        <div className={PROSE}>
          <h2 id="md-how" className="text-h2 text-fg">
            How to use the meta description generator
          </h2>
          <ol className="mt-6 list-decimal space-y-3 pl-5">
            <li>Summarise the page in a sentence or two: what you offer, for whom and where.</li>
            <li>Add the main keyword. Optionally add a call to action, like &quot;Book a free visit&quot;, and your audience.</li>
            <li>
              Read the 5 drafts. &quot;Pass&quot; means the length is right and the keyword is in. &quot;Check&quot; tells you
              what to change.
            </li>
            <li>Click &quot;Preview&quot; to see roughly how a draft looks in Google, then copy the one you like.</li>
            <li>
              Edit it so every detail is true, then paste it into the meta description field of your website builder or SEO
              plugin.
            </li>
          </ol>
          <p className="mt-4">
            You can run the tool {AI_TOOL_LIMITS.perIp} times an hour for free. We don&apos;t save what you type.
          </p>
          <h3 className="mt-8 text-h4 text-fg">Common mistakes to fix</h3>
          <p className="mt-2">
            The most common problems we see are pages with no description at all, the same description copied onto every page,
            and descriptions that are just a list of keywords. Each one makes Google more likely to pick random text from your
            page instead. Another mistake is promising something the page doesn&apos;t deliver, such as a discount that has
            ended. People who click and don&apos;t find it leave quickly, so keep each description honest and up to date.
          </p>
        </div>
      </Section>

      <QaSection id="md-faq" tone="surface" title="Meta descriptions: common questions" items={FAQ}>
        <p className="text-body leading-relaxed text-fg-soft">
          Find every page with a missing or too-long description:{" "}
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
            { href: "https://developers.google.com/search/docs/appearance/snippet", label: "Google Search Central: control your snippets in search results" },
            { href: "https://developers.google.com/search/docs/fundamentals/seo-starter-guide", label: "Google Search Central: SEO starter guide" },
            { href: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta/name", label: "MDN: standard metadata names" },
          ]}
        />
      </QaSection>
    </>
  );
}

const FAQ: Qa[] = [
  {
    q: "Does a meta description help my Google ranking?",
    a: (
      <>
        Not directly. Google has said meta descriptions are not a ranking factor. They matter because a clear, relevant summary
        can get more people to click your result, and more clicks from the same ranking position means more visitors.
      </>
    ),
  },
  {
    q: "Why does Google show different text from my meta description?",
    a: (
      <>
        Google picks the snippet for each search. If another part of your page answers the search better, it may show that text
        instead. Descriptions that accurately summarise the page, and match what people search for, are shown more often.
      </>
    ),
  },
  {
    q: "How long should a meta description be?",
    a: (
      <>
        There is no fixed limit, but Google trims long snippets to fit the screen. About {DESCRIPTION_TARGET_MIN} to{" "}
        {DESCRIPTION_TARGET_MAX} characters is a safe range: long enough to be useful, short enough to show in full on most
        devices.
      </>
    ),
  },
  {
    q: "Should every page have its own meta description?",
    a: (
      <>
        Yes, for your important pages at least: the home page, service or product pages and popular articles. If you can&apos;t
        write them all, leaving one out is better than copying the same text onto many pages, because Google will then pick text
        from the page itself.
      </>
    ),
  },
  {
    q: "Is it safe to use AI-written descriptions?",
    a: (
      <>
        Yes, as long as you check them. The AI only knows what you typed, so it may word an offer in a way that isn&apos;t
        quite right. Read each draft, remove anything untrue, and keep the one that sounds most like your business.
      </>
    ),
  },
];
