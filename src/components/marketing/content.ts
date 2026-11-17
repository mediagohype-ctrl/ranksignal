import type { LucideIcon } from "lucide-react";
import { BellRing, ListChecks, MessageSquareText, ScanSearch } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { SELF_FIX_LINE } from "@/lib/billing/offer";
import { DFY_PLAN, SELF_PLAN, aiCheckedLine, freq, num } from "./plans";

/**
 * What a feature needs from an outside data supplier before it can run. The page turns this into "Coming next"
 * at request time (env only — see @/lib/dataforseo/status). Leave it out for features that always work.
 *  - google-data: our paid Google data partner (rankings, keyword data, AI Overviews).
 *  - backlink-data: the same partner's separate backlink data.
 *  - maps-data: Google's Places data for Business Profile snapshots.
 */
export type FeatureAvailability = "google-data" | "backlink-data" | "maps-data";

export type FeatureCard = {
  /** Anchor id on /features. */
  id: "check" | "ai-answers" | "fix" | "reports";
  title: string;
  summary: string;
  /** About three short lines. Limits come from the plan config, never typed by hand. */
  bullets: string[];
  icon: LucideIcon;
};

const SITE_CHECK = freq(SELF_PLAN.limits.minScanIntervalDays).toLowerCase();

/** /features: the four things MyWebRank does today (owner's audit, 15 Nov 2026). Everything here is live. */
export const FEATURE_CARDS: FeatureCard[] = [
  {
    id: "check",
    icon: ScanSearch,
    title: "Check",
    summary: "We read your website and find what stops Google and AI from understanding it.",
    bullets: [
      `A ${SITE_CHECK} check of your website, up to ${num(SELF_PLAN.limits.maxPagesPerCrawl)} pages`,
      "One score out of 100, plus your SEO, AEO, GEO and Brand scores",
      "Every problem explained in plain words: broken links, slow pages, missing info for Google and AI",
    ],
  },
  {
    id: "ai-answers",
    icon: MessageSquareText,
    title: "AI answers",
    summary: "See what AI assistants say when customers ask about what you sell.",
    bullets: [
      `${aiCheckedLine(SELF_PLAN.id)}, with the questions your customers ask`,
      "See how often you are named and linked, and who is named instead",
      "Every number shows how many answers it comes from",
    ],
  },
  {
    id: "fix",
    icon: ListChecks,
    title: "Fix",
    summary: "A short to-do list, most important first, with the fix written for you.",
    bullets: [
      "A to-do list in plain words, most important first",
      `${SELF_PLAN.name}: ${SELF_FIX_LINE.charAt(0).toLowerCase()}${SELF_FIX_LINE.slice(1)}. You make the change`,
      `${DFY_PLAN.name}: our team makes the changes on your website, after your OK`,
    ],
  },
  {
    id: "reports",
    icon: BellRing,
    title: "Reports",
    summary: "Know what changed without logging in every day.",
    bullets: [
      "A monthly report you can read in 2 minutes",
      "An email when each website check or AI check is done",
      "Every result is kept, so you can see what changed since last time",
    ],
  },
];

/**
 * Not switched on yet: shown together in one small "Coming next" strip at the bottom of /features, never mixed in
 * with what works today. Each one leaves the strip when its data supplier is configured (isFeatureLive).
 */
export const COMING_NEXT: { slug: string; title: string; availability: FeatureAvailability }[] = [
  { slug: "ai-overviews", title: "Google AI Overviews", availability: "google-data" },
  { slug: "rank-tracker", title: "Rank tracker", availability: "google-data" },
  { slug: "keyword-research", title: "Keyword research", availability: "google-data" },
  { slug: "competitor-research", title: "Competitors on Google", availability: "google-data" },
  { slug: "backlinks", title: "Backlinks", availability: "backlink-data" },
  { slug: "business-profile", title: "Google Business Profile monitor", availability: "maps-data" },
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
    a: "No. On Do it myself we never touch your website: you make each change yourself, with our steps. On Do it for me our team makes the changes, and asks for your OK first.",
  },
  {
    q: "Does it work with my website?",
    a: "Yes. The check works on any website. Each fix comes ready to paste, with step-by-step help for you or your web person. On Do it for me, our team makes the changes for you.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes. Do it myself starts with a 7-day free trial, no card needed, so you can see your fixes and what ChatGPT says about you before you pay. Do it for me starts with a free 30-minute call.",
  },
];
