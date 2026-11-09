import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { MetaTagChecker } from "../_components/meta-tag-checker";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/audit/rules";
import { DESCRIPTION_SHORT, TITLE_SHORT } from "@/lib/tools/meta-tags";
import { PAGE_TOOL_LIMITS } from "@/lib/free-check/limits";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/meta-tag-checker" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;
const NAME = "Meta title and description checker";

export const metadata: Metadata = staticPageMetadata(PATH);

const prose =
  "mx-auto max-w-3xl text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline [&_code]:text-small";

export default function MetaTagCheckerPage() {
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
        title="Free meta title and description checker"
        intro={
          <p>
            Enter a page address. See the headline and summary Google is likely to show, how your link looks when it is
            shared, and what to change. No sign-up.
          </p>
        }
      />
      <section aria-label="Check a page's meta tags" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <MetaTagChecker />
          <LeadBox tool="meta-tag-checker" />
        </div>
      </section>

      <Section labelledBy="mtc-what">
        <div className={prose}>
          <h2 id="mtc-what" className="text-h2 text-fg">
            What this checker looks at
          </h2>
          <p className="mt-4">
            Every web page has a few hidden lines in its code that tell search engines and social apps how to describe it. This
            tool fetches one page, the way a search engine would, and reads them:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>
              <strong>The title tag</strong> (<code>&lt;title&gt;</code>). This usually becomes the blue headline in Google. We
              flag it as too short under {TITLE_SHORT} characters and too long over {TITLE_MAX}.
            </li>
            <li>
              <strong>The meta description.</strong> Google often uses it as the grey summary under the headline. We suggest{" "}
              {DESCRIPTION_SHORT} to {DESCRIPTION_MAX} characters.
            </li>
            <li>
              <strong>Duplicates.</strong> Two title tags or two descriptions on one page usually mean a theme and a plugin are
              both adding them.
            </li>
            <li>
              <strong>The canonical link</strong>, which names the main address of the page when the same content is reachable at
              several addresses.
            </li>
            <li>
              <strong>The robots meta tag.</strong> If it says <code>noindex</code>, Google will not show the page at all. This is
              the most expensive mistake on this list, and it is easy to leave on by accident after a site rebuild.
            </li>
            <li>
              <strong>Share tags</strong>: Open Graph (<code>og:title</code>, <code>og:description</code>, <code>og:image</code>)
              and the X (Twitter) card, which control the preview when someone shares your link.
            </li>
          </ul>
          <p className="mt-4">
            The same title and description limits are used in our full website report, so the two never disagree. This free tool
            reads one page at a time and can be used {PAGE_TOOL_LIMITS.perIp} times an hour.
          </p>

          <h2 className="mt-12 text-h2 text-fg">Why the title and description matter</h2>
          <p className="mt-4">
            The headline and summary are the first thing a searcher reads about your business, before they ever visit. A clear
            title that names the service and the place, such as &quot;Wedding photographer in Kochi | Anu Studio&quot;, helps
            the right people click. Google shows about 50 to 60 characters of a title on a typical screen and cuts the rest with
            &quot;…&quot;, so the important words should come first.
          </p>
          <p className="mt-4">
            Google does not always use your text. It may rewrite a title that is vague, stuffed with keywords or does not match
            the page. Its{" "}
            <SourceLink href="https://developers.google.com/search/docs/appearance/title-link">guide to title links</SourceLink>{" "}
            explains how it chooses. A good, honest title and description simply make it much more likely that your words are the
            ones people see.
          </p>

          <h2 className="mt-12 text-h2 text-fg">How to fix the most common problems</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5">
            <li>
              <strong>Missing or vague title:</strong> write what you offer, where, then your name. Give every page its own
              title; ten pages all called &quot;Home&quot; compete with each other.
            </li>
            <li>
              <strong>No description:</strong> write one or two sentences a customer would find useful, with one concrete
              detail such as a price range, opening hours or the areas you serve.
            </li>
            <li>
              <strong>noindex left on:</strong> in WordPress, check Settings, then Reading, for &quot;Discourage search
              engines&quot;, and the SEO plugin&apos;s settings for that page.
            </li>
            <li>
              <strong>No share image:</strong> add an <code>og:image</code> of 1200 × 630 pixels so links shared on WhatsApp,
              LinkedIn or Facebook show a picture instead of a blank box.
            </li>
          </ol>
          <p className="mt-6">
            Want this checked on every page of your site, with Google and AI visibility scores?{" "}
            <Link href="/free-check">Run the free website check</Link> or{" "}
            <Link href="/signup">start the 7-day free trial</Link>.
          </p>
        </div>
      </Section>

      <QaSection id="mtc-faq" tone="surface" title="Meta tag questions, answered" items={FAQ}>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/appearance/title-link", label: "Google Search Central: influencing title links" },
            { href: "https://developers.google.com/search/docs/appearance/snippet", label: "Google Search Central: control your snippets in search results" },
            { href: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag", label: "Google Search Central: robots meta tag and X-Robots-Tag" },
            { href: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls", label: "Google Search Central: canonical URLs" },
            { href: "https://ogp.me/", label: "The Open Graph protocol", note: "the og: share tags" },
            { href: "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/title", label: "MDN: the <title> element" },
          ]}
        />
      </QaSection>
    </>
  );
}

const FAQ: Qa[] = [
  {
    q: "How long should a meta title be?",
    a: (
      <>
        Aim for about {TITLE_SHORT} to {TITLE_MAX} characters. Google shows roughly 50 to 60 characters on most screens and
        cuts longer titles with an ellipsis. Shorter than {TITLE_SHORT} characters usually wastes space you could use for your
        town or main service. Put the most important words at the start.
      </>
    ),
  },
  {
    q: "How long should a meta description be?",
    a: (
      <>
        Around {DESCRIPTION_SHORT} to {DESCRIPTION_MAX} characters works well. Longer descriptions are usually cut off in search
        results. Google may also pick other text from your page if it matches the search better, so write a summary that is
        accurate and useful rather than a list of keywords.
      </>
    ),
  },
  {
    q: "Why does Google show a different title from mine?",
    a: (
      <>
        Google rewrites titles it finds too long, too vague, repeated across many pages or different from the page&apos;s main
        heading. Make the title match the page&apos;s H1, keep it under {TITLE_MAX} characters, and give every page a unique
        one. Google then uses your title far more often.
      </>
    ),
  },
  {
    q: "What does noindex mean, and how do I remove it?",
    a: (
      <>
        A robots meta tag containing noindex tells search engines not to list the page. It is useful for thank-you pages but
        harmful on pages you want found. Remove it in your website builder or SEO plugin settings, then ask Google to recrawl
        the page in Search Console.
      </>
    ),
  },
  {
    q: "Do meta tags help my business appear in AI answers?",
    a: (
      <>
        Indirectly. AI assistants such as ChatGPT and Perplexity read the page itself, and a clear title and description help
        them understand what it is about. They matter less than clear answers in the visible text. Our{" "}
        <Link href="/free-check">free website check</Link> scores both.
      </>
    ),
  },
];
