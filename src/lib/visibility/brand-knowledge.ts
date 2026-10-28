// Brand knowledge probe (GEO signal): ask each real AI provider neutral questions about the brand and
// compare what it says with the project's own facts. Answers are untrusted text. Never run with the
// simulated provider — a fabricated answer says nothing about what AI actually knows.
import { z } from "zod";
import { db } from "@/lib/db";
import { generateStructured, isLlmConfigured } from "@/lib/providers/llm";
import type { ProviderAnswer, VisibilityProvider, VisibilityQuery } from "@/lib/types";
import { termRegex, toCitations } from "./parse";

export const BRAND_PROBE_TASK_TYPE = "brand_probe";
export const BRAND_PROBE_VERSION = "bk-1";

export interface BrandFacts {
  brandNames: string[];
  websiteDomain: string;
  categories: string[];
  audience?: string | null;
  countries?: string[];
  homeTitle?: string | null;
  homeDescription?: string | null;
}

export interface BrandKnowledgeResult {
  provider: string;
  platformLabel: string;
  model?: string;
  knowsBrand: boolean;
  /** What the AI says about the brand, 1–2 sentences (paraphrase or excerpt of untrusted text). */
  summary: string;
  /** Claims that conflict with, or aren't supported by, the brand's own site. */
  inaccuracies: string[];
  confidence: number;
  ownSiteCited: boolean;
  method: "llm" | "heuristic";
  version: string;
}

export function brandProbePrompts(brand: string, opts: { includeReviews?: boolean } = {}): string[] {
  const out = [`What is ${brand}? What does it offer and who is it for?`];
  if (opts.includeReviews !== false) out.push(`Is ${brand} legit? What do reviews say about ${brand}?`);
  return out;
}

/** Facts from the project profile plus the home page title/description from the latest crawl. */
export async function loadBrandFacts(
  project: { id: string; organizationId: string; brandNames: unknown; categories: unknown; audience: string | null; countries: unknown; name: string },
  websiteDomain: string,
): Promise<BrandFacts> {
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : []);
  const facts: BrandFacts = {
    brandNames: strs(project.brandNames).length ? strs(project.brandNames) : [project.name],
    websiteDomain,
    categories: strs(project.categories),
    audience: project.audience,
    countries: strs(project.countries),
  };
  try {
    const crawl = await db.crawlRun.findFirst({
      where: { organizationId: project.organizationId, projectId: project.id, pagesCrawled: { gt: 0 } },
      orderBy: { createdAt: "desc" },
    });
    if (crawl) {
      const pages = await db.crawlPage.findMany({
        where: { crawlRunId: crawl.id, organizationId: project.organizationId },
        orderBy: { crawledAt: "asc" },
        take: 25,
        select: { url: true, finalUrl: true, extracted: true },
      });
      const isHome = (u: string | null) => {
        try {
          return !!u && new URL(u).pathname.replace(/\/+$/, "") === "";
        } catch {
          return false;
        }
      };
      const home = pages.find((p) => isHome(p.finalUrl) || isHome(p.url)) ?? pages[0];
      const ex = (home?.extracted as { title?: unknown; description?: unknown } | null) ?? null;
      if (ex) {
        facts.homeTitle = typeof ex.title === "string" ? ex.title.slice(0, 300) : null;
        facts.homeDescription = typeof ex.description === "string" ? ex.description.slice(0, 500) : null;
      }
    }
  } catch {
    // Crawl data is optional context.
  }
  return facts;
}

const NO_KNOWLEDGE =
  /\b(?:i (?:couldn'?t|could not|cannot|can'?t|was unable to|am unable to) (?:find|locate|verify)|i (?:don'?t|do not) have (?:any |specific |enough |reliable |detailed )?information|no (?:specific |reliable |verifiable |publicly available |widely available )?information (?:about|on|regarding)|not (?:aware of|familiar with)|unable to find|(?:there is|there's) (?:very )?(?:little|limited|no) (?:public(?:ly available)? )?information)\b/i;

