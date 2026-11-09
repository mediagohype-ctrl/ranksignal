import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { SitemapChecker } from "../_components/sitemap-checker";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";
import { SITEMAP_LIMITS } from "@/lib/tools/sitemap-check";
import { GENERATOR_MAX_URLS } from "@/lib/tools/sitemap-generate";

const PATH = "/tools/sitemap-checker" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;
const fmt = (n: number) => n.toLocaleString("en-US");

export const metadata: Metadata = staticPageMetadata(PATH);

export default function SitemapCheckerPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "XML sitemap checker and generator",
            url: `${base}${PATH}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          },
          faqLdFromQa(FAQ),
          webPageLd(PATH, { base }),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: "Sitemap checker", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free tool"
        title="Free XML sitemap checker and generator"
        intro={
          <p>
            Find your sitemap, count its pages and spot errors, missing pages and redirects. No sitemap yet? Paste your page addresses and download
            one.
          </p>
        }
      />
      <section aria-label="Check or make your sitemap" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <SitemapChecker />
          <LeadBox tool="sitemap-checker" />
        </div>
      </section>

      <Section labelledBy="smc-what">
        <div className="mx-auto max-w-3xl space-y-5 text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          <h2 id="smc-what" className="text-h2 text-fg">
            What a sitemap is and why it matters
          </h2>
          <p>
            An XML sitemap is a list of the pages on your website that you want search engines to find. Google and Bing read it to discover new and
            changed pages faster, especially on sites with few links pointing in. AI search tools that build on these search indexes benefit too.
          </p>
          <p>
            A sitemap doesn&apos;t force Google to show a page, but a broken one wastes the hint. A sitemap full of deleted pages or redirects tells
            Google the list isn&apos;t reliable.
          </p>

          <h2 className="pt-6 text-h2 text-fg">What the checker looks at</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-fg">Where your sitemaps are.</strong> We read the Sitemap: lines in robots.txt and try /sitemap.xml and
              /sitemap_index.xml. If a file is a sitemap index, we follow up to {SITEMAP_LIMITS.maxChildSitemaps} of the sitemaps it lists.
            </li>
            <li>
              <strong className="text-fg">Whether the XML is valid.</strong> One unescaped &amp; or a missing closing tag can make a file unreadable. We
              show the line to fix.
            </li>
            <li>
              <strong className="text-fg">The protocol limits.</strong> The{" "}
              <SourceLink href="https://www.sitemaps.org/protocol.html">sitemaps.org protocol</SourceLink> allows at most 50,000 URLs and 50 MB
              (uncompressed) per sitemap file. Bigger sites split their list and point to the parts from a sitemap index.
            </li>
            <li>
              <strong className="text-fg">The addresses inside.</strong> We flag http:// addresses, pages on another host (www and non-www count as
              different), duplicates, and entries that are not full addresses.
            </li>
            <li>
              <strong className="text-fg">Dates.</strong> We count how many URLs have a lastmod date, how many are in the wrong format or in the future,
              and how many are older than 12 months.
            </li>
            <li>
              <strong className="text-fg">A sample of real pages.</strong> We open up to {SITEMAP_LIMITS.sampleSize} pages spread through your sitemap to
              spot missing pages (404) and redirects.
            </li>
          </ul>
          <p>
            To keep the tool fast and fair, one check reads at most {fmt(SITEMAP_LIMITS.maxTotalUrls)} URLs and 10 MB in total. The generator takes up to{" "}
            {fmt(GENERATOR_MAX_URLS)} addresses and runs entirely in your browser.
          </p>

          <h2 className="pt-6 text-h2 text-fg">How to fix common sitemap problems</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-fg">No sitemap found.</strong> WordPress, Shopify, Wix and Squarespace make one automatically; look in your SEO
              plugin or site settings. Otherwise use the Generator tab and upload the file to your site&apos;s main folder.
            </li>
            <li>
              <strong className="text-fg">Not listed in robots.txt.</strong> Add a line such as Sitemap: https://yoursite.com/sitemap.xml, and submit it
              in Google Search Console as well.
            </li>
            <li>
              <strong className="text-fg">Missing pages and redirects.</strong> List only live pages at their final address. Most plugins update this
              for you once old pages are deleted properly.
            </li>
            <li>
              <strong className="text-fg">Wrong host or http://.</strong> Use the exact version your site redirects to, for example
              https://www.yoursite.com.
            </li>
            <li>
              <strong className="text-fg">Unreliable dates.</strong> Google says it uses lastmod only when it is consistently accurate. Set it from the
              real date a page changed, not today&apos;s date on every page.
            </li>
          </ol>
          <p>
            A clean sitemap is one of many signals. Run the <Link href="/free-check">free website check</Link> for the full picture, test your file
            with the <Link href="/tools/robots-txt-tester">robots.txt tester</Link>, or <Link href="/signup">start a 7-day free trial</Link> to keep an
            eye on your site every week.
          </p>
        </div>
      </Section>

      <QaSection id="smc-faq" tone="surface" title="Sitemap questions" items={FAQ}>
        <SourcesList
          links={[
            { href: "https://www.sitemaps.org/protocol.html", label: "sitemaps.org: Sitemaps XML format", note: "the protocol and its limits" },
            { href: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap", label: "Google Search Central: Build and submit a sitemap" },
            { href: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps", label: "Google Search Central: Manage large sitemaps with an index" },
            { href: "https://www.w3.org/TR/NOTE-datetime", label: "W3C: Date and time formats", note: "the format lastmod uses" },
          ]}
        />
      </QaSection>
    </>
  );
}

const FAQ: Qa[] = [
  {
    q: "Does every website need a sitemap?",
    a: (
      <>
        Not strictly. Google says a small site that is well linked internally may not need one. A sitemap still helps new sites, sites with few
        outside links and sites that add pages often. It costs nothing and most website builders create one for you.
      </>
    ),
  },
  {
    q: "How many URLs can one sitemap hold?",
    a: (
      <>
        Up to 50,000 URLs, and the file must be 50 MB or smaller before compression. Larger sites split their pages across several sitemaps and list
        those files in a sitemap index. One index can list up to 50,000 sitemaps.
      </>
    ),
  },
  {
    q: "Do priority and changefreq matter?",
    a: (
      <>
        Not for Google. Google says it ignores the priority and changefreq values in sitemaps. It does use lastmod, but only when the dates are
        consistently accurate. You can leave priority and changefreq out; our generator does.
      </>
    ),
  },
  {
    q: "Should old pages stay in my sitemap?",
    a: (
      <>
        Yes, if they are still live and useful. A page older than 12 months is not a problem by itself. Remove pages that are deleted, redirected or
        marked noindex, because a sitemap should only list pages you want to appear in search.
      </>
    ),
  },
  {
    q: "Where do I upload the sitemap I generate here?",
    a: (
      <>
        Upload sitemap.xml to the main folder of your website, so it opens at yoursite.com/sitemap.xml. Then add a Sitemap: line to robots.txt and
        submit the address in Google Search Console. If your website builder already makes a sitemap, use that one instead.
      </>
    ),
  },
];
