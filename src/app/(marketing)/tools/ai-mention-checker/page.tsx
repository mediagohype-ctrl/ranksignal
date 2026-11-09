import type { Metadata } from "next";
import { Bot, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { FinalCta, IconTile, JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { FreeCheckTool } from "@/components/marketing/free-check-tool";
import { LinkButton, SectionHeading } from "@/components/ui";
import { LeadBox } from "../_components/lead-box";
import { QaSection, SourcesList, SourceLink, type Qa } from "@/components/marketing/answers";
import { PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { TRIAL_AI } from "@/components/marketing/plans";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { PAGE_SEO } from "@/lib/seo/pages";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/tools/ai-mention-checker" as const;
const DESCRIPTION = PAGE_SEO[PATH].description;

export const metadata: Metadata = staticPageMetadata(PATH);

const STEPS = [
  { icon: <ShieldCheck />, title: "AI robots can get in", body: "Your site's robot rules file lets ChatGPT, Gemini and Perplexity read your pages." },
  { icon: <Bot />, title: "AI can tell who you are", body: "Your business name, address and services are clear and the same on every page." },
  { icon: <MessageCircleQuestion />, title: "Your pages answer questions", body: "Short, clear answers to what customers ask are what AI quotes and names." },
];

export default function AiMentionCheckerPage() {
  const base = BRAND.appUrl.replace(/\/$/, "");
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "AI mention checker",
          url: `${base}${PATH}`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Any",
          description: DESCRIPTION,
          offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          provider: { "@type": "Organization", name: BRAND.name, url: BRAND.appUrl },
        }}
      />
      <JsonLd
        data={[
          webPageLd(PATH, { base }),
          faqLdFromQa(MORE),
          breadcrumbLd([{ name: "Free tools", path: "/tools" }, { name: "AI visibility checker", path: PATH }], base),
        ]}
      />
      <PageHero
        eyebrow="Free tool"
        title="Free AI visibility checker: can AI find and name your business?"
        intro={
          <p>
            ChatGPT and other AI tools can only name a business they can read and understand. Type your website to see if
            yours is ready, in about 30 seconds.
          </p>
        }
      />
      <section aria-label="Check your website" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing space-y-10">
          <FreeCheckTool />
          <LeadBox tool="ai-mention-checker" />
        </div>
      </section>
      <Section labelledBy="amc-what" tone="surface">
        <SectionHeading id="amc-what" size="lg" align="center" eyebrow="What AI needs" title="Three things AI tools look for" />
        <ul className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.title} className="rounded-2xl border border-border bg-bg p-6">
              <IconTile>{s.icon}</IconTile>
              <h3 className="mt-4 text-h4 text-fg">{s.title}</h3>
              <p className="mt-2 text-small leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-10 max-w-2xl text-center">
          <p className="text-small text-muted">
            This free tool reads your website only. To see if ChatGPT, Gemini and Perplexity <strong className="font-semibold text-fg">actually</strong> name
            you when customers ask, start a free trial — we ask them your customers&apos; questions and show you the answers.
          </p>
          <LinkButton href="/signup" className="mt-6">
            Start free trial
          </LinkButton>
        </div>
      </Section>
      <QaSection id="amc-faq" title="Questions about AI mentions" items={MORE}>
        <SourcesList
          links={[
            { href: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google Search Central: AI features and your website" },
            { href: "https://datatracker.ietf.org/doc/html/rfc9309", label: "IETF RFC 9309: Robots Exclusion Protocol" },
            { href: "https://schema.org/LocalBusiness", label: "schema.org: LocalBusiness", note: "how to state your business details clearly" },
          ]}
        />
      </QaSection>
      <FinalCta title="See exactly what AI says about you" body={<p>Real answers from ChatGPT, Gemini and Perplexity, plus the fixes that help most. 7 days free.</p>} />
    </>
  );
}

const MORE: Qa[] = [
  {
    q: "Why can't ChatGPT find my business?",
    a: (
      <>
        Usually for one of three reasons: your robots.txt file blocks AI robots, your pages don&apos;t say clearly who you
        are and where you work, or few other websites mention you. This free check covers the first two. The rules robots
        follow are set out in the{" "}
        <SourceLink href="https://datatracker.ietf.org/doc/html/rfc9309">Robots Exclusion Protocol</SourceLink>.
      </>
    ),
  },
  {
    q: "How does the full AI check measure mentions?",
    a: (
      <>
        We ask AI assistants the questions your customers ask and record whether each answer names you, links to you or
        recommends a competitor. The free trial includes {TRIAL_AI.summary}, which is {TRIAL_AI.answers} answers in{" "}
        {TRIAL_DAYS} days. The Growth plan covers {PLANS.growth.aiAnswersPerMonth.toLocaleString("en-IN")} AI answers a month.
      </>
    ),
  },
  {
    q: "How long does it take to start getting mentioned?",
    a: (
      <>
        It varies. Fixing robots.txt rules and business details can be done in a day, but AI assistants update what they know
        at different speeds, and some rely on live web search. Honest tracking over several weeks shows whether your mention
        rate is really moving.
      </>
    ),
  },
];