function firstSentences(text: string, n = 2, maxLen = 320): string {
  const clean = text.replace(/[*_#>`]+/g, "").replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [clean];
  const s = sentences.slice(0, n).join(" ").trim();
  return s.length > maxLen ? `${s.slice(0, maxLen - 1).trimEnd()}…` : s;
}

/** Deterministic fallback when no LLM is configured: brand mentioned + own domain cited → knows brand. */
export function heuristicBrandKnowledge(answers: Pick<ProviderAnswer, "answerText" | "citations">[], facts: BrandFacts) {
  const text = answers.map((a) => a.answerText ?? "").join("\n\n");
  const terms = facts.brandNames.filter((b) => b.trim().length > 0);
  const mentioned = terms.some((t) => termRegex(t).test(text));
  const ownSiteCited = answers.some((a) => toCitations(a.citations ?? [], facts.websiteDomain).some((c) => c.ownedByCustomer));
  const domainInText = !!facts.websiteDomain && text.toLowerCase().includes(facts.websiteDomain.toLowerCase());
  const denies = NO_KNOWLEDGE.test(text);
  const categoryHit = facts.categories.some((c) => c.trim() && text.toLowerCase().includes(c.trim().toLowerCase()));

  const knowsBrand = mentioned && (ownSiteCited || domainInText) && !denies;
  let confidence = 0.4;
  if (knowsBrand) confidence = categoryHit ? 0.75 : 0.65;
  else if (denies || !mentioned) confidence = 0.6;

  const brandSentence = terms.length
    ? (text.match(/[^.!?\n]+[.!?]+/g) ?? []).find((s) => terms.some((t) => termRegex(t).test(s)))
    : undefined;
  const summary = denies
    ? "The AI said it could not find reliable information about this brand."
    : firstSentences(brandSentence ?? text, 2) || "No answer text.";
  return { knowsBrand, summary, inaccuracies: [] as string[], confidence, ownSiteCited };
}

const assessmentSchema = z.object({
  knowsBrand: z.boolean(),
  summary: z.string().max(600),
  inaccuracies: z.array(z.string().max(300)).max(8),
  confidence: z.number().min(0).max(1),
});

export async function assessBrandKnowledge(
  answers: Pick<ProviderAnswer, "answerText" | "citations">[],
  facts: BrandFacts,
): Promise<{ knowsBrand: boolean; summary: string; inaccuracies: string[]; confidence: number; ownSiteCited: boolean; method: "llm" | "heuristic"; costMicros: number }> {
  const h = heuristicBrandKnowledge(answers, facts);
  if (!isLlmConfigured()) return { ...h, method: "heuristic", costMicros: 0 };
  const res = await generateStructured({
    schema: assessmentSchema,
    system:
      "You check whether an AI assistant's answer correctly describes a specific business. You receive the business's own facts " +
      "(from its website/profile) and the assistant's answers. Decide knowsBrand = true only if the answers clearly describe THIS " +
      "business (matching name AND what it does or its website), not a different company with a similar name, and do not say they " +
      "lack information. summary: 1–2 plain-English sentences on what the AI says about the brand. inaccuracies: short statements " +
      "of claims in the answers that conflict with the business facts or are not supported by them (e.g. wrong category, wrong " +
      "location, invented products, confusion with another company); empty if none. confidence: 0–1 in your judgement. " +
      "Do not invent facts beyond the inputs.",
    user: JSON.stringify({
      businessFacts: {
        brandNames: facts.brandNames,
        website: facts.websiteDomain,
        categories: facts.categories,
        audience: facts.audience ?? null,
        countries: facts.countries ?? [],
        homePageTitle: facts.homeTitle ?? null,
        homePageDescription: facts.homeDescription ?? null,
      },
      ownWebsiteCitedByAI: h.ownSiteCited,
      aiAnswers: answers.map((a) => ({
        text: (a.answerText ?? "").slice(0, 6000),
        citedUrls: (a.citations ?? []).slice(0, 15).map((c) => c.title ?? c.url),
      })),
    }),
    maxTokens: 800,
  });
  if (!res) return { ...h, method: "heuristic", costMicros: 0 };
  return {
    knowsBrand: res.data.knowsBrand,
    summary: firstSentences(res.data.summary, 2, 400),
    inaccuracies: res.data.inaccuracies.map((s) => s.trim()).filter(Boolean),
    confidence: Math.round(res.data.confidence * 100) / 100,
    ownSiteCited: h.ownSiteCited,
    method: "llm",
    costMicros: res.costMicros,
  };
}

export interface ProbeOutcome {
  results: BrandKnowledgeResult[];
  /** Provider answer cost per provider id (micro-USD) and number of successful probe calls. */
  usage: Record<string, { calls: number; costMicros: number }>;
  assessmentCostMicros: number;
  errors: Record<string, string>;
}

/**
 * Run the probe against each REAL provider. `runner` performs the provider call (the job passes its
 * retry/timeout wrapper). Simulated providers are skipped entirely.
 */
export async function runBrandKnowledgeProbe(o: {
  providers: VisibilityProvider[];
  facts: BrandFacts;
  locale: string;
  includeReviews?: boolean;
  runner?: (p: VisibilityProvider, q: VisibilityQuery) => Promise<ProviderAnswer>;
}): Promise<ProbeOutcome> {
  const out: ProbeOutcome = { results: [], usage: {}, assessmentCostMicros: 0, errors: {} };
  const brand = o.facts.brandNames[0];
  if (!brand) return out;
  const prompts = brandProbePrompts(brand, { includeReviews: o.includeReviews });
  const runner = o.runner ?? ((p, q) => p.run(q));
  for (const provider of o.providers) {
    if (provider.simulated) continue;
    const answers: ProviderAnswer[] = [];
    for (const [i, text] of prompts.entries()) {
      try {
        const a = await runner(provider, { promptId: `brand-probe-${i}`, text, locale: o.locale });
        if (a.simulated) continue;
        answers.push(a);
        const u = out.usage[provider.id] ?? { calls: 0, costMicros: 0 };
        out.usage[provider.id] = { calls: u.calls + 1, costMicros: u.costMicros + (a.costMicros || 0) };
      } catch (err) {
        out.errors[provider.id] = err instanceof Error ? err.message.slice(0, 300) : "unknown error";
      }
    }
    if (answers.length === 0) continue;
    try {
      const a = await assessBrandKnowledge(answers, o.facts);
      out.assessmentCostMicros += a.costMicros;
      out.results.push({
        provider: provider.id,
        platformLabel: answers[0].platformLabel,
        model: answers[0].model,
        knowsBrand: a.knowsBrand,
        summary: a.summary,
        inaccuracies: a.inaccuracies,
        confidence: a.confidence,
        ownSiteCited: a.ownSiteCited,
        method: a.method,
        version: BRAND_PROBE_VERSION,
      });
    } catch (err) {
      out.errors[provider.id] = err instanceof Error ? err.message.slice(0, 300) : "assessment failed";
    }
  }
  return out;
}
