import type { Metadata } from "next";
import { Bot, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { FinalCta, IconTile, JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { FreeCheckTool } from "@/components/marketing/free-check-tool";
import { LinkButton, SectionHeading } from "@/components/ui";
import { LeadBox } from "../_components/lead-box";

const PATH = "/tools/ai-mention-checker";
const TITLE = "Free AI Visibility Checker: can ChatGPT find your business?";
const DESCRIPTION =
  "Free check: can ChatGPT, Gemini and other AI tools read your website well enough to name your business? See your score and what to fix, in plain words. No sign-up.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { title: `${TITLE} · ${BRAND.name}`, description: DESCRIPTION, url: PATH, siteName: BRAND.name, type: "website" },
};

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
      <FinalCta title="See exactly what AI says about you" body={<p>Real answers from ChatGPT, Gemini and Perplexity, plus the fixes that help most. 7 days free.</p>} />
    </>
  );
}
