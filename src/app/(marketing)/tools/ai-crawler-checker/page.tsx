import type { Metadata } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { AiCrawlerChecker } from "../_components/ai-crawler-checker";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { AI_BOTS } from "@/lib/audit/ai-bots";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/ai-crawler-checker" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;
const BOT_COUNT = AI_BOTS.length;
const OWNER_COUNT = new Set(AI_BOTS.map((b) => b.owner)).size;
const ANSWER_BOTS = AI_BOTS.filter((b) => b.purpose !== "training").map((b) => b.token);
const TRAINING_BOTS = AI_BOTS.filter((b) => b.purpose === "training").map((b) => b.token);

export const metadata: Metadata = staticPageMetadata(PATH);

export default function AiCrawlerCheckerPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "AI crawler checker",
            url: `${base}${PATH}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Any",
            description: DESCRIPTION,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          },
          faqLdFromQa(FAQ),
          webPageLd(PATH, { base }),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: "AI crawler checker", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free tool"
        title="Is my site blocked from AI? Free AI crawler checker"
        intro={
          <p>
            Find out whether ChatGPT, Perplexity, Claude, Gemini and other AI tools may read your website. We check your robots.txt and your homepage
            in a few seconds.
          </p>
        }
      />
      <section aria-label="Check AI crawler access" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <AiCrawlerChecker />
          <LeadBox tool="ai-crawler-checker" />
        </div>
      </section>

      <Section labelledBy="acc-what">
        <div className="mx-auto max-w-3xl space-y-5 text-body leading-relaxed text-fg-soft [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
          <h2 id="acc-what" className="text-h2 text-fg">
            What this checker looks at
          </h2>
          <p>
            We check {BOT_COUNT} AI crawler names from {OWNER_COUNT} companies against your robots.txt file and tell you, for each one, whether it may
            read your homepage. We also read your homepage for page-level instructions: the robots meta tag, bot-specific tags such as
            meta name=&quot;googlebot&quot;, and the X-Robots-Tag header. We look for noindex, nosnippet, max-snippet:0, noai and noimageai.
          </p>

          <h2 className="pt-6 text-h2 text-fg">Two kinds of AI crawler, two different choices</h2>
          <p>
            <strong className="text-fg">AI search and answers</strong> ({ANSWER_BOTS.join(", ")}) fetch pages to answer a question and usually link to
            the source. Block these and those tools can&apos;t quote you or send you visitors. For most businesses that want customers, that is a loss.
          </p>
          <p>
            <strong className="text-fg">AI training</strong> ({TRAINING_BOTS.join(", ")}) collect pages to train future AI models. Blocking them is a
            reasonable business choice, for example if your content is what you sell. It does not stop AI search tools from finding you, because
            OpenAI, Anthropic and others use separate crawlers for each job.
          </p>
          <p>
            Google-Extended needs a special note. It is a robots.txt token, not a separate crawler: Googlebot does all the fetching. Blocking
            Google-Extended only tells Google not to use your pages for training and grounding Gemini models. According to{" "}
            <SourceLink href="https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers">Google&apos;s crawler documentation</SourceLink>,
            it does not affect your ranking in Google Search. AI Overviews in Google Search follow your normal Googlebot rules and snippet settings.
          </p>

          <h2 className="pt-6 text-h2 text-fg">How to fix what we find</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong className="text-fg">A search crawler is blocked by mistake.</strong> Find its User-agent group in robots.txt and remove the
              Disallow: / line, or use our &quot;allow AI search, block training&quot; snippet.
            </li>
            <li>
              <strong className="text-fg">Everything is blocked.</strong> A Disallow: / under User-agent: * blocks every crawler that has no group of its
              own, Google included. Unless the site is private on purpose, delete that line.
            </li>
            <li>
              <strong className="text-fg">noindex on the homepage.</strong> Remove it in your SEO plugin or page settings. In WordPress, also check that
              &quot;Discourage search engines&quot; is switched off.
            </li>
            <li>
              <strong className="text-fg">nosnippet or max-snippet:0.</strong> Google won&apos;t quote this page in results or AI Overviews. Keep it only if
              you really want no text shown.
            </li>
            <li>
              <strong className="text-fg">noai or noimageai.</strong> These are not official standards. Google and OpenAI don&apos;t document support for
              them, so use robots.txt groups if you want to opt out of training.
            </li>
          </ol>
          <p>
            Changes are not instant. Google usually refreshes its copy of robots.txt within 24 hours, and other crawlers set their own schedules. Test
            any rule with our <Link href="/tools/robots-txt-tester">robots.txt tester</Link>. To see whether AI tools actually mention your business,
            run the <Link href="/free-check">free website check</Link> or <Link href="/signup">start a 7-day free trial</Link>.
          </p>
        </div>
      </Section>

      <QaSection id="acc-faq" tone="surface" title="AI crawler questions" items={FAQ}>
        <SourcesList
          links={[
            { href: "https://platform.openai.com/docs/bots", label: "OpenAI: Overview of OpenAI crawlers", note: "GPTBot, OAI-SearchBot and ChatGPT-User" },
            { href: "https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers", label: "Google Search Central: Google's common crawlers", note: "includes Google-Extended" },
            { href: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google Search Central: AI features and your website" },
            { href: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag", label: "Google Search Central: Robots meta tag and X-Robots-Tag" },
            { href: "https://www.rfc-editor.org/rfc/rfc9309.html", label: "RFC 9309: Robots Exclusion Protocol" },
          ]}
        />
      </QaSection>
    </>
  );
}

const FAQ: Qa[] = [
  {
    q: "Should I block AI crawlers?",
    a: (
      <>
        Block AI training crawlers if you don&apos;t want your content used to train models; that is a fair choice. Think twice before blocking AI
        search crawlers such as OAI-SearchBot or PerplexityBot. They are how AI tools find, quote and link to businesses when people ask for
        recommendations.
      </>
    ),
  },
  {
    q: "Does blocking GPTBot remove me from ChatGPT?",
    a: (
      <>
        No. GPTBot collects training data. ChatGPT search uses a different crawler, OAI-SearchBot, and OpenAI treats each setting separately. You can
        block GPTBot and still allow OAI-SearchBot, so ChatGPT can show and link to your pages in its answers.
      </>
    ),
  },
  {
    q: "Does blocking Google-Extended hide me from AI Overviews?",
    a: (
      <>
        No. Google-Extended only controls whether Google may use your content to train and ground Gemini models. AI Overviews are part of Google
        Search and follow your normal Googlebot rules. To limit them, Google points to the nosnippet and max-snippet controls, which also affect your
        normal search snippets.
      </>
    ),
  },
  {
    q: "Do AI crawlers always obey robots.txt?",
    a: (
      <>
        The major companies say their crawlers do, but robots.txt is a request, not a lock. Some user-initiated fetchers, such as ChatGPT-User, may not
        apply it the same way, because a person asked for that page. Content that must stay private belongs behind a login.
      </>
    ),
  },
  {
    q: "How long until a change takes effect?",
    a: (
      <>
        Google usually refreshes its saved copy of robots.txt within 24 hours. Other AI companies don&apos;t all publish a schedule, so allow a few days.
        Pages already collected for training are not removed by a new rule; it only affects future crawling.
      </>
    ),
  },
];
