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
    title: "Prompt research",
    summary: "Find the questions real buyers ask AI assistants about your category, by topic and intent, for your main market.",
    details: [
      "Seed prompts from your products, categories and competitors, then expand them into realistic conversational questions.",
      "Group prompts by intent (informational, commercial, comparison, transactional) so you track what matters commercially.",
      "Edit, prioritise or pause prompts at any time; history is kept so trends stay comparable.",
    ],
  },
  {
    slug: "visibility-tracking",
    icon: MessageSquareText,
    title: "AI visibility tracking",
    summary: "Measure how often your brand is mentioned in AI answers across engines, with the sample size shown.",
    details: [
      "Runs your tracked prompts on a schedule against supported answer engines and records each answer as an observation.",
      "Reports mention, citation and recommendation rates, and the tone of each answer, with the number of samples behind every figure.",
      "Answers vary from run to run, so we re-ask your questions on every scheduled check and always show how many answers each figure is based on.",
    ],
  },
  {
    slug: "citation-tracking",
    icon: Quote,
    title: "Citation tracking",
    summary: "See which URLs AI answers cite — yours, competitors’, or third-party sources — and how often.",
    details: [
      "Records the linked sources in each answer and flags which ones are on your own domain.",
      "Lists the third-party sites engines cite most in your category, and turns the ones you're missing into suggestions for your off-site tracker.",
      "Shows how often your own site is cited compared with everyone else.",
    ],
  },
  {
    slug: "competitor-share",
    icon: Users,
    title: "Competitor share of voice",
    summary: "Compare mention and citation share against the competitors you choose, prompt by prompt.",
    details: [
      "Track the competitors you name and see how often each one is mentioned next to you.",
      "See your share of voice overall, and your mention and citation rates per AI engine.",
      "Competitor data is derived only from public AI answers and public pages.",
    ],
  },
  {
    slug: "audit",
    icon: ScanSearch,
    title: "Technical & AI-readiness audit",
    summary: "Crawl your site for issues that stop crawlers and answer engines from understanding your content.",
    details: [
      "Checks indexability, canonicals, robots rules (including AI crawler user-agents), status codes and redirects.",
      "Reviews structured data, heading structure, answer-first content and entity clarity.",
      "Respects robots.txt and crawl limits; your site is never load-tested.",
    ],
  },
  {
    slug: "recommendations",
    icon: Lightbulb,
    title: "Evidence-backed recommendations",
    summary: "Every suggested fix links to the audit finding or answer sample that motivated it.",
    details: [
      "Recommendations are prioritised by expected impact and effort, with the evidence shown inline.",
      "We separate what we measured from what we expect — a change is never presented as the proven cause of a movement.",
      "Draft content is generated for your review; nothing is published without the rules you set.",
    ],
  },
  {
    slug: "publishing",
    icon: ShieldCheck,
    title: "Approval-gated publishing with rollback",
    summary: "Ship fixes as exact diffs you approve, with one-click rollback and a global kill switch.",
    details: [
      "Each change is classified by risk (A–D). Only the low-risk change types you explicitly allow can change your site without a human approval.",
      "Approvals are tied to the exact draft — if the content changes, the approval no longer applies.",
      "Every execution is snapshotted and logged so it can be rolled back.",
    ],
  },
  {
    slug: "connectors",
    icon: Plug,
    title: "CMS connectors",
    summary: "Connect WordPress, GitHub, Shopify, Webflow, Contentful, Sanity or Wix — or export fixes for any other platform.",
    details: [
      "WordPress: scoped application password, used only for the changes you approve.",
      "GitHub: changes are proposed as pull requests so your normal review and CI process stays in charge.",
      "Shopify, Webflow, Contentful, Sanity and Wix: we write drafts and SEO fields where each platform's API allows it.",
      "Prefer to keep it manual? Export fixes as copy-ready instructions instead.",
    ],
  },
  {
    slug: "locales",
    icon: Globe,
    title: "Multi-country & locale tracking",
    summary: "Track prompts per country and language, because AI answers differ by market.",
    details: [
      "Set the country and language per project; your tracked questions are written for that market.",
      "Track another market by adding a separate project for it. Combined multi-market breakdowns are not available yet.",
    ],
  },
  {
    slug: "reports",
    icon: BellRing,
    title: "Reports & alerts",
    summary: "A monthly impact report, plus an email when each scheduled scan or AI check finishes.",
    details: [
      "Monthly reports showing measured changes, sample sizes and the fixes shipped in the period.",
      "Emails when a scan or AI check finishes, or when a change is waiting for your approval.",
      "Agency plan: white-label reports and emails with your own name, logo and colour.",
    ],
  },
];

