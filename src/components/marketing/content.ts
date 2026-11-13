import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BellRing,
  Bot,
  Braces,
  Briefcase,
  ChartColumn,
  Gauge,
  Globe,
  Languages,
  Lightbulb,
  Link2,
  ListChecks,
  MapPin,
  MessageSquareText,
  Network,
  Plug,
  Quote,
  ScanSearch,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Telescope,
  TrendingUp,
  Users,
} from "lucide-react";
import { BRAND } from "@/lib/brand";

/** The groups the /features page is organised by (labels live in src/components/marketing/features/categories.ts). */
export type FeatureCategory = "website" | "ai" | "fix" | "google" | "updates" | "agencies";

/**
 * What a feature needs from an outside data supplier before it can run. The page turns this into a live/"Switching on
 * soon" label at request time (env only — see @/lib/dataforseo/status). Leave it out for features that always work.
 *  - google-data: our paid Google data partner (rankings, keyword data, AI Overviews).
 *  - backlink-data: the same partner's separate backlink data.
 *  - maps-data: Google's Places data for Business Profile snapshots.
 */
export type FeatureAvailability = "google-data" | "backlink-data" | "maps-data";

export type Feature = {
  slug: string;
  title: string;
  summary: string;
  details: string[];
  icon: LucideIcon;
  category: FeatureCategory;
  availability?: FeatureAvailability;
};

