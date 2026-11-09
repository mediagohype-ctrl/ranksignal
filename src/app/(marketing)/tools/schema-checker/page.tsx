import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { SchemaChecker } from "../_components/schema-checker";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { SCHEMA_RULES } from "@/lib/tools/schema-rules";
import { PAGE_TOOL_LIMITS } from "@/lib/free-check/limits";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/schema-checker" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;
const NAME = "Schema markup checker";

export const metadata: Metadata = staticPageMetadata(PATH);

const prose =
  "mx-auto max-w-3xl text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline [&_code]:text-small";

/** Top-level types shown in the "what we check" list (helper types like Question and ListItem are checked inside them). */
const LISTED = SCHEMA_RULES.filter((r) => !r.onlyInside);

export default function SchemaCheckerPage() {
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
        title="Free schema markup checker (JSON-LD)"
        intro={
          <p>
            Enter a page address. See every block of schema markup on it, which types it describes, any broken code, and the
            fields Google asks for that are missing. No sign-up.
          </p>
        }
      />
      <section aria-label="Check a page's schema markup" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <SchemaChecker />
          <LeadBox tool="schema-checker" />
        </div>
      </section>

      <Section labelledBy="sc-what">
        <div className={prose}>
          <h2 id="sc-what" className="text-h2 text-fg">
            What this checker looks at
          </h2>
          <p className="mt-4">
            Schema markup is a short block of code, invisible to visitors, that describes a page in a standard vocabulary from{" "}
            <SourceLink href="https://schema.org/">schema.org</SourceLink>: &quot;this is a local business at this address&quot;,
            &quot;this is a product that costs ₹1,499&quot;. The most common format is JSON-LD, written inside a{" "}
            <code>&lt;script type=&quot;application/ld+json&quot;&gt;</code> tag. This tool fetches one page and:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5">
            <li>lists every JSON-LD block and shows its code, neatly formatted;</li>
            <li>flags blocks that are not valid JSON, which search engines ignore entirely;</li>
            <li>lists every type found, including types nested inside other types and inside <code>@graph</code>;</li>
            <li>notes Microdata and RDFa markup, two older formats Google also reads;</li>
            <li>checks the fields Google documents as required or recommended for these {LISTED.length} common types:</li>
          </ul>
          <ul className="mt-3 grid gap-1 pl-5 text-small sm:grid-cols-2">
            {LISTED.map((r) => (
              <li key={r.key}>
                <SourceLink href={r.docUrl}>{r.label}</SourceLink>
                {r.required.length > 0 && <span className="text-muted"> · needs {r.required.slice(0, 3).join(", ")}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-4">
            Questions inside an FAQ page and steps inside breadcrumbs are checked too. We read up to 20 blocks per page, and the
            free tool can be used {PAGE_TOOL_LIMITS.perIp} times an hour.
          </p>

          <h2 className="mt-12 text-h2 text-fg">Why schema markup matters</h2>
          <p className="mt-4">
            Markup removes guesswork. Instead of inferring your opening hours or prices from the page text, search engines and AI
            tools can read them as labelled facts. Google uses it for rich results such as product prices, review stars, event
            dates and breadcrumbs. Its{" "}
            <SourceLink href="https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data">
              introduction to structured data
            </SourceLink>{" "}
            recommends JSON-LD as the easiest format to add and maintain.
          </p>
          <p className="mt-4">
            One important limit: valid markup makes a page <em>eligible</em> for rich results, never guaranteed. Google decides
            case by case, and since 2023 it shows FAQ rich results mainly for well-known government and health sites and no longer
            shows How-to rich results at all. The markup must also describe what visitors can actually see on the page.
          </p>

          <h2 className="mt-12 text-h2 text-fg">How to read the results</h2>
          <p className="mt-4">
            Each item gets a badge. <strong>Fix</strong> means a field Google requires is missing, so that item cannot qualify
            for its rich result yet. <strong>Check</strong> means the required fields are there but recommended ones are not;
            the item is valid, just thin. <strong>Pass</strong> means every field on Google&apos;s list is present. Below the
            list you can open each block to see its code exactly as your page sends it, formatted so it is easy to read. Types
            we do not check field by field, such as PostalAddress or Offer, are still listed so you can see everything the page
            describes.
          </p>

          <h2 className="mt-12 text-h2 text-fg">How to fix common schema problems</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5">
            <li>
              <strong>Invalid JSON:</strong> look for a missing or extra comma, curly quotes pasted from a word processor, or an
              unescaped quote inside a value. The error message points to the spot.
            </li>
            <li>
              <strong>Missing required fields:</strong> add them, for example an <code>address</code> for a LocalBusiness or{" "}
              <code>offers</code> with a price for a Product.
            </li>
            <li>
              <strong>No markup at all:</strong> start with Organization or LocalBusiness on your home page. Our{" "}
              <Link href="/tools/faq-markup-maker">FAQ schema generator</Link> writes FAQ code for you.
            </li>
            <li>
              <strong>Facts that differ from the page:</strong> keep prices, ratings and hours identical to the visible text.
            </li>
          </ol>
          <p className="mt-6">
            Want every page checked, with Google and AI visibility scores? <Link href="/free-check">Run the free website check</Link>{" "}
            or <Link href="/signup">start the 7-day free trial</Link>.
          </p>
        </div>
      </Section>

      <QaSection id="sc-faq" tone="surface" title="Schema markup questions, answered" items={FAQ}>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data", label: "Google Search Central: introduction to structured data" },
            { href: "https://developers.google.com/search/docs/appearance/structured-data/sd-policies", label: "Google Search Central: structured data general guidelines" },
            { href: "https://search.google.com/test/rich-results", label: "Google Rich Results Test" },
            { href: "https://validator.schema.org/", label: "Schema Markup Validator" },
            { href: "https://schema.org/docs/full.html", label: "schema.org: full list of types" },
            { href: "https://www.w3.org/TR/json-ld11/", label: "W3C: JSON-LD 1.1", note: "the code format" },
          ]}
        />
      </QaSection>
    </>
  );
}

const FAQ: Qa[] = [
  {
    q: "Will valid schema markup get me rich results?",
    a: (
      <>
        Not automatically. Valid markup only makes a page eligible. Google decides whether to show a rich result based on the
        search, the device and the quality of the page, and it can stop showing a type entirely, as it did for How-to results in
        2023. Accurate markup still helps search engines and AI tools read your facts.
      </>
    ),
  },
  {
    q: "What is the difference between required and recommended fields?",
    a: (
      <>
        Required fields are the minimum Google needs before an item can qualify for a rich result, such as a name and address for
        a local business. Recommended fields are optional extras, like opening hours or a phone number, that make the result more
        useful. Add every recommended field that is true and visible on your page.
      </>
    ),
  },
  {
    q: "JSON-LD, Microdata or RDFa: which should I use?",
    a: (
      <>
        Google reads all three, but recommends JSON-LD because it sits in one block, separate from your page design, so it is
        easier to add and keep correct. If your theme already outputs Microdata, you do not need to replace it. Avoid describing
        the same item twice in different formats with different facts.
      </>
    ),
  },
  {
    q: "Why does the checker find no markup when my plugin adds it?",
    a: (
      <>
        We read the HTML the server sends. If your markup is added later by JavaScript or a tag manager, it is not in that HTML.
        Google can often still see it after rendering the page, but many other tools and AI crawlers cannot. Server-side markup is
        the safer choice for important facts.
      </>
    ),
  },
  {
    q: "Does schema markup help with AI search?",
    a: (
      <>
        It can help AI tools identify your business, products and answers without guessing, especially your name, address,
        prices and FAQs. It is not a shortcut, though: clear visible text matters more. Our <Link href="/free-check">free
        website check</Link> scores your markup alongside the rest of your Google and AI readiness.
      </>
    ),
  },
];
