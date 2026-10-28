// Prompt research: candidate buyer prompts from the project profile. Uses the LLM when configured,
// otherwise deterministic templates. Candidates are suggestions — users choose what to track.
import { z } from "zod";
import { generateStructured, isLlmConfigured } from "@/lib/providers/llm";

export const PROMPT_INTENTS = ["informational", "commercial", "comparison", "navigational", "transactional"] as const;
export type PromptIntent = (typeof PROMPT_INTENTS)[number];

export interface PromptCandidate {
  text: string;
  intent: PromptIntent;
  topic: string | null;
  locale: string;
  source: "llm" | "template";
}

export interface ResearchProfile {
  brandNames: string[];
  categories: string[];
  audience?: string | null;
  countries: string[];
  languages: string[];
  competitors: { name: string }[];
  keywords: string[];
  /** Serves customers in a local area (shop, clinic, trades…). Auto-detected from categories when omitted. */
  local?: boolean;
}

/** Default number of prompts suggested by research (blueprint: 12–20 per project to start). */
export const DEFAULT_PROMPT_COUNT = 20;

const COUNTRY_NAMES: Record<string, string> = {
  IN: "India", US: "the US", GB: "the UK", AE: "the UAE", SG: "Singapore", AU: "Australia", CA: "Canada", DE: "Germany", FR: "France",
  NZ: "New Zealand", IE: "Ireland", ZA: "South Africa", MY: "Malaysia", PH: "the Philippines", SA: "Saudi Arabia", NG: "Nigeria",
  KE: "Kenya", BD: "Bangladesh", PK: "Pakistan", LK: "Sri Lanka", NP: "Nepal",
};

const LOCAL_HINTS =
  /\b(shops?|stores?|clinics?|salons?|spas?|restaurants?|caf[eé]s?|bakery|bakeries|plumb(?:er|ers|ing)|electricians?|dentists?|dental|doctors?|gyms?|fitness cent(?:er|re)s?|repairs?|cleaning|laundry|tutors?|tuition|coaching|hotels?|florists?|pharmacy|pharmacies|mechanics?|garages?|boutiques?|showrooms?|caterers?|catering|physio(?:therapy)?|vets?|veterinary|barbers?|movers|packers|estate agents?|near me|local)\b/i;

export function looksLocal(p: Pick<ResearchProfile, "categories" | "keywords" | "local">): boolean {
  if (typeof p.local === "boolean") return p.local;
  return [...p.categories, ...p.keywords].some((t) => LOCAL_HINTS.test(t));
}
const STOPWORDS = new Set(["the", "a", "an", "in", "for", "of", "to", "is", "are", "what", "which", "best", "top", "my", "me", "and", "or", "with", "on", "do", "i", "how", "should"]);

export function normalizeTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t && !STOPWORDS.has(t))
      .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t)),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export const DEDUPE_THRESHOLD = 0.8;

/** Keep the first of any group of prompts whose normalized token Jaccard similarity is ≥ threshold. */
export function dedupePrompts<T extends { text: string }>(items: T[], existing: string[] = [], threshold = DEDUPE_THRESHOLD): T[] {
  const kept: { tokens: Set<string> }[] = existing.map((t) => ({ tokens: normalizeTokens(t) }));
  const out: T[] = [];
  for (const item of items) {
    const tokens = normalizeTokens(item.text);
    if (tokens.size === 0) continue;
    if (kept.some((k) => jaccard(k.tokens, tokens) >= threshold)) continue;
    kept.push({ tokens });
    out.push(item);
  }
  return out;
}

function localeFor(lang: string, country: string) {
  return `${lang.toLowerCase()}-${country.toUpperCase()}`;
}

/**
 * Deterministic buyer-style prompts (used when no LLM is configured). Ordered by priority so the first
 * N keep a mix of intents; most do NOT name the brand, so they measure organic visibility.
 */