export const HOW_STEPS = [
  {
    title: "Connect your site",
    body: "Add your domain, choose your market and competitors, and optionally connect your CMS or a GitHub repository. Nothing on your site changes until you approve it.",
  },
  {
    title: "Audit and measure",
    body: "We crawl your site for technical and AI-readiness issues and run your tracked prompts to establish a baseline, with sample sizes shown.",
  },
  {
    title: "Review prioritised fixes",
    body: "Get a queue of evidence-backed fixes, each with a risk class, expected impact and a ready-to-review draft or exact diff.",
  },
  {
    title: "Approve, publish, re-measure",
    body: "Approve the exact change, apply it through your connector (or by hand), and we re-measure so you can see what moved — and roll back connector changes if needed.",
  },
];

export const RISK_CLASSES = [
  // Mirrors the policy engine (src/lib/policy/engine.ts). Keep the two in sync.
  {
    cls: "A" as const,
    name: "Observe & prepare",
    body: "Audits, content briefs and internal tasks. Nothing on your website changes, so these run on their own within your plan.",
  },
  {
    cls: "B" as const,
    name: "Low risk",
    body: "Small reversible edits such as meta descriptions, titles and image alt text on non-critical pages. They need your approval by default; you can let a specific type apply automatically, always with rollback.",
  },
  {
    cls: "C" as const,
    name: "Material",
    body: "Page content, FAQ or schema changes, new drafts, and anything on your homepage or key pages. Always requires human approval of the exact draft.",
  },
  {
    cls: "D" as const,
    name: "Advisory only",
    body: "Sensitive changes (deleting pages, URLs and redirects, robots rules, checkout or payment, legal pages, regulated claims, site-wide changes). Never executed by the system — recommendations only.",
  },
];

export const FAQS: { q: string; a: string }[] = [
  {
    q: "What is AI visibility (GEO / AEO)?",
    a: "Generative engine optimisation (GEO) and answer engine optimisation (AEO) describe making your brand easy for AI assistants such as ChatGPT, Gemini, Perplexity and Google AI Overviews to understand, mention and cite when people ask questions in your category.",
  },
  {
    q: `Can ${BRAND.name} guarantee my brand will appear in AI answers?`,
    a: "No. Nobody can honestly guarantee rankings, mentions or citations — AI answers are generated by third-party systems and change over time. We help you measure your visibility carefully and fix the issues most likely to hold you back.",
  },
  {
    q: "How do you measure mentions and citations?",
    a: "We run your tracked prompts repeatedly against supported answer engines and record each answer. Metrics like mention rate and citation rate are calculated from those samples, and we always show the sample size so you can judge how reliable a number is.",
  },
  {
    q: "Will you change my website without asking?",
    a: "Not unless you allow it. Every change has a risk class. By default every change to your site needs your approval of the exact diff; you can optionally let specific low-risk (class B) fixes apply automatically. Class D changes are never executed. A kill switch can pause all publishing for your workspace instantly — just ask us.",
  },
  {
    q: "Which CMS platforms do you support?",
    a: "WordPress (application password), GitHub (pull requests), Shopify, Webflow, Contentful, Sanity and Wix. On the hosted platforms we write drafts and SEO fields where each platform's API allows it. For everything else you can export fixes as copy-ready instructions and apply them yourself.",
  },
  {
    q: "Is this a replacement for traditional SEO?",
    a: "No — it builds on it. Technical health, crawlability and clear content still matter for AI answers. Our audit covers classic SEO fundamentals plus AI-specific readiness checks.",
  },
  {
    q: "How long until I see results?",
    a: "Measurement starts on day one. Whether and when AI answers change depends on the engines’ own refresh cycles and on what you ship, so we report measured changes over time without claiming that a specific fix caused them.",
  },
  {
    q: "Do you offer a free trial?",
    a: "Yes. Every plan starts with a 7-day free trial so you can run an audit and a first visibility baseline before you pay.",
  },
];
