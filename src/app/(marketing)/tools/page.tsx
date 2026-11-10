import type { Metadata } from "next";
import Link from "next/link";
import { AlignLeft, ArrowRight, Bot, Braces, FileText, Heading, Link2Off, Map, Puzzle, MessageCircleQuestion, ScanSearch, ShieldCheck, Sparkles, Tag, Type } from "lucide-react";
import { IconTile, JsonLd, PageHero } from "@/components/marketing/ui";
import { ToolPreview, type ToolPreviewKind } from "@/components/marketing/showcase/tool-preview";
import { QaSection, SourcesList, type Qa } from "@/components/marketing/answers";
import { MAX_ENGINES, PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { MAX_KEY_PAGES } from "@/lib/free-check/run";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/tools");

interface Tool {
  href: string;
  icon: React.ReactNode;
  /** Tiny picture of what the tool gives back. */
  preview: ToolPreviewKind;
  title: string;
  body: string;
}

/** Every free tool, grouped by the job it does. Keep in step with PAGE_SEO (src/lib/seo/pages.ts). */
const TOOL_GROUPS: { id: string; title: string; intro: string; tools: Tool[] }[] = [
  {
    id: "check",
    title: "Check your website",
    intro: "Find what's holding a page back on Google, in plain words.",
    tools: [
      { href: "/free-check", preview: "score", icon: <ScanSearch />, title: "Free website check", body: "Your score out of 100 for Google and AI, and the top things to fix." },
      { href: "/tools/meta-tag-checker", preview: "meta", icon: <Tag />, title: "Meta title & description checker", body: "Is your Google headline and summary the right length, and do shares show a preview?" },
      { href: "/tools/heading-checker", preview: "headings", icon: <Heading />, title: "Heading checker", body: "See a page's H1 to H6 outline and spot missing, repeated or skipped headings." },
      { href: "/tools/schema-checker", preview: "schema", icon: <Braces />, title: "Schema markup checker", body: "Find the structured data on a page and the fields Google expects for each type." },
      { href: "/tools/broken-link-checker", preview: "links", icon: <Link2Off />, title: "Broken link checker", body: "Test every link on a page and find the ones that fail, redirect or time out." },
      { href: "/tools/seo-extension", preview: "extension", icon: <Puzzle />, title: "SEO browser extension", body: "Check the title, headings, schema and AI readiness of any page you visit." },
    ],
  },
  {
    id: "ai",
    title: "Google and AI crawlers",
    intro: "Make sure Google, ChatGPT, Gemini and Perplexity can read and list your pages.",
    tools: [
      { href: "/tools/ai-mention-checker", preview: "ai", icon: <Bot />, title: "AI visibility checker", body: "Can ChatGPT and other AI tools read your website well enough to name you?" },
      { href: "/tools/ai-crawler-checker", preview: "crawlers", icon: <ShieldCheck />, title: "Is my site blocked from AI?", body: "See which AI crawlers your robots.txt and pages allow or block." },
      { href: "/tools/robots-txt-tester", preview: "robots", icon: <FileText />, title: "Robots.txt tester", body: "Test any address against your robots.txt for Googlebot and AI crawlers." },
      { href: "/tools/sitemap-checker", preview: "sitemap", icon: <Map />, title: "XML sitemap checker & generator", body: "Check your sitemap for errors and broken entries, or make a new one." },
      { href: "/tools/ai-guide-file-maker", preview: "llms", icon: <FileText />, title: "llms.txt generator", body: "Tell AI tools who you are and which pages matter most." },
    ],
  },
  {
    id: "write",
    title: "Write for Google and AI",
    intro: "Drafts and code you can paste straight into your website.",
    tools: [
      { href: "/tools/seo-title-generator", preview: "titles", icon: <Type />, title: "SEO title generator", body: "5 AI-written title ideas that fit Google's limit, keyword first." },
      { href: "/tools/meta-description-generator", preview: "descriptions", icon: <AlignLeft />, title: "Meta description generator", body: "5 AI-written Google summaries in the right length, with a reason to click." },
      { href: "/tools/faq-generator", preview: "faq", icon: <Sparkles />, title: "AI FAQ generator", body: "Turn a page into real customer questions and short answers, plus FAQ code." },
      { href: "/tools/faq-markup-maker", preview: "faq-code", icon: <MessageCircleQuestion />, title: "FAQ schema generator", body: "Type your own questions and answers and get FAQPage code to paste." },
    ],
  },
];

export default function ToolsPage() {
  return (
    <>
      <JsonLd
        data={[webPageLd("/tools", { type: "CollectionPage" }), faqLdFromQa(TOOLS_FAQ), breadcrumbLd([{ name: "Free tools", path: "/tools" }])]}
      />
      <PageHero eyebrow="Free tools" title="Free tools to get found on Google and AI" intro={<p>{TOOL_COUNT} simple tools, free and with no sign-up. Made for small business owners and the people who run their websites.</p>} />
      {TOOL_GROUPS.map((g, gi) => (
        <section key={g.id} aria-labelledby={`tools-${g.id}`} className={gi === 0 ? "bg-bg pb-6 pt-12 sm:pt-16" : "bg-bg py-6"}>
          <div className="container-marketing">
            <h2 id={`tools-${g.id}`} className="text-h3 text-fg">
              {g.title}
            </h2>
            <p className="mt-1 text-small text-muted">{g.intro}</p>
            <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {g.tools.map((t) => (
                <li key={t.href}>
                  <Link href={t.href} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-6 transition hover:border-primary hover:shadow-card">
                    <ToolPreview kind={t.preview} />
                    <div className="mt-5 flex items-center gap-3">
                      <IconTile>{t.icon}</IconTile>
                      <h3 className="text-h4 text-fg">{t.title}</h3>
                    </div>
                    <p className="mt-2 flex-1 text-small text-muted">{t.body}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-small font-medium text-primary">
                      Open tool <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
      <section className="bg-bg pb-12 pt-6 sm:pb-16">
        <p className="container-marketing text-small text-muted">
          Comparing tools? See how MyWebRank compares with Ahrefs, Semrush and SE Ranking on our{" "}
          <Link href="/compare" className="font-medium text-primary hover:underline">
            comparison page
          </Link>
          .
        </p>
      </section>
      <QaSection
        id="tools-faq"
        tone="surface"
        title="How to use these free tools"
        description="Start with the free check, then use the other tools to fix what it finds."
        items={TOOLS_FAQ}
      >
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data", label: "Google Search Central: introduction to structured data" },
            { href: "https://schema.org/FAQPage", label: "schema.org: FAQPage", note: "the format the FAQ code maker writes" },
            { href: "https://datatracker.ietf.org/doc/html/rfc9309", label: "IETF RFC 9309: Robots Exclusion Protocol", note: "the robots.txt rules our checks read" },
          ]}
        />
      </QaSection>
    </>
  );
}

const starter = PLANS.starter;
const TOOL_COUNT = TOOL_GROUPS.reduce((n, g) => n + g.tools.length, 0);

const TOOLS_FAQ: Qa[] = [
  {
    q: "Which free tool should I use first?",
    a: (
      <>
        Start with the <Link href="/free-check">free website check</Link>. It reads your homepage and up to{" "}
        {MAX_KEY_PAGES} main pages, scores them for Google, answer engines and AI assistants, and lists your top 3 fixes. If
        a fix mentions FAQ code or an AI guide file, the matching tool on this page makes it for you.
      </>
    ),
  },
  {
    q: "What do the free tools check and make?",
    a: (
      <>
        The checkers read one public page or file at a time: titles and descriptions, headings, structured data, links,
        robots.txt rules and sitemaps. The AI writing tools draft titles, descriptions and FAQs for you to review. The FAQ
        schema generator and llms.txt generator write code you paste into your site.
      </>
    ),
  },
  {
    q: "Are the tools really free, and do you keep my data?",
    a: (
      <>
        Yes, they are free and need no sign-up. The FAQ schema generator, llms.txt generator and sitemap generator run in
        your browser, so what you type stays on your device. The checkers read public pages to test them and do not store
        the pages they read. Each tool has a fair-use limit per hour.
      </>
    ),
  },
  {
    q: "Do I need technical skills to use them?",
    a: (
      <>
        No. Each tool asks plain questions and gives you a file or a block of code to copy. If you use WordPress, Wix or
        Shopify, you can usually paste the code yourself in a few minutes. Otherwise, send it to whoever looks after your
        website, along with a link to the tool page.
      </>
    ),
  },
  {
    q: "What do I get if I need more than the free tools?",
    a: (
      <>
        The full report reads up to {starter.maxPagesPerCrawl.toLocaleString("en-IN")} pages per check on the {starter.name}{" "}
        plan and asks up to {MAX_ENGINES} AI assistants your customers&apos; real questions. Paid plans start at ₹
        {(starter.priceInrMonthly ?? 0).toLocaleString("en-IN")} a month, after a {TRIAL_DAYS}-day free trial. See{" "}
        <Link href="/pricing">pricing</Link>.
      </>
    ),
  },
];