export function templatePrompts(p: ResearchProfile, max = DEFAULT_PROMPT_COUNT): PromptCandidate[] {
  const country = p.countries[0] ?? "IN";
  const countryName = COUNTRY_NAMES[country] ?? country;
  const locale = localeFor(p.languages[0] ?? "en", country);
  const topics = [...new Set([...p.categories, ...p.keywords].map((t) => t.trim()).filter(Boolean))];
  const brand = p.brandNames[0]?.trim();
  if (topics.length === 0) topics.push(brand ? `products like ${brand}` : "this service");
  const rawAudience = p.audience?.trim().replace(/[.!?]+$/, "");
  const audience = rawAudience && rawAudience.length <= 60 && !/[.!?;\n]/.test(rawAudience) ? rawAudience : undefined;
  const local = looksLocal(p);
  const comps = p.competitors.map((c) => c.name.trim()).filter(Boolean).slice(0, 3);
  const [t0, t1, t2] = topics;

  const out: PromptCandidate[] = [];
  const add = (text: string | false | undefined, intent: PromptIntent, topic: string | null) => {
    if (text) out.push({ text, intent, topic, locale, source: "template" });
  };
  const best = (t: string) => (local ? `Best ${t} near me — which would you recommend?` : `Best ${t} in ${countryName} — which would you recommend?`);
  const choose = (t: string) => `How do I choose the right ${t}? What should I look for?`;
  const price = (t: string) => `What is the typical price of ${t} in ${countryName}?`;
  const forAudience = (t: string) => audience && `What's the best ${t} for ${audience}?`;

  add(best(t0), "commercial", t0);
  add(choose(t0), "informational", t0);
  add(forAudience(t0), "commercial", t0);
  add(local ? `Cheapest ${t0} near me with good reviews?` : price(t0), "transactional", t0);
  add(brand && comps[0] && `${brand} vs ${comps[0]}: which is better for ${t0}?`, "comparison", t0);
  add(comps[0] && `What are the best alternatives to ${comps[0]}?`, "comparison", t0);
  add(t1 && best(t1), "commercial", t1 ?? null);
  add(brand && `Is ${brand} good for ${t0}? Is it worth it?`, "navigational", t0);
  add(local ? `Which ${t0} near me has the best reviews?` : `Which ${t0} brands are most trusted in ${countryName}?`, "commercial", t0);
  add(brand && `What are the best alternatives to ${brand}?`, "comparison", t0);
  add(local && price(t0), "transactional", t0);
  add(t1 && choose(t1), "informational", t1 ?? null);
  add(brand && comps[1] && `${brand} vs ${comps[1]}: which is better for ${t0}?`, "comparison", t0);
  add(comps[1] && `What are the best alternatives to ${comps[1]}?`, "comparison", t0);
  add(t1 && forAudience(t1), "commercial", t1 ?? null);
  add(`What mistakes should I avoid when buying ${t0}?`, "informational", t0);
  add(t2 && best(t2), "commercial", t2 ?? null);
  add(brand && `${brand} reviews: what do customers say?`, "navigational", null);
  add(comps[0] && comps[1] && `${comps[0]} vs ${comps[1]} for ${t0}: which should I pick?`, "comparison", t0);
  add(brand && comps[2] && `${brand} vs ${comps[2]}: which is better for ${t0}?`, "comparison", t0);
  add(t1 && (local ? `Cheapest ${t1} near me with good reviews?` : price(t1)), "transactional", t1 ?? null);
  add(`Is it worth paying more for premium ${t0}?`, "informational", t0);
  add(t2 && choose(t2), "informational", t2 ?? null);
  for (const t of topics.slice(3, 8)) {
    add(best(t), "commercial", t);
    add(choose(t), "informational", t);
  }
  return dedupePrompts(out).slice(0, max);
}

const llmSchema = z.object({
  prompts: z
    .array(
      z.object({
        text: z.string().min(8).max(300),
        intent: z.enum(PROMPT_INTENTS),
        topic: z.string().max(80).nullable(),
      }),
    )
    .max(40),
});

export async function researchPrompts(
  profile: ResearchProfile,
  opts: { max?: number; existing?: string[] } = {},
): Promise<{ candidates: PromptCandidate[]; source: "llm" | "template"; costMicros: number }> {
  const max = opts.max ?? DEFAULT_PROMPT_COUNT;
  const country = profile.countries[0] ?? "IN";
  const locale = localeFor(profile.languages[0] ?? "en", country);
  if (isLlmConfigured()) {
    const res = await generateStructured({
      schema: llmSchema,
      system:
        "You generate realistic questions that potential buyers type into AI assistants (ChatGPT, Gemini, Perplexity) " +
        "when researching a purchase in this business's category and country. Write them the way a real person would ask, " +
        "short and natural, using the category words buyers use (not marketing copy). Mix intents: commercial ('best X in " +
        "<country>', 'X for <audience>'), informational ('how to choose X', 'what to look for in X'), comparison ('<brand> vs " +
        "<competitor>', 'alternatives to <competitor>', '<brand> alternatives'), transactional (price/cost; 'cheapest X near me' " +
        "only if the business is local), navigational ('is <brand> good / legit'). At least two thirds must NOT name the brand, " +
        "so they measure organic visibility. No duplicates or near-duplicates. Write in the requested language.",
      user: JSON.stringify({
        brand: profile.brandNames[0],
        categories: profile.categories,
        audience: profile.audience ?? null,
        country,
        language: profile.languages[0] ?? "en",
        competitors: profile.competitors.map((c) => c.name),
        local: looksLocal(profile),
        keywords: profile.keywords.slice(0, 30),
        count: Math.min(40, max + 10),
      }),
      maxTokens: 2500,
    });
    if (res) {
      const cands: PromptCandidate[] = res.data.prompts.map((p) => ({ text: p.text.trim(), intent: p.intent, topic: p.topic, locale, source: "llm" }));
      return { candidates: dedupePrompts(cands, opts.existing).slice(0, max), source: "llm", costMicros: res.costMicros };
    }
  }
  return { candidates: dedupePrompts(templatePrompts(profile, 60), opts.existing).slice(0, max), source: "template", costMicros: 0 };
}