export const FEATURES: Feature[] = [
  // ---------------------------------------------------------------- Check your website
  {
    slug: "audit",
    category: "website",
    icon: ScanSearch,
    title: "Website check",
    summary: "We read your website and find the problems that stop Google and AI from understanding it.",
    details: [
      "Checks that your pages can appear on Google, that Google and AI robots are allowed in, and that links and redirects work.",
      "Checks your main headings, your info for Google and AI, and whether your pages answer questions clearly.",
      "We follow your site's robot rules file and read gently — we never overload your website.",
    ],
  },
  {
    slug: "deeper-check",
    category: "website",
    icon: ListChecks,
    title: "Deeper website check",
    summary: "Finds the quieter problems most quick checks miss — and explains each one in plain words.",
    details: [
      "Language tags (hreflang): checks that your English, Hindi or other language pages point to each other correctly.",
      "Insecure files: finds images, scripts and forms still loaded over plain http on a secure (https) page.",
      "Heavy images: lists the big image files that slow your pages down, starting with the heaviest.",
      "Deep pages: finds pages that take too many clicks to reach from your home page, so Google and AI rarely visit them.",
      "Vague link text: flags links that only say “click here” or “read more”, which tell Google and AI nothing about the page they open.",
    ],
  },
  {
    slug: "page-speed",
    category: "website",
    icon: Gauge,
    title: "Real page speed",
    summary: "See how fast your pages load for real visitors, using Google's own Core Web Vitals.",
    details: [
      "Three numbers Google uses: how fast the main content shows (LCP), how quickly the page reacts to a tap (INP), and how much the layout jumps (CLS).",
      "Each one is marked good, needs work or poor using Google's published limits.",
      "Where Google has data from real Chrome visitors we show it; otherwise we show a lab test and say so.",
    ],
  },
  {
    slug: "internal-links",
    category: "website",
    icon: Network,
    title: "Internal link suggestions",
    summary: "Find important pages that few of your own pages link to, and the exact words to link from.",
    details: [
      "We count how many of your pages link to each page, and spot the ones that are nearly cut off.",
      "For each one we suggest a page that already mentions the topic, and the exact phrase to turn into a link.",
      "Suggestions only — nothing on your website changes unless you make the change.",
    ],
  },
  {
    slug: "recommendations",
    category: "website",
    icon: Lightbulb,
    title: "A clear to-do list",
    summary: "Every fix shows the problem or AI answer that led to it, so you know why it's there.",
    details: [
      "Fixes are sorted by how much they help and how long they take, with the reason shown next to each one.",
      "We keep what we measured separate from what we expect. We never claim a fix caused a change we can't prove.",
      "We draft new text for you to review. Nothing goes live outside the rules you set.",
    ],
  },

  // ---------------------------------------------------------------- Get found by AI
  {
    slug: "prompt-research",
    category: "ai",
    icon: Search,
    title: "Customer questions",
    summary: "Find the questions your customers ask AI assistants when they look for what you sell.",
    details: [
      "We start from your products, services and competitors and turn them into the questions real people ask.",
      "Questions are grouped by what the customer wants: to learn, to compare or to buy.",
      "Edit, reorder or pause questions any time. Your history is kept, so trends stay fair to compare.",
    ],
  },
  {
    slug: "visibility-tracking",
    category: "ai",
    icon: MessageSquareText,
    title: "AI mentions",
    summary: "See how often ChatGPT, Gemini and others name your business, and how many answers each number comes from.",
    details: [
      "We ask your customer questions to each AI assistant on a schedule and save every answer.",
      "You see how often you're named, linked to and recommended, and whether the answer sounds positive.",
      "AI answers change from one try to the next, so we ask again on every check and always show how many answers each number is based on.",
    ],
  },
  {
    slug: "ai-overviews",
    category: "ai",
    icon: Sparkles,
    availability: "google-data",
    title: "Google AI Overviews and AI Mode",
    summary: "See whether Google's AI summary at the top of the results — and Google's AI Mode — names and links your business.",
    details: [
      "We run your customer questions as real Google searches and save the AI Overview when Google shows one.",
      "You see whether you're named, which websites Google's AI links to, and how that changes over time.",
      "Google shows an AI Overview only for some searches. When it shows none, we record that too, instead of guessing.",
    ],
  },
  {
    slug: "citation-tracking",
    category: "ai",
    icon: Quote,
    title: "Links to your site",
    summary: "See which websites AI answers link to — yours, your competitors' or other sites — and how often.",
    details: [
      "We note the links in each AI answer and show which ones point to your website.",
      "We list the other websites AI links to most in your line of business, and suggest the ones worth being listed on.",
      "See how often AI links to your site compared with everyone else.",
    ],
  },
  {
    slug: "competitor-share",
    category: "ai",
    icon: Users,
    title: "You vs competitors in AI answers",
    summary: "See how often you're named compared with the competitors you choose, question by question.",
    details: [
      "Add the competitors you care about and see how often each one is named next to you.",
      "See how often you're named vs competitors overall, and for each AI assistant.",
      "Competitor numbers come only from public AI answers and public web pages.",
    ],
  },
  {
    slug: "ai-crawlers",
    category: "ai",
    icon: Bot,
    title: "AI crawler visits",
    summary: "See which AI robots — like ChatGPT's, Claude's and Perplexity's — actually visit your website, and which pages they read.",
    details: [
      "Upload your server's visit log, or connect a small copy-paste script for sites behind Cloudflare.",
      "We count visits from known AI and search robots, check that Google's and Bing's robots are genuine, and show the pages each one reads most.",
      "We keep only the daily counts — the raw log lines are never stored.",
    ],
  },

  // ---------------------------------------------------------------- Fix safely
  {
    slug: "publishing",
    category: "fix",
    icon: ShieldCheck,
    title: "Fixes to approve, with undo",
    summary: "See the exact change before it goes live, approve it, and undo it in one click if you change your mind.",
    details: [
      "Changes that can't touch your website are safe and run on their own. Anything that changes your site needs your OK, unless you allow a small, safe type of change.",
      "Your OK is tied to the exact draft. If the draft changes, we ask you again.",
      "We save the old version before every change, so it can be undone.",
    ],
  },
  {
    slug: "connectors",
    category: "fix",
    icon: Plug,
    title: "Connect your website",
    summary: "Works with WordPress, GitHub, Shopify, Webflow, Contentful, Sanity and Wix — or copy the fixes by hand for any other site.",
    details: [
      "WordPress: a limited app password, used only for the changes you approve.",
      "GitHub: changes arrive as pull requests, so your developer still reviews them.",
      "Shopify, Webflow, Contentful, Sanity and Wix: we write drafts and Google headlines and summaries where each platform allows it.",
      "Prefer to do it yourself? Copy each fix as simple step-by-step instructions.",
    ],
  },
  {
    slug: "indexnow",
    category: "fix",
    icon: Send,
    title: "IndexNow",
    summary: "Tell Bing and other IndexNow search engines the moment a page on your website is added or changed.",
    details: [
      "Turn it on once: we give you a small key file to put on your website and check that it's there.",
      "After each website check, new and changed pages are sent automatically; you can also send pages by hand.",
      "Google doesn't use IndexNow — for Google, your sitemap and Search Console still do that job.",
    ],
  },

  // ---------------------------------------------------------------- Track Google
  {
    slug: "rank-tracker",
    category: "google",
    icon: TrendingUp,
    availability: "google-data",
    title: "Rank tracker",
    summary: "Track where your website appears on Google for the searches that matter to you, week after week.",
    details: [
      "Add the searches you care about, the city or country to check from, and phone or computer.",
      "See your position for each one, how it moved since the last check, and a history chart.",
      "Positions come from real Google results collected by our data partner — not from guesses.",
    ],
  },
  {
    slug: "keyword-research",
    category: "google",
    icon: Telescope,
    availability: "google-data",
    title: "Keyword research and Google's top 10",
    summary: "Find what people search for, how often, and which pages Google shows on the first page today.",
    details: [
      "Start from a word or phrase and get related searches with monthly search numbers and how hard each one is.",
      "Open any search to see Google's current top 10 results, plus extras such as answer boxes and AI Overviews.",
      "Add the best searches to your rank tracker in one click.",
    ],
  },
  {
    slug: "competitor-research",
    category: "google",
    icon: ChartColumn,
    availability: "google-data",
    title: "Competitors on Google",
    summary: "Estimate your competitors' Google traffic, find the searches they get and you don't, and compare side by side.",
    details: [
      "Traffic estimates: a rough monthly number of Google visits for each competitor, clearly labelled as an estimate.",
      "Keyword gap: the searches where a competitor shows on Google and you don't.",
      "Compare: up to five websites — yours and your competitors' — side by side, with estimated visits and top searches.",
    ],
  },
  {
    slug: "backlinks",
    category: "google",
    icon: Link2,
    availability: "backlink-data",
    title: "Backlinks and link gap",
    summary: "See which websites link to yours, which links are new or lost, and which sites link to competitors but not to you.",
    details: [
      "A list of the websites that link to you, with new and lost links since the last check.",
      "Link gap: websites that link to your competitors but not to you — often the easiest ones to ask.",
      "Download any list as a spreadsheet file.",
    ],
  },
  {
    slug: "business-profile",
    category: "google",
    icon: MapPin,
    availability: "maps-data",
    title: "Google Business Profile monitor",
    summary: "Keep an eye on your Google Maps listing: rating, reviews, and whether the details are complete and match your website.",
    details: [
      "Pick your business on Google Maps and we take a snapshot on a schedule.",
      "A checklist shows what's missing — opening hours, photos, website link, description.",
      "We compare your name, address and phone on Google with the ones on your website and flag any that don't match.",
    ],
  },

  // ---------------------------------------------------------------- Reports, alerts and language
  {
    slug: "reports",
    category: "updates",
    icon: BellRing,
    title: "Monthly report and emails",
    summary: "A monthly report, plus an email when each website check or AI check is done.",
    details: [
      "A monthly report that shows what changed, how many answers each number is based on, and the fixes made that month.",
      "Emails when a website check or AI check is done, or when a fix is waiting for your OK.",
      "Custom plan: reports and emails with your own name, logo and colour.",
    ],
  },
  {
    slug: "alerts",
    category: "updates",
    icon: Bell,
    title: "Alerts",
    summary: "Hear about it straight away when something important changes — not at the end of the month.",
    details: [
      "Alerts when your score drops, a new urgent problem appears, your website can't be reached, or Google is blocked from a page.",
      "Alerts when AI assistants name you less often, or start or stop naming you for a question you track.",
      "Choose in-app, email or WhatsApp, instantly or as one daily summary, and set how big a change must be.",
    ],
  },
  {
    slug: "locales",
    category: "updates",
    icon: Globe,
    title: "Your country and language",
    summary: "Questions are written for your country and language, because AI answers differ from place to place.",
    details: [
      "Pick the country and language for each website; your customer questions are written for that market.",
      "To check another country, add it as a separate website. A combined view of several countries isn't available yet.",
    ],
  },
  {
    slug: "hindi",
    category: "updates",
    icon: Languages,
    title: "Hindi website",
    summary: `Read about ${BRAND.name} in Hindi, and run the free website check from a Hindi page.`,
    details: [
      "Home, pricing, services, about, contact and the free check are available in Hindi.",
      "Switch between English and Hindi from the top of any of those pages.",
    ],
  },

  // ---------------------------------------------------------------- For agencies and developers
  {
    slug: "report-builder",
    category: "agencies",
    icon: Briefcase,
    title: "Client report builder and portfolio",
    summary: "Build client reports from the sections you choose, and see every client website on one screen.",
    details: [
      "Pick sections — summary, scores, fixes done, open problems, AI mentions, competitors, Search Console, page speed, your own notes — and save them as a template.",
      "Share a report as a private link or print it to PDF, with your own logo on a Custom plan.",
      "Portfolio: every website in your account in one table, with scores, changes and what's waiting for you.",
    ],
  },
  {
    slug: "developer-api",
    category: "agencies",
    icon: Braces,
    title: "Public API, MCP server and Looker Studio",
    summary: "Use your scores, problems and AI answers in your own tools, dashboards and AI assistants.",
    details: [
      "Public API: read-only access to your websites' data with an API key you create and can cancel any time.",
      "MCP server: connect AI assistants that support MCP (such as Claude) so they can read your data when you ask.",
      "Looker Studio: pull your numbers into Google's free dashboard tool.",
    ],
  },
];

