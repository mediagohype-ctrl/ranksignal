import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Link2, LineChart, MessageSquare, ShieldAlert, Users } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { IconTile, JsonLd, PageHero, Section } from "@/components/marketing/ui";
import { QaSection, type Qa } from "@/components/marketing/answers";
import { ServicesCta } from "@/components/marketing/services-ui";
import {
  CUSTOM_CONTACT_HREF, CUSTOM_PLAN, DFY_PLAN, SELF_PLAN, TRIAL_DAYS, aiCheckedLine, engineNamesLine, gstOn, inr, newTabProps, num, priceNote,
} from "@/components/marketing/plans";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { breadcrumbLd, faqLdFromQa, webPageLd } from "@/lib/seo/schema";

const PATH = "/features/ai-visibility-tracking" as const;

export const metadata: Metadata = staticPageMetadata(PATH);

const SELF_ENGINES = engineNamesLine(SELF_PLAN.id);
const GST = gstOn() ? " + GST" : "";

const TRACKS = [
  {
    icon: MessageSquare,
    title: "How often each AI assistant names you",
    body: `For every customer question, we save the full answer from ${SELF_ENGINES} and mark whether it named your business. You see "named in X of Y answers" overall and for each AI assistant, because they often answer the same question very differently.`,
  },
  {
    icon: Users,
    title: "Who gets named instead",
    body: "We count the other businesses each answer names. You see how often you are named compared with the competitors you track, and which other names keep coming up.",
  },
  {
    icon: Link2,
    title: "Links to your website",
    body: "Some AI answers link to the websites they used. We list every website the answers linked to, highlight yours, and show how many answers linked to your pages.",
  },
  {
    icon: ShieldAlert,
    title: "Wrong facts about you",
    body: "AI tools sometimes get your hours, prices or address wrong. We pull out what they say about you so you can mark each fact right or wrong. A wrong fact becomes a task on your to-do list with the steps to correct it.",
  },
  {
    icon: LineChart,
    title: "Change over the weeks",
    body: "Every check is saved. Your score history and monthly report show how often you were named this time compared with last time, so you can see whether your fixes moved anything.",
  },
];

const STEPS = [
  {
    title: "Pick your customer questions",
    body: `We suggest the questions your customers ask, such as "best bakery near Indiranagar". You can edit them. ${SELF_PLAN.name} tracks up to ${num(SELF_PLAN.limits.maxTrackedPrompts)} questions.`,
  },
  {
    title: "We ask the AI assistants every week",
    body: `${aiCheckedLine(SELF_PLAN.id)}. Each check asks up to ${SELF_PLAN.ai.questionsPerCheck} of your questions, with web search on where the assistant offers it, like a real customer would.`,
  },
  {
    title: "You read the results on one page",
    body: "Open any question to read exactly what each AI assistant said, who it named and which websites it linked to.",
  },
  {
    title: "You fix what holds you back",
    body: "We turn what we find into a to-do list in plain words, most important first. Then the next check shows whether it helped.",
  },
];

const FAQ: Qa[] = [
  {
    q: "What is an AI visibility tracking tool?",
    a: (
      <>
        It is a tool that asks AI assistants such as ChatGPT, Gemini and Perplexity the questions your customers ask, saves the answers, and shows how
        often your business is named, who is named instead and which websites the answers link to. {BRAND.name} does this every week and keeps the
        history, so you can see change over time.
      </>
    ),
  },
  {
    q: "Which AI assistants do you track?",
    a: (
      <>
        {SELF_PLAN.name} tracks {SELF_ENGINES}. On {DFY_PLAN.name}, our team can track up to five AI assistants, adding Claude and Grok. Each answer is
        one question asked to one AI assistant.
      </>
    ),
  },
  {
    q: "Can you make ChatGPT mention my business?",
    a: (
      <>
        No one can promise that. AI answers are written by other companies&apos; systems and change from day to day. We show you what the answers
        say, what is missing on your website and listings, and whether things changed after you fixed them. Read{" "}
        <Link href="/learn/improve-ai-search-visibility">how to improve your AI search visibility</Link>.
      </>
    ),
  },
  {
    q: "Is this an AI visibility tool for agencies?",
    a: (
      <>
        Yes, on a Custom plan: many websites, brands or cities, reports with your logo for your clients, a dedicated team, and API and dashboard
        access. <a href={CUSTOM_CONTACT_HREF}>Message us on WhatsApp</a> to talk about it.
      </>
    ),
  },
  {
    q: "How is this different from the free AI visibility checker?",
    a: (
      <>
        The <Link href="/tools/ai-visibility-checker">free checker</Link> asks one question once, so you get a quick snapshot. Tracking asks all your
        customer questions every week, saves every answer, follows your competitors and wrong facts, and shows the trend. That is what you need to
        tell a real change from a one-off answer.
      </>
    ),
  },
];

