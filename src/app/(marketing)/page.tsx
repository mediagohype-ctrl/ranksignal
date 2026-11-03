import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, X } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { JsonLd, inkPill } from "@/components/marketing/ui";
import { FreeCheckLauncher } from "@/components/marketing/free-check-launcher";
import { AnswersPanel, ApprovalPanel, EngineStrip, FixPanel, HeroComposition } from "@/components/marketing/home-ui";
import { FAQS } from "@/components/marketing/content";
import { DoneForYouSection, MonthlyProofSection } from "@/components/marketing/home-proof";
import { MARKETING_PLANS, SERVICE_FROM_PRICE, TRIAL_DAYS, inr } from "@/components/marketing/plans";

const TITLE = `${BRAND.name} — Check how Google and AI see your business`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description:
    "Free website check for small businesses. See how Google and AI assistants like ChatGPT and Gemini see your business, get a plain to-do list, and fix it with your OK. Simple SEO and AI search (GEO) in plain words.",
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: BRAND.tagline,
    url: "/",
    siteName: BRAND.name,
    type: "website",
  },
};

const SITE = BRAND.appUrl.replace(/\/$/, "");

const PAINS = [
  "Customers ask ChatGPT or Gemini for a recommendation, and you aren't in the answer.",
  "When AI does mention you, it gets your prices, areas or hours wrong.",
  "Your old website report says “all good”, but it never checks what AI tools say.",
];

const SOLUTION = [
  "Checks what AI assistants say about you, one customer question at a time",
  "Finds the gaps on your website that keep you out of answers",
  "Explains each fix in plain words, step by step",
  "Drafts the change and waits for your OK before anything goes live",
];

const SCORES = [
  { term: "Google health", name: "Google", line: "Can Google find, read and trust your pages?" },
  { term: "Easy to quote", name: "Clear answers", line: "Do your pages answer customer questions in short, clear lines?" },
  { term: "Ready for AI", name: "AI assistants", line: "Can ChatGPT, Gemini and others read your site and link to it?" },
  { term: "AI knows you", name: "Your business facts", line: "When AI describes your business, does it get the facts right?" },
];

const STEPS = [
  { title: "Add your website", body: "Type your website address and the questions your customers ask. Nothing on your site changes." },
  { title: "We check", body: "We read your main pages and ask ChatGPT, Gemini and others your customer questions." },
  { title: "You fix", body: "You get a score and a short to-do list, most useful first, each with clear steps." },
  { title: "You grow", body: "Approve the fixes you want. We check again every cycle so you can see what changed." },
];

const HONEST = [
  {
    title: "No guarantees",
    body: "AI answers are written by other companies' systems. Nobody can promise you a mention, and we won't.",
  },
  {
    title: "Every number shows its count",
    body: "Each number says how many AI answers it comes from, so you know how much to trust it.",
  },
  {
    title: "Every answer saved",
    body: "We keep the full text of each AI answer we collect, so you can read the evidence yourself.",
  },
];