export const HOW_STEPS = [
  {
    title: "Add your website",
    body: "Type your website address, choose your country and competitors, and connect your website if you like. Nothing on your site changes until you say OK.",
  },
  {
    title: "We check",
    body: "We check your website for problems and ask AI assistants your customer questions, so you have a starting point. Every number shows how many answers it comes from.",
  },
  {
    title: "Get your to-do list",
    body: "You get a list of fixes, most useful first. Each one shows the reason, how much it helps and a ready-to-review draft.",
  },
  {
    title: "Approve, publish, check again",
    body: "Approve the exact change, publish it through your connected website (or by hand), and we check again so you can see what changed — and undo it if needed.",
  },
];

export const RISK_CLASSES = [
  // Mirrors the policy engine (src/lib/policy/engine.ts). Keep the two in sync.
  {
    cls: "A" as const,
    name: "Safe (no change to your site)",
    body: "Website checks, writing briefs and to-dos for your team. Nothing on your website changes, so these run on their own within your plan.",
  },
  {
    cls: "B" as const,
    name: "Needs your OK: small edits",
    body: "Small edits you can undo, like Google headlines, Google summaries and image descriptions on less important pages. You can choose to let one type of small edit go live on its own, always with undo.",
  },
  {
    cls: "C" as const,
    name: "Needs your OK: bigger changes",
    body: "Page text, questions and answers, info for Google and AI, new pages, and anything on your homepage or main pages. Always needs your OK on the exact draft.",
  },
  {
    cls: "D" as const,
    name: "Advice only",
    body: "Risky changes (deleting pages, changing web addresses, your site's robot rules file, checkout or payments, legal pages, health or money claims, site-wide changes). We never make these — we only tell you what to do.",
  },
];

/** The 5 most important questions, in plain words (home page + FAQ markup). */
export const FAQS: { q: string; a: string }[] = [
  {
    q: "What does it mean to show up in AI answers?",
    a: "More and more people ask ChatGPT, Gemini or Google's AI for a recommendation instead of searching. Showing up means these assistants know your business, name it, and link to your website when someone asks about what you sell.",
  },
  {
    q: `Can ${BRAND.name} promise I'll show up on Google or in AI answers?`,
    a: "No. Nobody can honestly promise a Google position or an AI mention — other companies write those answers, and they change over time. We check carefully, show you what we found, and help you fix the problems most likely to hold you back.",
  },
  {
    q: "Will you change my website without asking?",
    a: "No. Every change to your website needs your OK on the exact wording first. We save the old version before any change, so you can undo it in one click.",
  },
  {
    q: "Does it work with my website?",
    a: "Yes. We connect to WordPress, Shopify, Wix, Webflow and more. For any other website, you get each fix as simple step-by-step instructions you (or your web person) can copy.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Every plan starts with a 7-day free trial, so you can see all your fixes and what ChatGPT says about you before you pay. Cancel any time.",
  },
];
