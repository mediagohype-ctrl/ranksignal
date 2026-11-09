import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, FileText, MessageCircleQuestion, ScanSearch } from "lucide-react";
import { IconTile, JsonLd, PageHero } from "@/components/marketing/ui";
import { QaSection, SourcesList, type Qa } from "@/components/marketing/answers";
import { MAX_ENGINES, PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { MAX_KEY_PAGES } from "@/lib/free-check/run";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

export const metadata: Metadata = staticPageMetadata("/tools");

const TOOLS = [
  { href: "/tools/ai-mention-checker", icon: <Bot />, title: "AI mention checker", body: "Can ChatGPT and other AI tools read your website well enough to name you?" },
  { href: "/tools/faq-markup-maker", icon: <MessageCircleQuestion />, title: "FAQ code maker", body: "Turn your customers' questions into info for Google and AI." },
  { href: "/tools/ai-guide-file-maker", icon: <FileText />, title: "AI guide file maker", body: "Tell AI tools who you are and which pages matter (llms.txt)." },
  { href: "/free-check", icon: <ScanSearch />, title: "Free website check", body: "Your score out of 100 and the top things to fix, in 30 seconds." },
];

export default function ToolsPage() {
  return (
    <>
      <JsonLd
        data={[webPageLd("/tools", { type: "CollectionPage" }), faqLdFromQa(TOOLS_FAQ), breadcrumbLd([{ name: "Free tools", path: "/tools" }])]}
      />
      <PageHero eyebrow="Free tools" title="Free tools to get found on Google and AI" intro={<p>Simple, free and no sign-up. Made for small business owners.</p>} />
      <section className="bg-bg py-12 sm:py-16">
        <ul className="container-marketing grid gap-6 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <li key={t.href}>
              <Link href={t.href} className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-6 transition hover:border-primary">
                <IconTile>{t.icon}</IconTile>
                <h2 className="mt-4 text-h4 text-fg">{t.title}</h2>
                <p className="mt-2 flex-1 text-small text-muted">{t.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-small font-medium text-primary">
                  Open tool <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
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
        The AI mention checker and the free check read your robots.txt rules, page titles, headings, business details and
        structured data. The FAQ code maker writes FAQPage code for your questions and answers. The AI guide file maker
        writes an llms.txt file listing who you are and which pages matter most.
      </>
    ),
  },
  {
    q: "Are the tools really free, and do you keep my data?",
    a: (
      <>
        Yes, they are free and need no sign-up. The FAQ code maker and AI guide file maker run in your browser, so what you
        type stays on your device. The free check reads your public pages to score them and does not store the pages it
        reads.
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
