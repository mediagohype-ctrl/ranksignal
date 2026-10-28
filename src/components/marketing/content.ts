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
    summary: "Find the questions real buyers ask AI assistants about your category, by topic, intent and market.",
    details: [
      "Seed prompts from your products, categories and competitors, then expand them into realistic conversational questions.",
      "Group prompts by intent (discovery, comparison, how-to, pricing) so you track what matters commercially.",
      "Edit, pin or retire prompts at any time; history is kept so trends stay comparable.",
    ],
  },
  {
    slug: "visibility-tracking",
    icon: MessageSquareText,
    title: "AI visibility tracking",
    summary: "Measure how often your brand is mentioned in AI answers across engines, with the sample size shown.",
    details: [
      "Runs your tracked prompts on a schedule against supported answer engines and records each answer as an observation.",
      "Reports mention rate, position within the answer and sentiment, with the number of samples behind every figure.",
      "Answers vary run to run, so we repeat prompts and show ranges rather than single-point numbers.",
    ],
  },
  {
    slug: "citation-tracking",
    icon: Quote,
    title: "Citation tracking",
    summary: "See which URLs AI answers cite — yours, competitors’, or third-party sources — and how often.",
    details: [
      "Extracts linked and named sources from each answer and maps them back to your pages where possible.",
      "Highlights third-party pages (reviews, directories, forums) that engines lean on in your category.",
      "Shows which of your pages are cited and which comparable pages are not.",
    ],
  },
  {
    slug: "competitor-share",
    icon: Users,
    title: "Competitor share of voice",
    summary: "Compare mention and citation share against the competitors you choose, prompt by prompt.",
    details: [
      "Track named competitors and discover brands that engines mention alongside you.",
      "Break down share by topic, engine and market to see where you trail or lead.",
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
      "Each change is classified by risk (A–D). Only classes you explicitly allow can run without a human approval.",
      "Approvals are tied to the exact draft — if the content changes, the approval no longer applies.",
      "Every execution is snapshotted and logged so it can be rolled back.",
    ],
  },
  {
    slug: "connectors",
    icon: Plug,
    title: "CMS connectors",
    summary: "Connect WordPress via application passwords, or open pull requests against a Git repository.",
    details: [
      "WordPress: scoped application password, used only for the changes you approve.",
      "Git: changes are proposed as pull requests so your normal review and CI process stays in charge.",
      "Prefer to keep it manual? Export fixes as copy-ready instructions instead.",
    ],
  },
  {
    slug: "locales",
    icon: Globe,
    title: "Multi-country & locale tracking",
    summary: "Track prompts per country and language, because AI answers differ by market.",
    details: [
      "Assign markets and languages per project; metrics are reported per locale and combined.",
      "Useful for brands selling across India and international markets with localised pages.",
    ],
  },
  {
    slug: "reports",
    icon: BellRing,
    title: "Reports & alerts",
    summary: "Scheduled summaries and alerts when visibility, citations or technical health change materially.",
    details: [
      "Weekly or monthly reports showing measured changes, sample sizes and the fixes shipped in the period.",
      "Alerts for significant drops, new competitor mentions and newly broken technical checks.",
      "White-label agency reports are on the roadmap.",
    ],
  },
];

export const HOW_STEPS = [
  {
    title: "Connect your site",
    body: "Add your domain, choose markets and competitors, and optionally connect WordPress or a Git repository. Read-only until you say otherwise.",
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
    body: "Approve the exact change, publish through your connector (or by hand), and we re-measure so you can see what moved — and roll back if needed.",
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
    a: "We run your tracked prompts repeatedly against supported answer engines and record each answer. Metrics like mention rate and citation rate are calculated from those samples, and we always show the sample size and a range so you can judge how reliable a number is.",
  },
  {
    q: "Will you change my website without asking?",
    a: "Not unless you allow it. Every change has a risk class. By default everything needs your approval of the exact diff; you can optionally allow low-risk (class A) fixes to run automatically. Class D changes are never executed. A kill switch pauses all publishing instantly.",
  },
  {
    q: "Which CMS platforms do you support?",
    a: "WordPress (via an application password) and Git-based sites (via pull requests) at launch. For any other platform you can export fixes as copy-ready instructions and apply them yourself.",
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
