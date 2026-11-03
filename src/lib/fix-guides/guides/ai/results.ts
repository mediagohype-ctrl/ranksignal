// AI result guides (geo.ai_* and brand.ai_*): being named, linked, recommended and described correctly by AI
// assistants. What drives these is mostly outside the website (listings, reviews, other sites talking about you)
// plus clear pages that answer customer questions — so most steps are the same on every platform.
import type { Platform } from "@/lib/platform/detect";
import type { FixContext, FixGuide } from "../../types";
import { NEW_PAGE, ROBOT_RULES_WHERE, perPlatform } from "./shared";

const NO_PROMISE =
  "Run an AI check again in 4–6 weeks. AI answers vary from one check to the next and nobody can guarantee being named, so look at the trend over a few months, not one result.";
const LISTINGS =
  "Get listed where AI assistants look: your Google Business Profile, Bing Places, Apple Business Connect, and the main directories and review sites in your industry and country (e.g. Yelp, Trustpilot, Tripadvisor, Houzz, Justdial — whichever your customers use).";
const REVIEWS =
  "Ask happy customers for reviews on those sites. Recent, detailed reviews that mention the service and the town (\"<Brand> fixed our boiler in Leeds the same day\") help most.";
const SAME_INFO =
  "Keep your business name, address, phone, website and one-line description exactly the same on every listing — old or different details confuse AI assistants.";
const MENTIONS =
  "Get mentioned by other websites: local news, trade associations, suppliers and partners, \"best [service] in [town]\" lists, podcasts and community sites. AI assistants learn about you from what others say, not only from your site.";

const competitorOf = (ctx: FixContext) => ctx.issue.title.match(/^AI names (.+) more often than you$/)?.[1] ?? null;

// ---------------------------------------------------------------------------------------------------------------

export const aiMentionRateGuide: FixGuide = {
  effect: (ctx) =>
    `When people ask AI assistants for a business like yours, ${ctx.brand} is rarely named — so those customers may never hear of you.`,
  steps: perPlatform((p) => [
    "Open AI mentions and look at the customer questions where <Brand> wasn't named — and which businesses and websites were named instead.",
    "Make sure each of those questions is clearly answered on your site: one page per main service and per town or area you serve, with the question as a heading and a short, direct answer under it.",
    NEW_PAGE[p],
    LISTINGS,
    REVIEWS,
    SAME_INFO,
    MENTIONS,
    NO_PROMISE,
  ]),
  promptHints: {
    nextjs:
      "Plan and scaffold service and location pages (app/services/[slug], app/areas/[slug] with generateStaticParams) for the customer questions where the brand was missing. Each page: unique metadata, an <h1>, a 40–60 word direct answer near the top, facts, FAQs, LocalBusiness/Service JSON-LD, internal links. Placeholders for unknown facts.",
    react: "Plan and scaffold pre-rendered service and location routes for the questions where the brand was missing: unique titles, a short direct answer near the top, facts and FAQs. Placeholders for unknown facts.",
    custom: "Plan service and location pages for the questions where the brand was missing: unique titles, a short direct answer near the top, facts and FAQs, linked from the navigation.",
  },
  verify: [
    "Run an AI check again after 4–6 weeks and compare how often you were named with this report.",
    "Search your business name on Google and Bing — your website and your listings should show up first.",
  ],
  time: "A few hours to start, then 1–2 hours a month",
  category: "offsite",
};

// ---------------------------------------------------------------------------------------------------------------

