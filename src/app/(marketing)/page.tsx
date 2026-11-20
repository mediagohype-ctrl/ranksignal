import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Check,
  Clock,
  Lock,
  MessageSquare,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { BRAND, bookCallHref } from "@/lib/brand";
import { SELF_FIX_LINE } from "@/lib/billing/offer";
import { JsonLd } from "@/components/marketing/ui";
import { FreeCheckLauncher } from "@/components/marketing/free-check-launcher";
import { SAMPLE_FIXES, SAMPLE_SCORE } from "@/components/marketing/home-sample";
import { DFY_ENGINE_COUNT, SELF_ENGINE_LIST } from "@/components/marketing/engine-names";
import { FAQS } from "@/components/marketing/content";
import { isFeatureLive } from "@/components/marketing/features/categories";
import {
  CUSTOM_CONTACT_HREF,
  CUSTOM_PLAN,
  DFY_PLAN,
  SELF_PLAN,
  TRIAL_DAYS,
  freq,
  gstOn,
  inr,
  planSignupHref,
  newTabProps,
} from "@/components/marketing/plans";
import { staticPageMetadata } from "@/lib/seo/metadata";
import { webPageLd } from "@/lib/seo/schema";
import { backlinksEnabled, dfsConfigured } from "@/lib/dataforseo/status";
import { EngineDot, FoundBadge, SampleNote, ScoreRing, type EngineKey } from "@/components/marketing/visuals/home-parts";

// Home page (redesign, 18 Nov 2026). Server-rendered HTML + inline SVG, every word crawlable. Nothing here
// reads cookies or headers, so the page is built once and served from cache (see the marketing layout).
// Order: hero (Check → Fix → Grow, the question, website box, sample report) → how search changed (3 cards) →
// where each AI puts you (dark band) → know exactly what to fix → Check. Fix. Grow. → whatever you sell →
// plans → questions → dark closing card with the website box again.
// Mobile first: every grid is one column on phones, the side gutter is 16px, nothing scrolls sideways.

// Title leads with the phrases buyers search ("SEO", "AEO", "GEO", "AI visibility") — the brand comes last.
// Title and description live in src/lib/seo/pages.ts (length- and uniqueness-tested).
export const metadata: Metadata = staticPageMetadata("/", {
  keywords: ["SEO checker", "website SEO report", "AEO", "GEO", "AI search visibility", "ChatGPT SEO", "SEO company India"],
});

const SITE = BRAND.appUrl.replace(/\/$/, "");

// Headings font for this page only (the rest of the site keeps Google Sans Flex). React hoists it into <head>.
const DISPLAY_FONT_HREF = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap";

/** "every week" / "every day" / "every month", from the plan's real limits. */
const EVERY: Record<string, string> = { Daily: "every day", Weekly: "every week", Monthly: "every month" };
const WEBSITE_CHECK_EVERY = EVERY[freq(SELF_PLAN.limits.minScanIntervalDays)] ?? "every month";
/** How often the plan's monthly AI answers let us ask the AI tools (4 or more full checks a month = every week). */
const AI_CHECK_EVERY = SELF_PLAN.ai.checksPerMonth >= 4 ? "every week" : "every month";

/** "/month + GST" — one GST mention per price, none when we are not GST-registered. */
const PER_MONTH = gstOn() ? "/month + GST" : "/month";

// Website Blueprint: two priced plans + Custom. The middle (done-for-you) card is dark and shows first on phones.
const HOME_PLANS = [
  {
    key: "self",
    name: "I'll do it myself",
    price: inr(SELF_PLAN.price),
    per: PER_MONTH,
    line: SELF_PLAN.blurb,
    cta: SELF_PLAN.cta,
    note: `${TRIAL_DAYS} days free · No card needed · Cancel any time`,
    href: planSignupHref(SELF_PLAN.id),
    dark: false,
    // The first three are what the homepage card shows (HOME_PLAN_POINTS): the most persuasive first.
    points: [
      `We ask ${SELF_ENGINE_LIST} about you ${AI_CHECK_EVERY}`,
      SELF_FIX_LINE,
      `A website check ${WEBSITE_CHECK_EVERY}, up to ${SELF_PLAN.limits.maxPagesPerCrawl.toLocaleString("en-IN")} pages`,
      "Your SEO, AEO, GEO and Brand scores",
      "A to-do list in plain words, most important first",
      "A monthly report you can read in 2 minutes",
    ],
  },
  {
    key: "dfy",
    name: DFY_PLAN.name,
    price: inr(DFY_PLAN.price),
    per: PER_MONTH,
    line: "Our team does all the work.",
    cta: "Book a free call",
    note: `Free 30-minute call${DFY_PLAN.setup === 0 ? " · No setup fee" : ""}`,
    // The calendar when BRAND_BOOKING_URL is set (opens in a new tab), otherwise the contact page.
    href: bookCallHref(),
    dark: true,
    points: [
      "Our team fixes your website, most important first",
      "Your own expert on WhatsApp, plus a monthly call",
      "Your Google Business Profile looked after",
      "New pages that answer what your customers ask",
      "Wrong facts about you in AI answers corrected",
      "Everything in I'll do it myself",
    ],
  },
  {
    key: "custom",
    name: CUSTOM_PLAN.name,
    price: CUSTOM_PLAN.priceLabel,
    per: "",
    line: CUSTOM_PLAN.blurb,
    cta: CUSTOM_PLAN.cta,
    note: CUSTOM_PLAN.start,
    href: CUSTOM_CONTACT_HREF,
    dark: false,
    points: [...CUSTOM_PLAN.includes],
  },
];

