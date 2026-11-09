import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { BrokenLinkChecker } from "../_components/broken-link-checker";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { LINK_CHECK_LIMITS } from "@/lib/tools/link-check";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/broken-link-checker" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;
const TIMEOUT_S = LINK_CHECK_LIMITS.timeoutMs / 1000;

export const metadata: Metadata = staticPageMetadata(PATH);

export default function BrokenLinkCheckerPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Broken link checker",
            url: `${base}${PATH}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          },
          faqLdFromQa(FAQ),
          webPageLd(PATH, { base }),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: "Broken link checker", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free tool"
        title="Free broken link checker for any web page"
        intro={<p>Enter one page address. We test every link and image on it and show which ones are broken, redirect or time out, and what to do about each.</p>}
      />
      <section aria-label="Check the links on a page" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <BrokenLinkChecker />
          <LeadBox tool="broken-link-checker" />
        </div>
      </section>

      <Section labelledBy="blc-what" tone="surface">
        <div className="mx-auto max-w-3xl space-y-4 text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          <h2 id="blc-what" className="text-h2 text-fg">
            What this tool checks
          </h2>
          <p>
            We load the page you enter and collect every link (<code>&lt;a href&gt;</code>) and every image (
            <code>&lt;img src&gt;</code>), both on your own site and on other sites. We remove duplicates and skip email,
            phone and &quot;jump to section&quot; links, because those don&apos;t load a page. Then we visit each address
            the way a browser would and record the answer the server gives.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>OK</strong> means the server answered with a 2xx status, such as 200. The link works.
            </li>
            <li>
              <strong>Redirect</strong> means the link sends visitors on to another address (a 3xx status). We follow up to{" "}
              {LINK_CHECK_LIMITS.maxRedirects} hops and show the whole chain, and we flag links still written with http://.
            </li>
            <li>
              <strong>Broken</strong> means the final answer was a 4xx or 5xx error, such as 404 Not Found or 500 Internal
              Server Error.
            </li>
            <li>
              <strong>Blocked by site</strong> means the server answered 401, 403 or 429. Many sites refuse automated
              checkers but work fine for people, so open these in your browser before you change anything.
            </li>
            <li>
              <strong>Timeout</strong> and <strong>can&apos;t connect</strong> mean we got no answer within {TIMEOUT_S} seconds,
              the domain name no longer exists, or the site&apos;s security certificate is not valid.
            </li>
          </ul>
          <p>
            The free tool checks up to {LINK_CHECK_LIMITS.maxTargets} unique links per page, a few at a time, and stops
            after about 25 seconds. If it runs out of time, it says so and shows the results it has. It does not download
            whole files, and it never contacts private or internal network addresses.
          </p>
        </div>
      </Section>

      <Section labelledBy="blc-why">
        <div className="mx-auto max-w-3xl space-y-4 text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          <h2 id="blc-why" className="text-h2 text-fg">
            Why broken links matter
          </h2>
          <p>
            A broken link is a dead end. A visitor who clicks &quot;Book now&quot; and lands on an error page often leaves
            instead of hunting for the right page. Broken images make a page look neglected and can hide a product photo or a
            price list.
          </p>
          <p>
            Links are also how search engines find your pages. Google says it{" "}
            <SourceLink href="https://developers.google.com/search/docs/crawling-indexing/links-crawlable">
              uses links to discover new pages
            </SourceLink>
            , so a broken internal link can leave a page harder to find. Long redirect chains slow every click and waste
            crawl effort: Google&apos;s documentation on{" "}
            <SourceLink href="https://developers.google.com/search/docs/crawling-indexing/http-network-errors">
              HTTP status codes
            </SourceLink>{" "}
            says Googlebot follows up to 10 redirect hops and treats a longer chain as an error.
          </p>
        </div>
      </Section>

      <Section labelledBy="blc-fix" tone="surface">
        <div className="mx-auto max-w-3xl space-y-4 text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          <h2 id="blc-fix" className="text-h2 text-fg">
            How to fix broken links
          </h2>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <strong>Update the link.</strong> If the page moved, change the link to its new address. This is the best fix,
              because visitors go straight there.
            </li>
            <li>
              <strong>Add a 301 redirect.</strong> If one of your own pages moved and other sites still link to the old
              address, set up a permanent (301) redirect from the old address to the new one. Google explains this in{" "}
              <SourceLink href="https://developers.google.com/search/docs/crawling-indexing/301-redirects">
                Redirects and Google Search
              </SourceLink>
              .
            </li>
            <li>
              <strong>Remove the link.</strong> If the page is gone for good and there is no close replacement, delete the
              link or swap it for a helpful alternative.
            </li>
            <li>
              <strong>Shorten redirect chains.</strong> When a link redirects, edit it to point at the final address shown in
              the results, and change any http:// links to https://.
            </li>
          </ol>
          <p>
            Download the CSV to keep a list, fix the broken links first, then run the check again to confirm.
          </p>
        </div>
      </Section>

      <QaSection id="blc-faq" title="Broken link questions" items={FAQ}>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/crawling-indexing/http-network-errors", label: "Google Search Central: How HTTP status codes affect Google's crawlers" },
            { href: "https://developers.google.com/search/docs/crawling-indexing/301-redirects", label: "Google Search Central: Redirects and Google Search" },
            { href: "https://developers.google.com/search/docs/crawling-indexing/links-crawlable", label: "Google Search Central: Make your links crawlable" },
            { href: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status", label: "MDN: HTTP response status codes", note: "what each number means" },
            { href: "https://www.rfc-editor.org/rfc/rfc9110", label: "RFC 9110: HTTP Semantics", note: "the standard that defines status codes" },
          ]}
        />
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-surface p-6 text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          <p>
            This tool checks one page. To find broken links across your whole site, along with other problems that stop Google
            and AI tools from finding you, run our <Link href="/free-check">free website check</Link> or{" "}
            <Link href="/signup">start a 7-day free trial</Link>.
          </p>
        </div>
      </QaSection>
    </>
  );
}

const FAQ: Qa[] = [
  {
    q: "What is a broken link?",
    a: (
      <>
        A broken link points to an address that no longer works. Clicking it shows an error, most often 404 Not Found, instead
        of the page the visitor expected. It usually happens when a page is deleted or renamed, or when another website you
        linked to closes or reorganises its pages.
      </>
    ),
  },
  {
    q: "Do broken links hurt my Google ranking?",
    a: (
      <>
        A few broken links to other websites won&apos;t sink your rankings on their own. The bigger costs are lost visitors and
        pages that are harder to find: if your own pages link to each other with broken links, Google has fewer paths to reach
        them. Fixing them is quick and helps both people and search engines.
      </>
    ),
  },
  {
    q: "Why does a link show \"Blocked by site\" when it works for me?",
    a: (
      <>
        Some websites refuse requests from automated checkers and answer 401, 403 or 429 instead. Large social networks do this
        often. Your visitors use real browsers, so the link may work fine for them. Open it yourself; if it loads, you can
        leave it as it is.
      </>
    ),
  },
  {
    q: "Should I fix links that redirect?",
    a: (
      <>
        Redirects still work, so they are lower priority than broken links. But each hop adds a little delay, and chains of two
        or more redirects are worth cleaning up. Edit the link to point at the final address we show, and use https:// rather
        than http:// wherever the site supports it.
      </>
    ),
  },
  {
    q: "How often should I check for broken links?",
    a: (
      <>
        Check your most important pages, such as your home, services and contact pages, about once a month, and again after
        you redesign the site, rename pages or move to a new platform. Links to other websites break over time without
        warning, so a regular check catches them before customers do.
      </>
    ),
  },
  {
    q: "How many links does the free tool check?",
    a: (
      <>
        It checks up to {LINK_CHECK_LIMITS.maxTargets} unique links and images on one page, waits up to {TIMEOUT_S} seconds for
        each one and stops after about 25 seconds in total. You can run it 5 times an hour. To check every page on your site
        automatically, use the site audit in a free trial.
      </>
    ),
  },
];
