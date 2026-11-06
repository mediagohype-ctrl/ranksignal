import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bot, Search, ShieldCheck, Sparkles } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { IconTile, JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { FreeCheckTool } from "@/components/marketing/free-check-tool";
import { SectionHeading } from "@/components/ui";

const TITLE = "Free website check: is your site ready for Google and AI?";
const DESCRIPTION =
  "Free website check in about 30 seconds. See if Google and AI assistants like ChatGPT can read and understand your website — in plain words. No sign-up.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/free-check" },
  openGraph: { title: `${TITLE} · ${BRAND.name}`, description: DESCRIPTION, url: "/free-check", siteName: BRAND.name, type: "website" },
};

const WHAT: { icon: ReactNode; title: string; body: string }[] = [
  { icon: <Search />, title: "SEO basics", body: "Your Google headlines and summaries, main headings, secure address (the padlock), and whether your pages can appear on Google." },
  { icon: <Sparkles />, title: "Answer-readiness (AEO)", body: "Whether your pages answer real customer questions clearly enough to be quoted." },
  { icon: <Bot />, title: "AI access (GEO)", body: "Whether the robots of ChatGPT, Perplexity and Claude are allowed in, and whether AI can tell who you are." },
  { icon: <ShieldCheck />, title: "Trust signs", body: "Your business details, About and Contact pages, and links to your social profiles." },
];

export default async function FreeCheckPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const initialUrl = typeof sp.url === "string" ? sp.url.slice(0, 2048) : "";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: `${BRAND.name} free website check`,
    url: `${BRAND.appUrl.replace(/\/$/, "")}/free-check`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    description: DESCRIPTION,
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    provider: { "@type": "Organization", name: BRAND.name, url: BRAND.appUrl },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <PageHero
        eyebrow="Free tool"
        title="Is your website ready for Google and AI?"
        intro={
          <p>
            Type your website. We&apos;ll read your homepage and up to four main pages, then score them for SEO, answer
            engines (AEO) and AI assistants (GEO) — with your top 3 fixes, in plain words.
          </p>
        }
      />
      <section aria-label="Run the free check" className="bg-bg py-12 sm:py-16">
        <div className="container-marketing">
          <FreeCheckTool initialUrl={initialUrl} />
        </div>
      </section>
      <Section labelledBy="fc-what" tone="surface">
        <SectionHeading id="fc-what" size="lg" align="center" eyebrow="What we check" title="What the free check looks at" />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHAT.map((w) => (
            <li key={w.title} className="rounded-2xl border border-border bg-bg p-6">
              <IconTile>{w.icon}</IconTile>
              <h3 className="mt-4 text-h4 text-fg">{w.title}</h3>
              <p className="mt-2 text-small leading-relaxed text-muted">{w.body}</p>
            </li>
          ))}
        </ul>
        <p className="mx-auto mt-10 max-w-2xl text-center text-small text-muted">
          This free check reads your website. It does <strong className="font-semibold text-fg">not</strong> ask
          ChatGPT — the full check does, after you sign up. We never store the pages we read.
        </p>
      </Section>
    </>
  );
}