export const aiCitationRateGuide: FixGuide = {
  effect: (ctx) =>
    `AI answers rarely link to ${ctx.brand}'s website, so even when you're relevant, people click through to other sites instead.`,
  steps: perPlatform((p) => [
    "First make sure AI robots can read your site. " + ROBOT_RULES_WHERE[p],
    "Open the websites AI answers linked to most often (listed in this report) and note what they have that you don't: price tables, comparisons, step-by-step guides, local details, dates.",
    "Write pages that answer one question each, very clearly: the question as the main heading, a 40–60 word answer first, then facts, numbers, a table or list, and a \"Last updated\" date.",
    NEW_PAGE[p],
    ...(p === "nextjs" || p === "react" || p === "custom"
      ? ["Make sure the text is in the page the server sends (not loaded later by JavaScript), and not hidden behind logins, pop-ups or PDFs."]
      : ["Keep the answers as real text on the page — not in PDFs, images or pop-ups."]),
    "Where the linked sites are directories, review sites or \"best of\" lists, ask to be listed there too.",
    NO_PROMISE,
  ]),
  promptHints: {
    nextjs:
      "Check crawlability first (app/robots.ts allows OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot; key content server-rendered). Then scaffold answer pages for the tracked questions: question as <h1>, 40–60 word answer first, facts, <table>/<ol>, visible 'Last updated' date, Article/FAQPage JSON-LD with dateModified.",
    react: "Ensure robots.txt allows AI search crawlers and routes are pre-rendered; scaffold answer pages with the question as <h1>, a short answer first, facts, lists/tables and a visible updated date.",
    custom: "Ensure robots.txt allows AI search crawlers and content is server-rendered; create answer pages with the question as <h1>, a short answer first, facts, lists/tables and a visible updated date.",
  },
  verify: [
    "Run an AI check again after 4–6 weeks and compare how often AI answers linked to your website.",
    "Check \"AI assistants can read your site\" shows as passed in your report.",
  ],
  time: "1–2 hours per answer page",
  category: "content",
};

// ---------------------------------------------------------------------------------------------------------------

export const competitorShareGuide: FixGuide = {
  effect: (ctx) => {
    const c = competitorOf(ctx);
    return c
      ? `When customers ask AI assistants for options, ${c} is named more often than ${ctx.brand}, so they're the one people consider first.`
      : `When customers ask AI assistants for options, ${ctx.brand} is rarely named compared with competitors.`;
  },
  steps: perPlatform((p) => [
    "Open AI mentions and read the answers where a competitor was named and <Brand> wasn't. Note what the AI says about them: services, places, prices, strengths.",
    "Compare their website with yours: which services, towns, comparisons or questions do they cover that you don't? Add those pages.",
    "Create honest comparison pages, e.g. \"<Brand> vs [competitor]\" and \"Alternatives to [competitor]\", saying clearly who each option is best for. Stick to facts you can prove.",
    NEW_PAGE[p],
    "Search Google for your service and town, and for the competitor's name: note the directories, review sites and articles they appear on, and get listed on the same ones.",
    REVIEWS,
    NO_PROMISE,
  ]),
  promptHints: {
    nextjs:
      "Scaffold comparison and alternatives pages (e.g. app/compare/[slug]/page.tsx) with a fair comparison <table>, 'best for' sections, FAQs, metadata and Article JSON-LD. Use placeholders for competitor facts — never invent claims about competitors.",
    custom: "Create comparison/alternatives pages with a fair comparison table, 'best for' sections and FAQs. Use placeholders for competitor facts; never invent claims.",
  },
  verify: [
    "Run an AI check again after 4–6 weeks and compare your share of business names with the top competitor's.",
  ],
  time: "Half a day to start, then 1–2 hours a month",
  category: "content",
};

// ---------------------------------------------------------------------------------------------------------------

const REVIEWS_ON_SITE: Record<Platform, string> = {
  nextjs: "Show real reviews on your site as text (name, date, rating, words), not only as an image or a widget that loads later — e.g. a server-rendered reviews section on your home and service pages.",
  react: "Show real reviews on your site as text (name, date, rating, words) in pre-rendered pages, not only as an image or a widget that loads later.",
  wordpress: "Show real reviews on your site as text: a Testimonials / Quote block on your home and service pages, or a reviews plugin that shows your Google reviews.",
  shopify: "Show real reviews on your store: a product reviews app (e.g. Judge.me or Shopify Product Reviews) on product pages, plus a few quotes on the home page.",
  wix: "Show real reviews on your site: + Add Elements → a Testimonials section, or the Wix Reviews / Google Reviews app.",
  webflow: "Show real reviews on your site as text: a Testimonials section (or a Reviews CMS collection) on your home and service pages.",
  framer: "Show real reviews on your site as text: a Testimonials section on your home and service pages.",
  squarespace: "Show real reviews on your site as text: add a Quote block or a testimonials section to your home and service pages.",
  custom: "Show real reviews on your site as text (name, date, rating, words) on your home and service pages.",
};

