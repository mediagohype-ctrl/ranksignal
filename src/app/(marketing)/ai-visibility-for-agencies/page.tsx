import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, FileText, LayoutGrid, Link2, MessageSquare, Plug, Users } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { IconTile, JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { QaSection, type Qa } from "@/components/marketing/answers";
import { ServicesCta } from "@/components/marketing/services-ui";
import { CUSTOM_CONTACT_HREF, CUSTOM_PLAN, DFY_PLAN, newTabProps, priceNote } from "@/components/marketing/plans";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

// Landing page for "AI visibility tool for agencies" (SEO sheet, 27 Nov 2026). Every claim here maps to a real
// feature: the Custom plan (plans.ts), the "All websites" screen (/app/portfolio), white-label branding
// (docs#branding), shared report links (/r/…), monthly reports and the API / MCP / Looker Studio connector (docs/api).
const PATH = "/ai-visibility-for-agencies" as const;

export const metadata: Metadata = staticPageMetadata(PATH, {
  keywords: ["AI visibility tool for agencies", "AI visibility for agencies", "GEO tool for agencies", "white label AI visibility report"],
});

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "Every client on one screen",
    body: "The All websites screen lists each client's scores, the change since the last check, how often AI answers name them, urgent problems and their monthly report.",
  },
  {
    icon: MessageSquare,
    title: "ChatGPT and Gemini mentions per client",
    body: "For each client we ask the AI assistants the questions their customers ask, save the full answers, and show how often the client is named and who is named instead.",
  },
  {
    icon: Check,
    title: "SEO, AEO and GEO scores with fixes",
    body: "Each website gets four scores (SEO, AEO, GEO and Brand) and a to-do list in plain words, most important first, with ready-to-paste fixes.",
  },
  {
    icon: FileText,
    title: "Reports with your logo",
    body: `Set your agency name, logo, accent colour, reply-to email and footer line once. Shared report links, monthly reports and report emails use them. ${CUSTOM_PLAN.name} plans can also hide the "Powered by ${BRAND.name}" line.`,
  },
  {
    icon: Link2,
    title: "Report links clients can open",
    body: "Send a client a link to their report. They read it in the browser without an account, so you never have to export screenshots.",
  },
  {
    icon: Plug,
    title: "API, MCP and Looker Studio",
    body: "Pull scores, issues and AI visibility into your own dashboards with the read-only API, an MCP server for AI assistants, or the Looker Studio connector.",
  },
];

const FAQ: Qa[] = [
  {
    q: "What is an AI visibility tool for agencies?",
    a: (
      <>
        It is a tool that checks, for each of your clients, whether AI assistants such as ChatGPT, Gemini and Perplexity name the client when
        customers ask for a business like theirs, and shows what to fix. An agency version adds many websites in one account, reports with your
        own logo and ways to send results to clients.
      </>
    ),
  },
  {
    q: "How many client websites can I add?",
    a: (
      <>
        The {CUSTOM_PLAN.name} plan is built around your number of websites, brands, cities or countries.{" "}
        <a href={CUSTOM_CONTACT_HREF}>Message us on WhatsApp</a> with how many clients you look after and we will size the plan.
      </>
    ),
  },
  {
    q: "Can the reports carry my agency's brand instead of yours?",
    a: (
      <>
        Yes. Owners and Admins set the name, logo, accent colour, reply-to email and footer line in Settings → Branding, with a live preview.
        On a {CUSTOM_PLAN.name} plan you can also hide the &quot;Powered by {BRAND.name}&quot; line. See the{" "}
        <Link href="/docs#branding">branding docs</Link>.
      </>
    ),
  },
  {
    q: "Can you do the fixes for my clients?",
    a: (
      <>
        Yes. Our team can do the work on client websites, Google Business Profiles and listings, with approval before anything changes. See{" "}
        <Link href="/done-for-you">{DFY_PLAN.name}</Link>, or ask about a {CUSTOM_PLAN.name} plan with a dedicated team.
      </>
    ),
  },
  {
    q: "Can you promise my clients will be mentioned by ChatGPT?",
    a: (
      <>
        No, and no honest tool can. AI answers are written by other companies&apos; systems and change from run to run. We report rates over many
        saved answers, with the number of answers shown, so you can show clients real change instead of a one-off screenshot. Read{" "}
        <Link href="/learn/how-to-measure-geo">how to measure GEO</Link>.
      </>
    ),
  },
];

export default function AiVisibilityForAgenciesPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageLd(PATH),
          faqLdFromQa(FAQ),
          breadcrumbLd([
            { name: "AI visibility tracking", path: "/features/ai-visibility-tracking" },
            { name: "For agencies", path: PATH },
          ]),
        ]}
      />
      <PageHero
        eyebrow="For agencies"
        title="AI visibility tool for agencies: every client's AI mentions in one dashboard"
        intro={
          <p>
            Your clients are starting to ask why ChatGPT recommends their competitors. {BRAND.name} tracks how often ChatGPT, Gemini and Perplexity
            name each client, shows what to fix, and turns it into reports with your logo that clients understand.
          </p>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <LinkButton href={CUSTOM_CONTACT_HREF} {...newTabProps(CUSTOM_CONTACT_HREF)} size="lg" variant="accent" iconRight={<ArrowRight />}>
            Talk to us about a {CUSTOM_PLAN.name} plan
          </LinkButton>
          <Link
            href="/tools/ai-visibility-checker"
            className="text-body font-medium text-navy-fg underline decoration-navy-fg/40 underline-offset-4 hover:decoration-navy-fg"
          >
            Check one client free first
          </Link>
        </div>
      </PageHero>

      <Section labelledBy="ag-features">
        <div className="max-w-3xl">
          <h2 id="ag-features" className="text-h2 text-fg">
            What agencies get
          </h2>
          <p className="mt-4 text-lead text-fg-soft">
            The same checks we run for single businesses, set up for many clients at once.
          </p>
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="mk-reveal rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-7">
              <div className="flex items-center gap-4">
                <IconTile>
                  <f.icon />
                </IconTile>
                <h3 className="text-h4 text-fg">{f.title}</h3>
              </div>
              <p className="mt-4 text-body leading-relaxed text-fg-soft">{f.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="ag-plan" tone="surface">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <h2 id="ag-plan" className="text-h2 text-fg">
              The {CUSTOM_PLAN.name} plan for agencies
            </h2>
            <p className="mt-4 text-lead text-fg-soft">
              {CUSTOM_PLAN.blurb} {CUSTOM_PLAN.start} Tell us how many clients you look after and what you need.
            </p>
            <p className="mt-6 flex items-center gap-2 text-body text-fg-soft">
              <Users aria-hidden size={18} className="shrink-0 text-primary" />
              Your team members each get their own login.
            </p>
            <p className="mt-6">
              <a
                href={CUSTOM_CONTACT_HREF}
                {...newTabProps(CUSTOM_CONTACT_HREF)}
                className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
              >
                Talk to us on WhatsApp
                <ArrowRight aria-hidden size={16} />
              </a>
            </p>
          </div>
          <ul className="space-y-3 lg:col-span-7">
            {CUSTOM_PLAN.includes.map((i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-border bg-bg p-4 text-body text-fg-soft">
                <Check aria-hidden size={18} className="mt-1 shrink-0 text-success" />
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-8 max-w-3xl text-small text-muted">
          {priceNote()} New to tracking AI answers? Start with{" "}
          <Link href="/features/ai-visibility-tracking" className="font-medium text-primary underline-offset-4 hover:underline">
            how AI visibility tracking works
          </Link>{" "}
          or compare the{" "}
          <Link href="/learn/best-ai-visibility-tools" className="font-medium text-primary underline-offset-4 hover:underline">
            best AI visibility tools
          </Link>
          .
        </p>
      </Section>

      <QaSection id="ag-faq" title="AI visibility for agencies: questions" items={FAQ} />

      <ServicesCta
        title="Show a client what AI says about them today."
        body={
          <p>
            Ask ChatGPT, Gemini and Perplexity one customer question about a client&apos;s business, free and without signing up. Then talk to us
            about tracking all your clients every week.
          </p>
        }
        primary={{ href: "/tools/ai-visibility-checker", label: "Try the free checker" }}
        secondary={{ href: "/contact", label: "Contact us" }}
        footnote={`${priceNote()} We measure honestly and never promise a Google position or an AI mention.`}
      />
    </>
  );
}