export default function AiVisibilityTrackingPage() {
  return (
    <>
      <JsonLd
        data={[
          webPageLd(PATH),
          faqLdFromQa(FAQ),
          breadcrumbLd([
            { name: "Features", path: "/features" },
            { name: "AI visibility tracking", path: PATH },
          ]),
        ]}
      />
      <PageHero
        eyebrow="AI visibility tracking"
        title="AI visibility tracking: see when ChatGPT, Gemini and Perplexity mention your brand"
        intro={
          <p>
            More customers now ask AI assistants which business to choose. {BRAND.name} asks them your customers&apos; questions every week and shows
            you, in plain words, whether you are named, who is named instead and what the answers get wrong.
          </p>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <LinkButton href="/tools/ai-visibility-checker" size="lg" variant="accent" iconRight={<ArrowRight />}>
            Check my business free
          </LinkButton>
          <Link href="/pricing" className="text-body font-medium text-navy-fg underline decoration-navy-fg/40 underline-offset-4 hover:decoration-navy-fg">
            See plans and prices
          </Link>
        </div>
      </PageHero>

      {/* ------------------------------------------------------------ What it tracks */}
      <Section labelledBy="avt-tracks">
        <div className="max-w-3xl">
          <h2 id="avt-tracks" className="text-h2 text-fg">
            What the AI brand monitoring tool tracks
          </h2>
          <p className="mt-4 text-lead text-fg-soft">
            Five things, for every customer question and every AI assistant. All of it comes from the real answers we save, so you can always open
            an answer and read it yourself.
          </p>
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {TRACKS.map((t) => (
            <li key={t.title} className="mk-reveal rounded-2xl border border-border bg-surface p-6 shadow-card sm:p-7">
              <div className="flex items-center gap-4">
                <IconTile>
                  <t.icon />
                </IconTile>
                <h3 className="text-h4 text-fg">{t.title}</h3>
              </div>
              <p className="mt-4 text-body leading-relaxed text-fg-soft">{t.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 max-w-3xl text-small text-muted">
          AI answers change between runs and between assistants. Our numbers describe the answers we collected, and we always show how many answers
          they are based on. They are not a promise about future answers. Learn{" "}
          <Link href="/learn/how-to-measure-geo" className="font-medium text-primary underline-offset-4 hover:underline">
            how to measure GEO
          </Link>{" "}
          the honest way.
        </p>
      </Section>

      {/* ------------------------------------------------------------ How it works */}
      <Section labelledBy="avt-how" tone="surface">
        <div className="max-w-3xl">
          <h2 id="avt-how" className="text-h2 text-fg">
            How ChatGPT brand mention tracking works
          </h2>
          <p className="mt-4 text-lead text-fg-soft">You set it up once. After that it runs by itself every week.</p>
        </div>
        <ol className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="mk-reveal rounded-2xl border border-border bg-bg p-6">
              <span className="text-small font-medium tabular-nums text-primary">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-3 text-h4 text-fg">{s.title}</h3>
              <p className="mt-2 text-body leading-relaxed text-fg-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------------ For agencies */}
      <Section labelledBy="avt-agencies">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <h2 id="avt-agencies" className="text-h2 text-fg">
              An AI visibility tool for agencies
            </h2>
            <p className="mt-4 text-lead text-fg-soft">
              Looking after many clients? Our {CUSTOM_PLAN.name} plan is built around you, for agencies and bigger companies.
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
              <li key={i} className="flex gap-3 rounded-xl border border-border bg-surface p-4 text-body text-fg-soft">
                <Check aria-hidden size={18} className="mt-1 shrink-0 text-success" />
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ------------------------------------------------------------ Plans */}
      <Section labelledBy="avt-plans" tone="surface">
        <div className="max-w-3xl">
          <h2 id="avt-plans" className="text-h2 text-fg">
            Plans and prices
          </h2>
          <p className="mt-4 text-lead text-fg-soft">
            The same AI search visibility platform on every plan. Choose who does the work.
          </p>
        </div>
        <ul className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <li className="rounded-2xl border border-border bg-bg p-6 sm:p-7">
            <h3 className="text-h4 text-fg">{SELF_PLAN.name}</h3>
            <p className="mt-2 text-h3 text-fg">
              {inr(SELF_PLAN.price)}
              <span className="text-small font-normal text-muted"> /month{GST}</span>
            </p>
            <p className="mt-3 text-body text-fg-soft">
              {aiCheckedLine(SELF_PLAN.id)}, up to {SELF_PLAN.ai.questionsPerCheck} questions each time. You make the fixes. {TRIAL_DAYS}-day free
              trial, no card needed.
            </p>
            <p className="mt-4">
              <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
                Start free trial
              </Link>
            </p>
          </li>
          <li className="rounded-2xl border border-border bg-bg p-6 sm:p-7">
            <h3 className="text-h4 text-fg">{DFY_PLAN.name}</h3>
            <p className="mt-2 text-h3 text-fg">
              {inr(DFY_PLAN.price)}
              <span className="text-small font-normal text-muted"> /month{GST}</span>
            </p>
            <p className="mt-3 text-body text-fg-soft">
              Up to five AI assistants, including Claude and Grok. Our team tracks the answers, corrects wrong facts and does the fixes. No setup fee,{" "}
              {DFY_PLAN.termNote}.
            </p>
            <p className="mt-4">
              <Link href="/done-for-you" className="font-medium text-primary underline-offset-4 hover:underline">
                See Do it for me
              </Link>
            </p>
          </li>
          <li className="rounded-2xl border border-border bg-bg p-6 sm:p-7">
            <h3 className="text-h4 text-fg">{CUSTOM_PLAN.name}</h3>
            <p className="mt-2 text-h3 text-fg">{CUSTOM_PLAN.priceLabel}</p>
            <p className="mt-3 text-body text-fg-soft">{CUSTOM_PLAN.blurb} Many websites, reports with your logo, API and dashboard access.</p>
            <p className="mt-4">
              <a
                href={CUSTOM_CONTACT_HREF}
                {...newTabProps(CUSTOM_CONTACT_HREF)}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {CUSTOM_PLAN.cta}
              </a>
            </p>
          </li>
        </ul>
        <p className="mt-8 max-w-3xl text-small text-muted">
          {priceNote()} Comparing tools? Read our guide to the{" "}
          <Link href="/learn/best-ai-visibility-tools" className="font-medium text-primary underline-offset-4 hover:underline">
            best AI visibility tools
          </Link>{" "}
          and our list of{" "}
          <Link href="/compare/semrush-alternatives" className="font-medium text-primary underline-offset-4 hover:underline">
            Semrush alternatives
          </Link>
          . Want your whole website checked too? Try the{" "}
          <Link href="/free-check" className="font-medium text-primary underline-offset-4 hover:underline">
            free website check
          </Link>
          .
        </p>
      </Section>

      <QaSection id="avt-faq" title="AI visibility tracking questions" items={FAQ} />

      <ServicesCta
        title="See what AI says about you today."
        body={
          <p>
            Ask ChatGPT, Gemini and Perplexity one customer question about your business, free and without signing up. Then track it every week when
            you are ready.
          </p>
        }
        primary={{ href: "/tools/ai-visibility-checker", label: "Try the free checker" }}
        secondary={{ href: "/pricing", label: "View pricing" }}
        footnote={`${priceNote()} We measure honestly and never promise a Google position or an AI mention.`}
      />
    </>
  );
}