export const aiRecommendationGuide: FixGuide = {
  effect: (ctx) =>
    `AI assistants rarely recommend ${ctx.brand}. Being named is good; being recommended is what turns AI answers into customers.`,
  steps: perPlatform((p) => [
    "Spell out on your site who you're best for and why: \"<Brand> is best for [type of customer] who need [thing], because [proof].\"",
    "Back it up with proof AI can repeat: ratings and number of reviews, years in business, results, guarantees you really offer, awards and memberships.",
    REVIEWS_ON_SITE[p],
    "Answer \"best [service] for [need]\" and \"best [service] in [town]\" questions honestly on your own pages, including when you're not the right fit.",
    LISTINGS,
    REVIEWS,
    MENTIONS,
    NO_PROMISE,
  ]),
  promptHints: {
    nextjs:
      "Add a server-rendered 'Why choose us' / 'Best for' section and a reviews section (real reviews as text with author, date, rating) to the home and key service pages; add AggregateRating/Review JSON-LD only for reviews actually collected on the site. Placeholders for unknown facts.",
    react: "Add 'Best for' and reviews-as-text sections to the key pre-rendered pages. Placeholders for unknown facts; no fake reviews.",
    custom: "Add 'Best for' and reviews-as-text sections to the key pages. Placeholders for unknown facts; no fake reviews.",
  },
  verify: ["Run an AI check again after 4–6 weeks and compare how often AI assistants recommended you."],
  time: "2–3 hours to start, then ongoing",
  category: "offsite",
};

// ---------------------------------------------------------------------------------------------------------------

const ORG_WHERE: Record<Platform, string> = {
  nextjs: "the business info in `app/layout.tsx`",
  react: "the business info in `index.html`",
  wordpress: "Yoast SEO → Settings → Site representation (or Rank Math → Titles & Meta → Local SEO)",
  shopify: "your business info code in `layout/theme.liquid` and Settings → Store details",
  wix: "Settings → Business Info",
  webflow: "your business info code in Site settings → Custom code",
  framer: "your business info code in Site Settings → Custom Code",
  squarespace: "Settings → Business information",
  custom: "the business info in your shared template",
};

export const aiKnowledgeGuide: FixGuide = {
  effect: (ctx) =>
    `Some AI assistants don't know ${ctx.brand}, or say things about it that aren't true. People trust these answers, so wrong or missing details can send customers elsewhere.`,
  steps: perPlatform((p) => [
    "Read what each AI assistant said about <Brand> in this report and list every mistake (wrong address, old phone, services you don't offer, wrong owner…).",
    "Fix the source on your site: your About, Contact and service pages should state the correct facts plainly, in text — e.g. \"<Brand> is a [what] in [where], founded in [year]\".",
    `Update your business info for Google and AI with the same facts and links to your official profiles: ${ORG_WHERE[p]}.`,
    "Update the same facts everywhere else: Google Business Profile, Bing Places, Apple Business Connect, LinkedIn, Facebook and your directory listings. Old listings with an old address or phone are the most common cause of mistakes.",
    "Wikipedia and Wikidata: only if your business is genuinely notable and covered by independent press — don't write your own article.",
    "In ChatGPT, Gemini and others you can mark a wrong answer (thumbs down) and say what's correct. It may not change anything quickly, but it doesn't hurt.",
    "AI assistants that search the web (ChatGPT search, Perplexity, Gemini) pick up fixes within weeks; what they learned in training can take months to change.",
  ]),
  promptHints: {
    nextjs:
      "Make sure the About, Contact and footer content state the business facts plainly (name, what, where, founded, contact) in server-rendered text, and that the Organization/LocalBusiness JSON-LD in app/layout.tsx matches them exactly with sameAs links to official profiles. List any place in the codebase where old/inconsistent business details appear.",
    react: "Make the About/Contact/footer facts and the Organization JSON-LD in index.html match exactly; list any old or inconsistent business details in the codebase.",
    custom: "Make the About/Contact/footer facts and the Organization JSON-LD match exactly; list any old or inconsistent business details in the templates.",
  },
  verify: [
    "Search your business name on Google and Bing: check the details shown (address, phone, hours) are correct.",
    "Run an AI check again after 4–6 weeks and see whether the mistakes are gone.",
  ],
  time: "1–2 hours, then a check every few months",
  category: "offsite",
};
