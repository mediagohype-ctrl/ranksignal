import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { RobotsTxtTester } from "../_components/robots-txt-tester";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/robots-txt-tester" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;

export const metadata: Metadata = staticPageMetadata(PATH);

export default function RobotsTxtTesterPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Robots.txt tester",
            url: `${base}${PATH}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          },
          faqLdFromQa(FAQ),
          webPageLd(PATH, { base }),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: "Robots.txt tester", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free tool"
        title="Free robots.txt tester for Google and AI crawlers"
        intro={
          <p>
            See exactly which pages Googlebot, Bingbot, GPTBot, PerplexityBot and other crawlers may read. Fetch your live file or paste a draft,
            then test any page.
          </p>
        }
      />
      <section aria-label="Test your robots.txt" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <RobotsTxtTester />
          <LeadBox tool="robots-txt-tester" />
        </div>
      </section>

      <Section labelledBy="rtt-what">
        <div className="mx-auto max-w-3xl space-y-5 text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          <h2 id="rtt-what" className="text-h2 text-fg">
            What this robots.txt checker does
          </h2>
          <p>
            Your robots.txt file sits at yoursite.com/robots.txt. It tells crawlers which parts of your website they may read. One wrong line can hide
            your whole site from Google or from AI tools such as ChatGPT search, so it is worth checking after every change.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-fg">Fetch result.</strong> We read your live file and explain the answer. A 404 means there is no file, so every
              page may be crawled. A server error (5xx) is worse: Google treats it as if the whole site were blocked until it can read the file again.
            </li>
            <li>
              <strong className="text-fg">Line-by-line check.</strong> We number every line and flag typos such as &quot;Dissallow&quot;, rules that sit
              outside a User-agent group, Sitemap lines that are not full addresses, and rules Google ignores, such as Crawl-delay and noindex.
            </li>
            <li>
              <strong className="text-fg">Crawler test.</strong> Pick a crawler and type a page path. We show Allowed or Blocked and highlight the exact
              line that decides it. You can also open a list of every crawler at once.
            </li>
          </ul>

          <h2 className="pt-6 text-h2 text-fg">How crawlers read robots.txt</h2>
          <p>
            The rules are an internet standard,{" "}
            <SourceLink href="https://www.rfc-editor.org/rfc/rfc9309.html">RFC 9309</SourceLink>, published in September 2022. A crawler first looks
            for a group that names it, such as User-agent: GPTBot. Only if there is none does it follow the User-agent: * group. It never combines
            the two.
          </p>
          <p>
            Inside its group, the crawler uses the most specific rule: the Allow or Disallow line with the longest matching path. So Allow:
            /search/help beats Disallow: /search for the help pages. If an Allow and a Disallow are the same length, Google picks Allow. A * matches any
            characters and a $ marks the end of the address.
          </p>
          <p>
            Google reads only the first 500 KB of the file and ignores the rest. It follows at least five redirects to find it, and it usually
            refreshes its saved copy within 24 hours, so a fix can take a day to show.
          </p>

          <h2 className="pt-6 text-h2 text-fg">How to fix common problems</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-fg">Whole site blocked.</strong> Disallow: / under User-agent: * blocks everyone. It is often left over from a
              staging site. Delete the line or change it to Disallow: with nothing after it.
            </li>
            <li>
              <strong className="text-fg">Important pages blocked.</strong> Test your homepage, service pages and blog. If a rule catches them, make it
              more specific or add a longer Allow line.
            </li>
            <li>
              <strong className="text-fg">CSS and JavaScript blocked.</strong> Google needs these files to see your pages as visitors do. Don&apos;t block
              folders such as /wp-content/ or /assets/.
            </li>
            <li>
              <strong className="text-fg">No Sitemap line.</strong> Add Sitemap: https://yoursite.com/sitemap.xml at the end. Check that file with our{" "}
              <Link href="/tools/sitemap-checker">sitemap checker</Link>.
            </li>
            <li>
              <strong className="text-fg">Trying to hide a page from Google.</strong> robots.txt stops crawling, not indexing. Use a noindex robots meta
              tag instead, and leave the page crawlable so Google can see it.
            </li>
          </ol>
          <p>
            Want to know which AI tools you block, in plain words? Try the{" "}
            <Link href="/tools/ai-crawler-checker">AI crawler checker</Link>. For a full picture of how Google and AI see your site, run the{" "}
            <Link href="/free-check">free website check</Link>, or <Link href="/signup">start a 7-day free trial</Link> to monitor it every week.
          </p>
        </div>
      </Section>

      <QaSection id="rtt-faq" tone="surface" title="Robots.txt questions" items={FAQ}>
        <SourcesList
          links={[
            { href: "https://www.rfc-editor.org/rfc/rfc9309.html", label: "RFC 9309: Robots Exclusion Protocol", note: "the standard this tester follows" },
            { href: "https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt", label: "Google Search Central: How Google interprets robots.txt" },
            { href: "https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt", label: "Google Search Central: Create and submit a robots.txt file" },
            { href: "https://platform.openai.com/docs/bots", label: "OpenAI: Overview of OpenAI crawlers" },
          ]}
        />
      </QaSection>
    </>
  );
}

const FAQ: Qa[] = [
  {
    q: "Do I need a robots.txt file?",
    a: (
      <>
        No. Without one, crawlers may read every page, which is fine for most small business websites. Add a file when you want to keep crawlers
        out of areas like a shopping cart or internal search, or to list your sitemap address.
      </>
    ),
  },
  {
    q: "Does blocking a page in robots.txt remove it from Google?",
    a: (
      <>
        Not always. Robots.txt stops Google from reading a page, but Google can still list the address if other sites link to it, just without a
        description. To keep a page out of results, let Google crawl it and add a noindex robots meta tag.
      </>
    ),
  },
  {
    q: "Which rule wins when Allow and Disallow both match?",
    a: (
      <>
        The longest matching rule wins, because it is the most specific. For example, Allow: /blog/news beats Disallow: /blog for the news pages. If
        both rules are exactly the same length, Google follows the Allow rule. This tester applies the same logic and highlights the winning line.
      </>
    ),
  },
  {
    q: "Why does my User-agent: * rule not apply to GPTBot?",
    a: (
      <>
        Because a crawler that has its own group ignores the * group completely. If your file has a User-agent: GPTBot group, GPTBot follows only
        those lines. Copy any rules you still want, such as Disallow: /cart/, into that group too.
      </>
    ),
  },
  {
    q: "Is it safe to paste my robots.txt here?",
    a: (
      <>
        Yes. Pasted text is checked inside your browser and never leaves your device. When you fetch your live file instead, we read only
        /robots.txt from your site, show it to you and don&apos;t store it. You can run up to 20 fetches an hour.
      </>
    ),
  },
];