export default function HomePage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: BRAND.name,
      url: SITE,
      logo: `${SITE}/brand/logo-mark-512.png`,
      email: BRAND.supportEmail,
      description: BRAND.tagline,
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: BRAND.supportEmail, url: `${SITE}/contact` },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      name: BRAND.name,
      url: SITE,
      description: BRAND.tagline,
      publisher: { "@id": `${SITE}/#organization` },
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: BRAND.name,
      url: SITE,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: "Audits websites for SEO, answer-engine (AEO) and generative-AI (GEO) readiness and measures how often AI assistants mention and cite a brand.",
      publisher: { "@id": `${SITE}/#organization` },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  const fromPrice = Math.min(...MARKETING_PLANS.map((p) => p.price));

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* ------------------------------------------------------------ Hero */}
      <section aria-labelledby="hero-title" className="relative overflow-hidden">
        <div className="container-marketing pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pb-28 lg:pt-24">
          <h1 id="hero-title" className="mk-hero mk-rise max-w-[13ch] text-fg lg:max-w-none">
            Check. Fix.
            <br className="hidden lg:block" /> <span className="text-primary">Grow.</span>
          </h1>

          <div className="mt-10 grid gap-14 lg:mt-14 lg:grid-cols-12 lg:gap-10">
            <div className="mk-rise mk-delay-1 min-w-0 lg:col-span-5 lg:pt-4">
              <p className="mk-lead max-w-[34rem] text-fg-soft">
                See how Google and AI assistants like ChatGPT see your business. Get a short to-do list in plain
                words. Fix it, so customers can find you more easily.
              </p>
              <FreeCheckLauncher id="hero-url" className="mt-9 max-w-[34rem]" />
              <p className="mt-7">
                <Link
                  href="#sample"
                  className="inline-flex items-center gap-1.5 text-[1rem] font-medium text-fg underline decoration-border-strong underline-offset-[6px] hover:decoration-fg"
                >
                  See a sample report
                  <ArrowRight aria-hidden size={17} />
                </Link>
              </p>
            </div>
            <div className="mk-rise mk-delay-3 min-w-0 lg:col-span-7 lg:col-start-6 lg:-mt-24 xl:col-span-6 xl:col-start-7 xl:-mt-32">
              <HeroComposition />
            </div>
          </div>
        </div>
      </section>

      <EngineStrip />

      {/* ------------------------------------------------------------ Problem → solution */}
      <section aria-labelledby="problem-title" className="py-24 sm:py-32">
        <div className="container-marketing grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="mk-reveal lg:col-span-6">
            <h2 id="problem-title" className="mk-statement max-w-[12ch] text-fg">
              Search changed. Most websites didn&apos;t.
            </h2>
            <ul className="mt-12 max-w-xl divide-y divide-border border-y border-border">
              {PAINS.map((p) => (
                <li key={p} className="mk-body flex gap-4 py-5 text-fg-soft">
                  <X aria-hidden size={20} className="mt-1 shrink-0 text-muted" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="mk-reveal lg:col-span-6 lg:col-start-7 lg:pt-2 xl:col-span-5 xl:col-start-8">
            <div className="rounded-[28px] bg-fg p-8 text-bg sm:p-12">
              <p className="mk-title text-bg">{BRAND.name} closes the gap.</p>
              <ul className="mt-10 space-y-6">
                {SOLUTION.map((s) => (
                  <li key={s} className="mk-body flex gap-4 text-bg/85">
                    <span aria-hidden className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-bg/15">
                      <Check size={14} strokeWidth={2.5} />
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
              <Link href="/features" className={inkPill("lg", true, "mt-12")}>
                See all features
                <ArrowRight aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Four scores */}
      <section id="explained" aria-labelledby="explained-title" className="scroll-mt-20 border-t border-border bg-surface-2/50 py-24 sm:py-32">
        <div className="container-marketing">
          <div className="mk-reveal grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
            <h2 id="explained-title" className="mk-statement text-fg lg:col-span-7">
              One report.
              <br />
              Four scores.
            </h2>
            <p className="mk-lead max-w-md text-fg-soft lg:col-span-4 lg:col-start-9">
              Four simple scores, each out of 100. Together they show how easily customers find you on Google and
              in AI answers.
              <span className="mt-3 block text-small text-muted">(This is what experts call SEO, AEO and GEO.)</span>
            </p>
          </div>
          <dl className="mt-16 grid border-t border-fg sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
            {SCORES.map((s, i) => (
              <div
                key={s.term}
                className={
                  "mk-reveal border-b border-border py-8 sm:px-6 sm:py-10 lg:border-b-0 lg:px-8 " +
                  (i % 2 === 1 ? "sm:border-l " : "") +
                  (i > 0 ? "lg:border-l " : "") +
                  (i === 0 ? "sm:pl-0 lg:pl-0" : "")
                }
              >
                <dt>
                  <span className="block text-[clamp(2.25rem,1.75rem+1.6vw,3.25rem)] font-semibold leading-none tracking-[-0.04em] text-fg">
                    {s.term}
                  </span>
                  <span className="mt-4 block text-small font-medium text-primary">{s.name}</span>
                </dt>
                <dd className="mk-body mt-3 max-w-[22rem] text-fg-soft">{s.line}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------ Product tour */}
      <section id="sample" aria-labelledby="tour-title" className="scroll-mt-20 py-24 sm:py-32">
        <div className="container-marketing">
          <div className="mk-reveal max-w-4xl">
            <p className="mk-label">Inside the product</p>
            <h2 id="tour-title" className="mk-statement mt-5 text-fg">
              Less guessing.
              <br />
              More knowing.
            </h2>
          </div>

          <div className="mt-20 space-y-24 sm:mt-28 sm:space-y-36">
            <TourRow
              index="01"
              title="See what AI says about you"
              body="Each time we check, we ask ChatGPT, Gemini and others the questions your customers ask, and note whether they named you and linked to your site."
              ui={<AnswersPanel />}
            />
            <TourRow
              index="02"
              flip
              title="Know exactly what to fix"
              body="Every problem says what's wrong, why it matters and how to fix it. No jargon, no 80-page report."
              ui={<FixPanel />}
            />
            <TourRow
              index="03"
              title="Nothing changes without your OK"
              body="We draft the exact change. You read it, edit it or approve it. If we change your site for you, we save the old page first so you can undo it."
              ui={<ApprovalPanel />}
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Proof every month */}
      <MonthlyProofSection />

      {/* ------------------------------------------------------------ How it works */}
      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 border-y border-border py-24 sm:py-32">
        <div className="container-marketing">
          <div className="mk-reveal flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <h2 id="how-title" className="mk-statement max-w-[14ch] text-fg">
              Four steps. About a minute to start.
            </h2>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1.5 text-[1rem] font-medium text-fg underline decoration-border-strong underline-offset-[6px] hover:decoration-fg"
            >
              The full process
              <ArrowRight aria-hidden size={17} />
            </Link>
          </div>
          <ol className="mt-16 grid gap-12 sm:grid-cols-2 sm:gap-x-10 lg:mt-24 lg:grid-cols-4 lg:gap-10">
            {STEPS.map((s, i) => (
              <li key={s.title} className="mk-reveal">
                <span aria-hidden className="mk-outline-num block text-[clamp(5rem,3.5rem+5vw,9rem)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-6 text-[1.375rem] font-semibold tracking-[-0.02em] text-fg">
                  <span className="sr-only">Step {i + 1}: </span>
                  {s.title}
                </h3>
                <p className="mk-body mt-3 max-w-[22rem] text-fg-soft">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ Honest measurement */}
      <section id="honest-measurement" aria-labelledby="honest-title" className="py-24 sm:py-32">
        <div className="container-marketing grid gap-12 lg:grid-cols-12 lg:gap-10">
          <h2 id="honest-title" className="mk-reveal mk-title max-w-[18ch] text-fg lg:col-span-5">
            Ask an AI the same question twice and you can get two answers. So we measure honestly.
          </h2>
          <ul className="lg:col-span-6 lg:col-start-7">
            {HONEST.map((h) => (
              <li key={h.title} className="mk-reveal grid gap-2 border-t border-border py-7 first:border-fg sm:grid-cols-[14rem_1fr] sm:gap-8">
                <h3 className="text-[1.125rem] font-semibold tracking-[-0.015em] text-fg">{h.title}</h3>
                <p className="mk-body text-fg-soft">{h.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ Do it yourself, or let us */}
      <DoneForYouSection />

      {/* ------------------------------------------------------------ Pricing teaser */}
      <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 pb-24 sm:pb-32">
        <div className="container-marketing">
          <div className="mk-reveal grid gap-10 rounded-[28px] border border-border bg-surface-2/50 p-8 sm:p-12 lg:grid-cols-12 lg:items-center lg:gap-10 lg:p-16">
            <div className="lg:col-span-5">
              <h2 id="pricing-title" className="mk-title text-fg">
                Plans from {inr(fromPrice)} a month.
              </h2>
              <p className="mk-body mt-4 max-w-md text-fg-soft">
                Every plan starts with a {TRIAL_DAYS}-day free trial. Prices in Indian rupees, plus GST. Cancel any time.
              </p>
              <Link href="/pricing" className={inkPill("lg", false, "mt-8")}>
                Compare plans
                <ArrowUpRight aria-hidden />
              </Link>
              <p className="mt-8 border-t border-border pt-6 text-[1rem] text-fg-soft">
                Prefer we do it for you?{" "}
                <Link
                  href="/services"
                  className="inline-flex items-center gap-1 font-medium text-fg underline decoration-border-strong underline-offset-[6px] hover:decoration-fg"
                >
                  Done-for-you from {inr(SERVICE_FROM_PRICE)}/mo
                  <ArrowRight aria-hidden size={16} />
                </Link>
              </p>
            </div>
            <ul className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:col-span-7">
              {MARKETING_PLANS.map((p) => (
                <li key={p.id} className="bg-surface p-6">
                  <p className="text-small font-medium text-muted">{p.name}</p>
                  <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-fg">
                    {inr(p.price)}
                    {p.suffix}
                  </p>
                  <p className="mt-1 text-xs text-muted">per month</p>
                  <p className="mt-4 text-small text-fg-soft">{p.highlights[0]}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ FAQ */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 border-t border-border py-24 sm:py-32">
        <div className="container-marketing grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <h2 id="faq-title" className="mk-title max-w-[12ch] text-fg">
                Questions, answered plainly.
              </h2>
              <p className="mk-body mt-5 max-w-sm text-fg-soft">
                Something else on your mind?{" "}
                <Link href="/contact" className="font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                  Write to us
                </Link>
                .
              </p>
            </div>
          </div>
          <div className="border-t border-fg lg:col-span-7 lg:col-start-6">
            {FAQS.map((f) => (
              <details key={f.q} className="group border-b border-border">
                <summary className="flex list-none items-start justify-between gap-6 py-6 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-[1.125rem] font-medium leading-snug tracking-[-0.015em] text-fg sm:text-[1.25rem]">{f.q}</h3>
                  <span
                    aria-hidden
                    className="relative mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong text-fg transition-transform duration-200 group-open:rotate-45"
                  >
                    <span className="absolute h-px w-3 bg-current" />
                    <span className="absolute h-3 w-px bg-current" />
                  </span>
                </summary>
                <p className="mk-body max-w-2xl pb-7 text-fg-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Final CTA */}
      <section aria-labelledby="final-cta" className="bg-fg text-bg">
        <div className="container-marketing grid gap-12 py-24 sm:py-32 lg:grid-cols-12 lg:items-end lg:gap-10">
          <h2 id="final-cta" className="mk-statement max-w-[13ch] text-bg lg:col-span-7">
            Check your website free.
          </h2>
          <div className="lg:col-span-5">
            <p className="mk-lead max-w-md text-bg/75">
              The free check reads your homepage and key pages and shows your score and top fixes. It doesn&apos;t ask
              ChatGPT — the full check does that after you sign up.
            </p>
            <FreeCheckLauncher id="cta-url" onDark className="mt-8" />
          </div>
        </div>
      </section>
    </>
  );
}

function TourRow({
  index,
  title,
  body,
  ui,
  flip,
}: {
  index: string;
  title: string;
  body: string;
  ui: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-10">
      <div className={"mk-reveal min-w-0 lg:col-span-4 " + (flip ? "lg:order-2 lg:col-start-9" : "")}>
        <p className="text-small font-medium tabular-nums text-primary">{index}</p>
        <h3 className="mt-4 text-[clamp(1.75rem,1.35rem+1.4vw,2.625rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-fg">
          {title}
        </h3>
        <p className="mk-body mt-5 max-w-md text-fg-soft">{body}</p>
      </div>
      <div className={"mk-reveal min-w-0 lg:col-span-7 " + (flip ? "lg:order-1 lg:col-start-1" : "lg:col-start-6")}>{ui}</div>
    </div>
  );
}