// Sample report: the same sample business, score and points as home-sample.tsx (and the Hindi page).
const SAMPLE_GAIN = SAMPLE_FIXES.reduce((n, f) => n + f.points, 0);
const SAMPLE_AFTER = SAMPLE_SCORE + SAMPLE_GAIN;
/** Short names for the three sample fixes (the hero card is small) and how long each takes. */
const FIX_SHORT = ["What you sell & where", "Google summaries", "Customer questions"];
const FIX_TIME = ["10 min", "15 min", "20 min"];
const SHOW_UP: { engine: EngineKey; found: boolean }[] = [
  { engine: "Google", found: true },
  { engine: "ChatGPT", found: false },
  { engine: "Gemini", found: false },
  { engine: "Perplexity", found: true },
];

// "See where each AI puts you": the three AI tools Do it myself checks, as a podium. Sample data, labelled.
const PODIUM: { engine: EngineKey; rank: number; label: string; tall: string; hot?: boolean }[] = [
  { engine: "ChatGPT", rank: 3, label: "Recommended", tall: "h-28 sm:h-[150px]" },
  { engine: "Gemini", rank: 2, label: "Recommended", tall: "h-36 sm:h-[200px]", hot: true },
  { engine: "Perplexity", rank: 4, label: "Named", tall: "h-24 sm:h-[110px]" },
];

const STEPS = [
  { title: "Check", icon: Search, body: "Enter your website.", hot: false },
  { title: "Fix", icon: Wrench, body: "You do it, or we do it.", hot: false },
  { title: "Grow", icon: TrendingUp, body: "More customers find you.", hot: true },
];

const KINDS = [
  { title: "Local business", ask: "best dentist near me", icon: Store, tile: "bg-mk-orange-soft text-sev-high" },
  { title: "Online store", ask: "best gift for mom online", icon: ShoppingCart, tile: "bg-mk-accent-soft text-mk-accent" },
  { title: "B2B / service company", ask: "top CA firm in Delhi", icon: Briefcase, tile: "bg-mk-good-soft text-mk-good" },
  { title: "Agency", ask: "best SEO agency in Delhi", icon: Users, tile: "bg-chart-4/10 text-chart-4" },
];

// Shared class strings.
const WRAP = "mx-auto w-full px-4 sm:px-8";
const H2 = "font-display text-[clamp(1.875rem,1.2rem+2.6vw,2.875rem)] font-bold leading-[1.1] tracking-[-0.015em] text-mk-ink text-balance";
const LEAD = "text-base text-mk-text-soft sm:text-lg";
/** Homepage plan cards show this many points; the full list is on /pricing. */
const HOME_PLAN_POINTS = 3;
const CARD_LABEL = "text-[13px] font-bold uppercase tracking-[0.04em] text-mk-text-soft";

