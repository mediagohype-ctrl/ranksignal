import type { LucideIcon } from "lucide-react";
import {
  BellRing,
  Globe,
  Lightbulb,
  MessageSquareText,
  Plug,
  Quote,
  ScanSearch,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { BRAND } from "@/lib/brand";

export type Feature = { slug: string; title: string; summary: string; details: string[]; icon: LucideIcon };

export const FEATURES: Feature[] = [
  {
    slug: "prompt-research",
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
    slug: "citation-tracking",
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
    icon: Users,
    title: "You vs competitors",
    summary: "See how often you're named compared with the competitors you choose, question by question.",
    details: [
      "Add the competitors you care about and see how often each one is named next to you.",
      "See how often you're named vs competitors overall, and for each AI assistant.",
      "Competitor numbers come only from public AI answers and public web pages.",
    ],
  },
  {
    slug: "audit",
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
    slug: "recommendations",
    icon: Lightbulb,
    title: "A clear to-do list",
    summary: "Every fix shows the problem or AI answer that led to it, so you know why it's there.",
    details: [
      "Fixes are sorted by how much they help and how long they take, with the reason shown next to each one.",
      "We keep what we measured separate from what we expect. We never claim a fix caused a change we can't prove.",
      "We draft new text for you to review. Nothing goes live outside the rules you set.",
    ],
  },
  {
    slug: "publishing",
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
    slug: "locales",
    icon: Globe,
    title: "Your country and language",
    summary: "Questions are written for your country and language, because AI answers differ from place to place.",
    details: [
      "Pick the country and language for each website; your customer questions are written for that market.",
      "To check another country, add it as a separate website. A combined view of several countries isn't available yet.",
    ],
  },
  {
    slug: "reports",
    icon: BellRing,
    title: "Monthly report and emails",
    summary: "A monthly report, plus an email when each website check or AI check is done.",
    details: [
      "A monthly report that shows what changed, how many answers each number is based on, and the fixes made that month.",
      "Emails when a website check or AI check is done, or when a fix is waiting for your OK.",
      "Agency plan: reports and emails with your own name, logo and colour.",
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
