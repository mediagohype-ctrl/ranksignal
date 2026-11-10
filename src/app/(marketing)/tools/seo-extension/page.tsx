import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Braces, Heading, Lock, Share2, Tag } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { IconTile, JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { QaSection, SourcesList, type Qa } from "@/components/marketing/answers";
import { DESCRIPTION_MAX, THIN_WORDS, TITLE_MAX } from "@/lib/audit/rules";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

// Not in PAGE_SEO yet, so metadata is set here directly (title ≤ 48 characters, description 120–155).
const PATH = "/tools/seo-extension";
const TITLE = "Free SEO Browser Extension for Chrome and Edge";
const DESCRIPTION =
  "Check any page's SEO and AI readiness in one click: titles, headings, schema, share tags and AI robot rules. Runs in your browser. Free, no sign-up.";
const NAME = "MyWebRank SEO Check browser extension";

export const metadata: Metadata = staticPageMetadata("/tools/seo-extension");

const CHECKS = [
  {
    icon: <Tag />,
    title: "Google headline and summary",
    body: `Title and meta description with their length, using the same limits as our full report (${TITLE_MAX} and ${DESCRIPTION_MAX} characters), plus the canonical link, robots meta tag and page language.`,
  },
  {
    icon: <Heading />,
    title: "Headings and content",
    body: `The H1 to H6 outline with missing, repeated, empty and skipped headings marked, the word count (we flag pages under ${THIN_WORDS} words), images with no alt text and internal and external link counts.`,
  },
  {
    icon: <Braces />,
    title: "Structured data",
    body: "Every JSON-LD type on the page, such as LocalBusiness, Product or FAQPage, and a warning if the code is broken.",
  },
  {
    icon: <Share2 />,
    title: "Share previews and languages",
    body: "Open Graph and X (Twitter) tags that control link previews on WhatsApp, LinkedIn and Facebook, and hreflang language versions.",
  },
  {
    icon: <Bot />,
    title: "AI readiness",
    body: "Question headings, FAQPage markup, whether the site has an llms.txt file, and which AI robots (ChatGPT, Perplexity, Claude and others) its robots.txt lets in.",
  },
  {
    icon: <Lock />,
    title: "Private by design",
    body: "The checks run inside your browser. The extension only reads the tab you click it on, and nothing is sent to us unless you click a link to our website.",
  },
];

const prose =
  "mx-auto max-w-3xl text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline [&_code]:text-small";

export default function SeoExtensionPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: NAME,
            url: `${base}${PATH}`,
            applicationCategory: "BrowserApplication",
            operatingSystem: "Chrome, Microsoft Edge",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
            provider: { "@type": "Organization", name: BRAND.name, url: BRAND.appUrl },
          },
          faqLdFromQa(FAQ),
          webPageLd(PATH, { base, name: TITLE, description: DESCRIPTION }),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: "SEO browser extension", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free browser extension"
        title="Check any page's SEO and AI readiness in one click"
        intro={
          <p>
            The {BRAND.name} extension for Chrome and Microsoft Edge shows a page&apos;s Google headline, summary, headings,
            structured data, share tags and AI robot rules the moment you click its icon. Free, with no sign-up.
          </p>
        }
      >
        <p role="note" className="max-w-2xl rounded-2xl border border-border bg-surface px-4 py-3 text-small text-fg">
          <strong className="font-semibold">Coming soon to the Chrome Web Store.</strong> Until then, run the same checks
          with our{" "}
          <Link href="/free-check" className="font-medium text-primary underline-offset-4 hover:underline">
            free website check
          </Link>
          .
        </p>
      </PageHero>

      <Section labelledBy="ext-what" tone="surface">
        <h2 id="ext-what" className="text-center text-h2 text-fg">
          What the extension checks
        </h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CHECKS.map((c) => (
            <li key={c.title} className="rounded-2xl border border-border bg-bg p-6">
              <IconTile>{c.icon}</IconTile>
              <h3 className="mt-4 text-h4 text-fg">{c.title}</h3>
              <p className="mt-2 text-small leading-relaxed text-muted">{c.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="ext-how">
        <div className={prose}>
          <h2 id="ext-how" className="text-h2 text-fg">
            How it works
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5">
            <li>Open any web page: your own site, a competitor or a client.</li>
            <li>Click the {BRAND.name} icon in the toolbar.</li>
            <li>
              Read the checks, grouped into Google basics, headings, content and links, structured data and sharing, and AI
              readiness. Problems come first.
            </li>
            <li>
              For the whole site, press <strong>Run the full free check</strong>. It opens our{" "}
              <Link href="/free-check">free website check</Link> with the site already filled in, which reads the homepage and
              main pages and gives SEO, AEO and GEO scores.
            </li>
          </ol>

          <h2 className="mt-12 text-h2 text-fg">Your privacy</h2>
          <p className="mt-4">
            The extension asks for the smallest set of browser permissions: <code>activeTab</code> and <code>scripting</code>.
            It can only read the tab you click it on, at the moment you click. To check AI robot rules it reads{" "}
            <code>/robots.txt</code> and <code>/llms.txt</code> from that same website. It has no tracking, no analytics and
            no account, and it never sends the page to {BRAND.name}. Data only reaches us if you click a link to our website.
          </p>

          <h2 className="mt-12 text-h2 text-fg">One page or the whole site?</h2>
          <p className="mt-4">
            The extension checks one page at a time, which is ideal while you edit a page or look at a competitor. Our free tools
            go deeper on one topic, such as the <Link href="/tools/meta-tag-checker">meta tag checker</Link>,{" "}
            <Link href="/tools/heading-checker">heading checker</Link>, <Link href="/tools/schema-checker">schema checker</Link>{" "}
            and <Link href="/tools/ai-crawler-checker">AI crawler checker</Link>. A paid plan checks every page of your site each
            month and asks AI assistants about your business. <Link href="/pricing">See pricing</Link>.
          </p>
        </div>
      </Section>

      <QaSection id="ext-faq" tone="surface" title="Questions about the extension" items={FAQ}>
        <SourcesList
          links={[
            { href: "https://developer.chrome.com/docs/extensions/develop/concepts/activeTab", label: "Chrome for Developers: the activeTab permission" },
            { href: "https://developers.google.com/search/docs/appearance/title-link", label: "Google Search Central: influencing title links" },
            { href: "https://datatracker.ietf.org/doc/html/rfc9309", label: "IETF RFC 9309: Robots Exclusion Protocol (robots.txt)" },
          ]}
        />
      </QaSection>
    </>
  );
}

const FAQ: Qa[] = [
  {
    q: "Is the MyWebRank SEO extension free?",
    a: <>Yes. The extension is free, with no account and no limit on how many pages you check.</>,
  },
  {
    q: "Which browsers does it work in?",
    a: (
      <>
        Google Chrome and Microsoft Edge, and other browsers built on Chromium that support Chrome extensions. It is coming
        soon to the Chrome Web Store.
      </>
    ),
  },
  {
    q: "Does the extension send my pages to MyWebRank?",
    a: (
      <>
        No. Every check runs inside your browser on the tab you clicked. The only time anything reaches us is when you click a
        link in the extension, such as Run the full free check, which opens our website with the site address filled in.
      </>
    ),
  },
  {
    q: "Why can't it read some pages?",
    a: (
      <>
        Browsers do not let extensions read their own settings pages, the Chrome Web Store or built-in PDF views. On those
        pages the extension says so. Our <Link href="/free-check">free website check</Link> works on any public website.
      </>
    ),
  },
  {
    q: "Does it use the same rules as the full report?",
    a: (
      <>
        Yes. The title and description limits, the thin-content threshold and the list of AI robots are copied from the same
        rules our full website report uses, so the two never disagree.
      </>
    ),
  },
];