export default function HomePage() {
  // Organization + WebSite come from the marketing layout (sitewide); this page adds the product itself.
  const jsonLd = [
    webPageLd("/", { base: SITE }),
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": `${SITE}/#software`,
      name: BRAND.name,
      url: `${SITE}/`,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "SEO software",
      operatingSystem: "Web",
      description: `Website SEO audit and report tool that scores SEO, answer-engine (AEO) and generative-AI (GEO) readiness and measures how often AI tools such as ${SELF_ENGINE_LIST} mention and cite a brand.`,
      // Only what every customer really gets, worded per offer: Do it myself has ready-to-paste fixes (no
      // publishing, so no "approval-gated fixes with rollback"); on Do it for me our team makes the changes.
      featureList: [
        "Website SEO audit and report",
        "AEO (answer engine optimization) score",
        "GEO (generative engine optimization) score",
        `AI visibility tracking in ${SELF_ENGINE_LIST} (up to ${DFY_ENGINE_COUNT} AI tools on ${DFY_PLAN.name})`,
        "Competitor share of voice in AI answers",
        "Ready-to-paste fixes with step-by-step help",
        "Done-for-you fixes by our team",
        "Core Web Vitals page speed checks",
        "Alerts when scores, pages or AI answers change",
        "Client report builder",
        "Portfolio view for many websites",
        "Public API and MCP server",
        `IndexNow submission to Bing and other search engines (${DFY_PLAN.name} and ${CUSTOM_PLAN.name})`,
        "AI crawler visit tracking",
        "Internal link suggestions",
        // Needs Google's Places data: listed only once it is switched on (same check as /features).
        ...(isFeatureLive("maps-data") ? ["Google Business Profile monitor"] : []),
        // Paid Google-data features: listed only once our data partner is switched on.
        ...(dfsConfigured() ? ["Google rank tracking", "Keyword research", "Competitor analysis"] : []),
        ...(backlinksEnabled() ? ["Backlink checker"] : []),
      ],
      offers: { "@type": "Offer", price: "0", priceCurrency: "INR", description: "Free website check, no sign-up" },
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

  return (
    <div className="overflow-x-clip text-mk-ink">
      {/* React 19 hoists a stylesheet link with `precedence` into <head>. */}
      <link rel="stylesheet" href={DISPLAY_FONT_HREF} precedence="default" />
      <JsonLd data={jsonLd} />

      {/* ------------------------------------------------------------ 1. Hero + sample report */}
      <section id="check" aria-labelledby="hero-title" className="scroll-mt-20 bg-gradient-to-b from-mk-hero-top to-white">
        <div className={WRAP + " flex max-w-[1000px] flex-col items-center gap-5 pb-12 pt-12 text-center sm:gap-6 sm:pb-14 sm:pt-20"}>
          {/* The one H1 carries the searched phrase; the question below is the big visual line. */}
          <h1
            id="hero-title"
            className="inline-flex items-center gap-2 rounded-full border border-[#DCE3F5] bg-white px-4 py-2 text-[13px] font-semibold text-mk-accent sm:text-sm"
          >
            <Sparkles aria-hidden size={16} strokeWidth={2.4} />
            Free SEO, AEO &amp; GEO website checker
          </h1>
          {/* Two clean lines: "Are they finding you?" never breaks (sized by screen width so it fits on any phone). */}
          <h2 className="font-display text-[clamp(1.5rem,7.6vw,4.5rem)] font-bold leading-[1.08] tracking-[-0.03em]">
            <span className="block">Customers are searching</span>
            {/* Hidden full stop + space: Google and screen readers read one sentence, not "searchingAre". */}
            <span className="sr-only">. </span>
            <span className="block whitespace-nowrap text-mk-accent">Are they finding you?</span>
          </h2>
          <p className="max-w-[36rem] text-[1.0625rem] leading-relaxed text-mk-text sm:text-xl">
            See how Google and ChatGPT see your business. In 30 seconds.
          </p>
          <FreeCheckLauncher id="hero-url" variant="hero" buttonLabel="Get my free report" hint={null} className="max-w-[620px] text-left" />

          {/* Phones: three compact tiles in a row (icon over text). Wider: icon beside text. */}
          <ul className="grid w-full max-w-[620px] grid-cols-3 gap-2 sm:gap-2.5">
            <li className="flex flex-col items-center justify-center gap-1.5 rounded-[14px] border border-border bg-white px-1.5 py-3 sm:flex-row sm:gap-2.5 sm:p-3">
              <span aria-hidden className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-mk-good-soft text-[15px] font-bold text-mk-good">
                ₹0
              </span>
              <span className="whitespace-nowrap text-[12.5px] font-semibold sm:text-[15px]">Free check</span>
            </li>
            <li className="flex flex-col items-center justify-center gap-1.5 rounded-[14px] border border-border bg-white px-1.5 py-3 sm:flex-row sm:gap-2.5 sm:p-3">
              <span aria-hidden className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-mk-accent-soft text-mk-accent">
                <Clock size={18} strokeWidth={2.4} />
              </span>
              <span className="whitespace-nowrap text-[12.5px] font-semibold sm:text-[15px]">Instant report</span>
            </li>
            <li className="flex flex-col items-center justify-center gap-1.5 rounded-[14px] border border-border bg-white px-1.5 py-3 sm:flex-row sm:gap-2.5 sm:p-3">
              <span aria-hidden className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-mk-orange-soft text-sev-high">
                <Lock size={18} strokeWidth={2.4} />
              </span>
              <span className="whitespace-nowrap text-[12.5px] font-semibold sm:text-[15px]">No sign-up</span>
            </li>
          </ul>

          <p className="inline-flex items-center gap-2.5 text-[15px] text-mk-text sm:text-base">
            <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-mk-accent-soft text-mk-accent">
              <Users size={16} strokeWidth={2.4} />
            </span>
            <span>
              <b className="text-mk-ink">{BRAND.proof.split(" ")[0]}</b> {BRAND.proof.split(" ").slice(1).join(" ")}
            </span>
          </p>
        </div>

        {/* Your free report (sample) */}
        <div className={WRAP + " max-w-[1040px] pb-16 sm:pb-24"}>
          <figure
            aria-label="Sample free report"
            className="overflow-hidden rounded-3xl border border-[#E6EAF2] bg-white shadow-[0_30px_70px_rgba(11,27,63,0.12)]"
          >
            <div className="flex items-center gap-4 border-b border-mk-line bg-[#F6F8FB] px-4 py-3.5 sm:px-5">
              <div aria-hidden className="hidden gap-1.5 sm:flex">
                <span className="size-[11px] rounded-full bg-[#F0B3A8]" />
                <span className="size-[11px] rounded-full bg-[#F4D58D]" />
                <span className="size-[11px] rounded-full bg-[#A8DDB5]" />
              </div>
              <div className="flex min-w-0 flex-1 justify-center">
                <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-[#E6EAF2] bg-white px-4 py-1.5 text-[13px] text-mk-text-soft">
                  <Lock aria-hidden size={12} strokeWidth={2.4} className="shrink-0" />
                  <span className="truncate">Your free report · yourwebsite.com</span>
                </span>
              </div>
              <span aria-hidden className="hidden w-[45px] sm:block" />
            </div>

            <div className="grid grid-cols-1 gap-3 bg-[#FAFBFD] p-3 sm:gap-4 sm:p-5 md:grid-cols-3">
              {/* 1 · score */}
              <div className="flex flex-col items-center gap-3.5 rounded-[18px] border border-[#EEF1F6] bg-white p-5 text-center sm:p-6">
                <span className={CARD_LABEL + " self-start"}>Your score</span>
                <ScoreRing score={SAMPLE_SCORE} caption="out of 100" label={`Score ${SAMPLE_SCORE} out of 100`} className="w-[120px] sm:w-[136px]" />
                <span className="rounded-full bg-mk-orange-soft px-3.5 py-1.5 text-sm font-semibold text-mk-orange-fg">Customers miss you</span>
              </div>

              {/* 2 · where you show up */}
              <div className="flex flex-col gap-3.5 rounded-[18px] border border-[#EEF1F6] bg-white p-5 sm:p-6">
                <span className={CARD_LABEL}>Where you show up</span>
                <ul className="flex flex-1 flex-col justify-center">
                  {SHOW_UP.map((s, i) => (
                    <li
                      key={s.engine}
                      className={"flex items-center justify-between py-2.5 " + (i < SHOW_UP.length - 1 ? "border-b border-mk-line" : "")}
                    >
                      <span className="flex items-center gap-2.5 text-[15px] font-semibold">
                        <EngineDot engine={s.engine} />
                        {s.engine}
                      </span>
                      <FoundBadge found={s.found} />
                    </li>
                  ))}
                </ul>
              </div>

              {/* 3 · fix these first */}
              <div className="flex flex-col gap-3.5 rounded-[18px] border border-[#EEF1F6] bg-white p-5 sm:p-6">
                <span className={CARD_LABEL}>Fix these first</span>
                <ol className="flex flex-1 flex-col gap-2.5">
                  {SAMPLE_FIXES.map((f, i) => (
                    <li key={f.title} className="flex items-center gap-3 rounded-xl bg-mk-tint px-3.5 py-3">
                      <span aria-hidden className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-mk-accent text-[13px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold">{FIX_SHORT[i]}</span>
                      <span className="text-[13px] font-bold text-mk-good">+{f.points}</span>
                    </li>
                  ))}
                </ol>
                <div className="flex items-center justify-between border-t border-mk-line pt-3">
                  <span className="text-sm text-mk-text-soft">Score after fixes</span>
                  <span className="font-display text-xl font-bold text-mk-good">{SAMPLE_AFTER}</span>
                </div>
              </div>
            </div>
          </figure>
          <div className="mt-4">
            <SampleNote>Sample report. Yours shows your real score and fixes.</SampleNote>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ 2. How search changed */}
      <section id="where-found" aria-labelledby="where-title" className="scroll-mt-20 bg-white">
        <div className={WRAP + " flex max-w-[1200px] flex-col gap-10 py-16 sm:gap-[52px] sm:py-[104px]"}>
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 id="where-title" className={H2}>
              Your customers changed how they search.
            </h2>
            <p className={LEAD}>Before they buy, they check 3 places.</p>
          </div>

          <ul className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
            {/* They search — Google page 1 (SEO) */}
            <li className="flex flex-col gap-5 rounded-3xl bg-mk-tint p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-[22px] font-bold">They search</h3>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold">
                  <EngineDot engine="Google" className="size-2" />
                  Google
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 rounded-2xl bg-white p-[18px] shadow-[0_6px_18px_rgba(11,27,63,0.06)]">
                <div className="flex items-center gap-2.5 rounded-full border-[1.5px] border-border px-3.5 py-2.5 text-[15px]">
                  <Search aria-hidden size={16} strokeWidth={2.4} className="shrink-0 text-mk-text-soft" />
                  cake shop near me
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border-2 border-dashed border-mk-accent bg-mk-accent-tint p-3">
                  <span className="font-bold text-mk-accent">#1</span>
                  <span className="font-semibold">Your shop?</span>
                </div>
                <div aria-hidden className="flex flex-col gap-2">
                  <div className="h-2.5 w-4/5 rounded-md bg-[#EEF1F7]" />
                  <div className="h-2.5 w-3/5 rounded-md bg-[#EEF1F7]" />
                  <div className="h-2.5 w-[70%] rounded-md bg-[#EEF1F7]" />
                </div>
              </div>
              <p className="text-sm text-mk-text-soft">
                <b className="text-mk-ink">SEO</b> · Is your business on Google page 1?
              </p>
            </li>

            {/* They ask — Google's answer box (AEO) */}
            <li className="flex flex-col gap-5 rounded-3xl bg-mk-tint p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-[22px] font-bold">They ask</h3>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold">
                  <EngineDot engine="Google" className="size-2" />
                  Google
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 rounded-2xl bg-white p-[18px] shadow-[0_6px_18px_rgba(11,27,63,0.06)]">
                <div className="flex items-center gap-2.5 rounded-full border-[1.5px] border-border px-3.5 py-2.5 text-[15px]">
                  <Search aria-hidden size={16} strokeWidth={2.4} className="shrink-0 text-mk-text-soft" />
                  open on Sunday?
                </div>
                <div className="flex flex-col gap-1.5 rounded-xl bg-mk-accent-tint p-3.5">
                  <span className="text-base font-semibold">Yes, 9 am to 9 pm.</span>
                  <span className="text-[13px] text-mk-text-soft">
                    Answer from: <b className="text-mk-accent">your website?</b>
                  </span>
                </div>
              </div>
              <p className="text-sm text-mk-text-soft">
                <b className="text-mk-ink">AEO</b> · Does Google’s answer box quote you?
              </p>
            </li>

            {/* AI picks — ChatGPT names 2–3 (GEO) */}
            <li className="flex flex-col gap-5 rounded-3xl bg-mk-tint p-5 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-[22px] font-bold">AI picks</h3>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold">
                  <EngineDot engine="ChatGPT" className="size-2" />
                  ChatGPT
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-3 rounded-2xl bg-white p-[18px] shadow-[0_6px_18px_rgba(11,27,63,0.06)]">
                <div className="self-end rounded-[16px_16px_4px_16px] bg-mk-ink px-3.5 py-2.5 text-[15px] text-white">Which cake shop is best?</div>
                <div className="flex flex-wrap gap-2 self-start rounded-[16px_16px_16px_4px] bg-[#F1F3F8] px-3.5 py-3">
                  <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold">Shop A</span>
                  <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold">Shop B</span>
                  <span className="rounded-full border-2 border-dashed border-mk-accent px-3 py-1 text-sm font-bold text-mk-accent">You?</span>
                </div>
              </div>
              <p className="text-sm text-mk-text-soft">
                <b className="text-mk-ink">GEO</b> · Does AI name you among the few?
              </p>
            </li>
          </ul>

          <p className="text-center font-display text-xl font-semibold sm:text-2xl">
            Not there? <span className="text-sev-high">They buy from someone else.</span>
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ 3. Where each AI puts you (dark band) */}
      <section id="ai-positions" aria-labelledby="ai-positions-title" className="scroll-mt-20 bg-mk-ink text-white">
        <div className={WRAP + " flex max-w-[1100px] flex-col items-center gap-9 py-16 sm:gap-11 sm:py-[104px]"}>
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 id="ai-positions-title" className={H2 + " !text-white"}>
              See where each AI puts you.
            </h2>
            <p className="text-base text-mk-on-ink sm:text-lg">We ask AI what your customers ask.</p>
          </div>

          <p className="flex max-w-full items-center gap-3 rounded-full bg-white px-5 py-3 text-base font-semibold text-mk-ink shadow-[0_12px_30px_rgba(0,0,0,0.25)] sm:px-6 sm:py-3.5 sm:text-lg">
            <MessageSquare aria-hidden size={20} strokeWidth={2.4} className="shrink-0 text-mk-accent" />
            “Best cake shop in Indiranagar?”
          </p>

          {/* Always three columns (also on phones), shorter bars on small screens. */}
          <ol className="grid w-full max-w-[820px] grid-cols-3 items-end gap-2.5 sm:gap-5">
            {PODIUM.map((p) => (
              <li key={p.engine} className="flex flex-col items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold sm:gap-2 sm:text-base">
                  <EngineDot engine={p.engine} />
                  {p.engine}
                </span>
                <div
                  className={
                    "flex w-full flex-col items-center justify-center gap-1 rounded-t-2xl " + p.tall + " " + (p.hot ? "bg-mk-accent" : "bg-mk-ink-2")
                  }
                >
                  <span className={"font-display font-bold " + (p.hot ? "text-[40px] sm:text-[52px]" : "text-[32px] sm:text-[44px]")}>
                    #{p.rank}
                  </span>
                  <span className={"text-xs sm:text-sm " + (p.hot ? "text-[#E6ECFF]" : "text-mk-on-ink")}>{p.label}</span>
                </div>
              </li>
            ))}
          </ol>

          <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-2xl bg-mk-ink-2 px-6 py-4 text-center text-base sm:text-lg">
            <span>Your competitor is on this list.</span>
            <span className="font-bold text-[#FDBA74]">Are you?</span>
          </p>

          <a
            href="#check"
            className="inline-flex h-14 items-center gap-2 rounded-[14px] bg-white px-7 text-[17px] font-bold text-mk-ink hover:bg-mk-tint"
          >
            Find my rank free
            <ArrowRight aria-hidden size={18} />
          </a>
          <SampleNote onInk>
            Sample answers for a sample bakery. We check {SELF_ENGINE_LIST} on {SELF_PLAN.name}, and up to {DFY_ENGINE_COUNT} AI tools on {DFY_PLAN.name}.
          </SampleNote>
        </div>
      </section>

      {/* ------------------------------------------------------------ 4. Know exactly what to fix */}
      <section id="sample" aria-labelledby="sample-title" className="scroll-mt-20 bg-white">
        <div className={WRAP + " flex max-w-[1100px] flex-col gap-10 py-16 sm:gap-[52px] sm:py-[104px]"}>
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 id="sample-title" className={H2}>
              Know exactly what to fix.
            </h2>
            <p className={LEAD}>Biggest wins first. Done in minutes.</p>
          </div>

          <div className="flex flex-col gap-4 rounded-[28px] bg-mk-tint p-3 sm:gap-7 sm:p-8 lg:flex-row lg:items-stretch">
            {/* score side */}
            <div className="flex flex-col items-center justify-center gap-[18px] rounded-[20px] bg-white p-5 sm:p-7 lg:flex-1">
              <div className="flex items-center gap-2 sm:gap-3.5">
                <div className="flex flex-col items-center gap-1.5">
                  <ScoreRing score={SAMPLE_SCORE} label={`Score ${SAMPLE_SCORE} now`} className="w-[88px] sm:w-[104px]" />
                  <span className="text-sm font-semibold text-mk-text-soft">Now</span>
                </div>
                <svg width="40" height="20" viewBox="0 0 40 20" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="w-8 shrink-0 stroke-mk-good-ring sm:w-10">
                  <path d="M2 10h34M28 3l8 7-8 7" />
                </svg>
                <div className="flex flex-col items-center gap-1.5">
                  <ScoreRing score={SAMPLE_AFTER} tone="good" label={`Score ${SAMPLE_AFTER} after fixes`} className="w-[88px] sm:w-[104px]" />
                  <span className="text-sm font-bold text-mk-good">After 3 fixes</span>
                </div>
              </div>
              <span className="rounded-full bg-mk-good-soft px-4 py-2 font-display text-lg font-bold text-mk-good">+{SAMPLE_GAIN} points</span>
            </div>

            {/* fixes side */}
            <div className="flex flex-col gap-3 lg:flex-[1.3]">
              <ol className="flex flex-col gap-3">
                {SAMPLE_FIXES.map((f, i) => (
                  <li key={f.title} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4 sm:gap-4 sm:px-5 sm:py-[18px]">
                    <span
                      aria-hidden
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-mk-accent font-display text-lg font-bold text-white sm:size-10"
                    >
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[15px] font-semibold leading-snug sm:text-[17px]">{f.title}</span>
                      <span className="text-sm text-mk-text-soft">{FIX_TIME[i]}</span>
                    </div>
                    <span className="shrink-0 rounded-full bg-mk-good-soft px-3 py-1.5 text-[15px] font-bold text-mk-good">+{f.points}</span>
                  </li>
                ))}
              </ol>
              <p className="flex items-center gap-3 px-1 py-1.5 text-[15px] text-mk-text">
                <Users aria-hidden size={20} className="shrink-0 text-mk-accent" />
                <span>
                  No time? <b className="text-mk-ink">Our team does it for you.</b>
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ 5. Check. Fix. Grow. */}
      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-20 bg-mk-tint">
        <div className={WRAP + " flex max-w-[1100px] flex-col gap-10 py-16 sm:gap-[52px] sm:py-24"}>
          <h2 id="how-title" className={H2 + " text-center"}>
            {BRAND.slogan}
          </h2>
          {/* One connected row on every screen (phones too): icon, step number, one short line each. */}
          <ol className="relative grid grid-cols-3 gap-2 sm:gap-8">
            <span aria-hidden className="absolute left-[16.6%] right-[16.6%] top-7 h-0.5 bg-gradient-to-r from-mk-accent/15 via-mk-accent/40 to-mk-accent sm:top-11" />
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.title} className="relative flex flex-col items-center gap-2 text-center sm:gap-3.5">
                  <span
                    aria-hidden
                    className={
                      "relative inline-flex size-14 items-center justify-center rounded-[20px] sm:size-[88px] sm:rounded-[28px] " +
                      (s.hot ? "bg-mk-accent text-white shadow-[0_10px_24px_rgba(36,87,245,0.25)]" : "bg-white text-mk-accent shadow-[0_10px_24px_rgba(11,27,63,0.08)]")
                    }
                  >
                    <Icon className="size-6 sm:size-9" strokeWidth={2} />
                    <span className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-mk-ink text-[11px] font-bold text-white sm:size-6 sm:text-xs">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="font-display text-lg font-bold sm:text-2xl">
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="text-[13px] leading-snug text-mk-text-soft sm:text-base">{s.body}</p>
                </li>
              );
            })}
          </ol>
          <p className="text-center">
            <Link href="/how-it-works" className="inline-flex items-center gap-1.5 font-semibold text-mk-accent underline-offset-4 hover:underline">
              How it works
              <ArrowRight aria-hidden size={17} />
            </Link>
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ 6. Whatever you sell */}
      <section id="who-its-for" aria-labelledby="kinds-title" className="scroll-mt-20 bg-white">
        <div className={WRAP + " flex max-w-[1200px] flex-col gap-10 py-16 sm:gap-[52px] sm:py-[104px]"}>
          <h2 id="kinds-title" className={H2 + " text-center"}>
            Whatever you sell, people ask first.
          </h2>
          {/* Phones: a tidy 2 x 2 grid. Laptops: four across. */}
          <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {KINDS.map((k) => {
              const Icon = k.icon;
              return (
                <li key={k.title} className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-[#E8EBF2] p-4 sm:gap-[18px] sm:rounded-[22px] sm:p-7">
                  <span aria-hidden className={"inline-flex size-10 items-center justify-center rounded-xl sm:size-[52px] sm:rounded-2xl " + k.tile}>
                    <Icon className="size-5 sm:size-[26px]" strokeWidth={2} />
                  </span>
                  <h3 className="font-display text-[16px] font-bold leading-tight sm:text-[21px]">{k.title}</h3>
                  <span className="mt-auto inline-flex items-start gap-1.5 rounded-xl bg-mk-tint px-2.5 py-2 text-[13px] leading-snug text-mk-text sm:px-3.5 sm:py-3 sm:text-[15px]">
                    <Search aria-hidden size={13} strokeWidth={2.4} className="mt-[3px] shrink-0 text-mk-text-soft" />
                    {k.ask}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ 7. Plans */}
      <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 bg-mk-tint">
        <div className={WRAP + " flex max-w-[1200px] flex-col gap-10 py-16 sm:gap-[52px] sm:py-[104px]"}>
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 id="pricing-title" className={H2}>
              Do it yourself. Or let us do it.
            </h2>
            <p className={LEAD}>
              Start free. Upgrade when you’re ready. {gstOn() ? "Prices in ₹, GST extra." : "Prices in ₹."}
            </p>
          </div>
          {/* Phones and tablets: one column, the done-for-you card first. Laptops: three across. */}
          <ul className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-3">
            {HOME_PLANS.map((p) => (
              <li
                key={p.key}
                className={
                  "relative flex flex-col gap-5 rounded-3xl p-6 sm:gap-[22px] sm:p-9 " +
                  (p.dark ? "order-first bg-mk-ink text-white lg:order-none" : "bg-white")
                }
              >
                {p.dark && (
                  <span className="absolute right-5 top-6 rounded-full bg-mk-accent px-3 py-1.5 text-[13px] font-semibold text-white sm:right-7 sm:top-[30px]">
                    Most chosen
                  </span>
                )}
                <div className={"flex flex-col gap-1.5 " + (p.dark ? "pr-28" : "")}>
                  <h3 className="font-display text-[23px] font-bold">{p.name}</h3>
                  <p className={"text-[15px] " + (p.dark ? "text-mk-on-ink" : "text-mk-text-soft")}>{p.line}</p>
                </div>
                <p className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-display text-[clamp(2.25rem,1.9rem+1vw,2.75rem)] font-bold tabular-nums">{p.price}</span>
                  {p.per && <span className={"text-[15px] " + (p.dark ? "text-mk-on-ink" : "text-mk-text-soft")}>{p.per}</span>}
                </p>
                <ul className="flex flex-col gap-3 text-[15px]">
                  {p.points.slice(0, HOME_PLAN_POINTS).map((pt) => (
                    <li key={pt} className="flex gap-2.5">
                      <Check aria-hidden size={20} strokeWidth={2.5} className={"shrink-0 " + (p.dark ? "text-[#6EE7B7]" : "text-mk-good-ring")} />
                      {pt}
                    </li>
                  ))}
                  {p.points.length > HOME_PLAN_POINTS && (
                    <li>
                      <Link
                        href="/pricing"
                        className={"inline-flex items-center gap-1 pl-[30px] text-sm font-semibold underline-offset-4 hover:underline " + (p.dark ? "text-[#9DB6FF]" : "text-mk-accent")}
                      >
                        + {p.points.length - HOME_PLAN_POINTS} more
                        <ArrowRight aria-hidden size={14} />
                      </Link>
                    </li>
                  )}
                </ul>
                <div className="mt-auto flex flex-col gap-2">
                  <Link
                    href={p.href}
                    {...newTabProps(p.href)}
                    className={
                      "flex h-[54px] items-center justify-center rounded-xl px-4 text-center text-base font-bold " +
                      (p.dark
                        ? "bg-mk-accent text-white hover:brightness-110"
                        : p.key === "self"
                          ? "border-[1.5px] border-mk-accent text-mk-accent hover:bg-mk-accent-tint"
                          : "border-[1.5px] border-mk-ink text-mk-ink hover:bg-mk-tint")
                    }
                  >
                    {p.cta}
                  </Link>
                  <span className={"text-center text-[13px] " + (p.dark ? "text-mk-on-ink" : "text-mk-text-soft")}>{p.note}</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-center text-sm">
            <Link href="/pricing" className="font-semibold text-mk-accent underline-offset-4 hover:underline">
              See what each plan includes
            </Link>
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ 8. Questions */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 bg-white">
        <div className={WRAP + " flex max-w-[820px] flex-col gap-8 py-16 sm:gap-9 sm:py-[104px]"}>
          <h2 id="faq-title" className={H2 + " text-center"}>
            Questions?
          </h2>
          <div className="flex flex-col gap-3">
            {FAQS.map((f) => (
              <details key={f.q} className="group rounded-2xl bg-mk-tint px-5 py-5 sm:px-[26px] sm:py-[22px]">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-base font-semibold leading-snug sm:text-lg">{f.q}</h3>
                  <span
                    aria-hidden
                    className="relative mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-mk-ink transition-transform duration-200 group-open:rotate-45"
                  >
                    <span className="absolute h-0.5 w-3 rounded bg-current" />
                    <span className="absolute h-3 w-0.5 rounded bg-current" />
                  </span>
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-mk-text sm:text-base">{f.a}</p>
              </details>
            ))}
          </div>
          <p className="text-center text-[15px] text-mk-text-soft">
            Something else?{" "}
            <Link href="/contact" className="font-semibold text-mk-accent underline-offset-4 hover:underline">
              Write to us
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------ 9. Closing card: the website box again */}
      <section aria-labelledby="final-title" className="bg-white">
        <div className={WRAP + " max-w-[1200px] pb-16 sm:pb-24"}>
          <div className="flex flex-col items-center gap-7 rounded-[28px] bg-mk-ink px-4 py-14 text-center text-white sm:rounded-[32px] sm:px-10 sm:py-20">
            <h2
              id="final-title"
              className="font-display text-[clamp(2rem,1.2rem+3vw,3.375rem)] font-bold leading-[1.08] tracking-[-0.02em] text-balance"
            >
              Every day you wait, <span className="text-[#8EA8FF]">customers find someone else.</span>
            </h2>
            <FreeCheckLauncher id="final-url" variant="hero" buttonLabel="Get my free report" hint={null} className="max-w-[600px] text-left" />
            <span className="text-[15px] text-mk-on-ink">Free · 30 seconds · No sign-up</span>
          </div>
        </div>
      </section>
    </div>
  );
}
