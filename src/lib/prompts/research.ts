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
  /** City the business serves, used in local questions ("in Pune"). */
  city?: string | null;
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
 * Splits "what you sell" into short search topics, lower case:
 *   "Free notes for React, Next.js and Java, plus UI templates" → ["notes for react", "ui templates"]
 *   "Sweets, cakes and snacks" → ["sweets", "cakes", "snacks"]
 * Single words that are only items of a longer phrase's list (Next.js, Java) are dropped.
 */
export function topicPhrases(text: string): string[] {
  const parts: string[] = [];
  for (const raw of text.split(/[,;|•/]|\s+(?:and|plus|&|or)\s+/i)) {
    const t = raw
      .replace(/^(?:\s*(?:free|the|a|an|our|best|top|in-depth|high[- ]quality|premium)\b[\s,-]*)+/i, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (t.length >= 3 && t.split(" ").length <= 6) parts.push(t);
  }
  const multi = parts.filter((t) => t.includes(" "));
  const out = multi.length ? multi : parts;
  if (out.length === 0 && text.trim()) out.push(text.trim().toLowerCase().split(/\s+/).slice(0, 5).join(" "));
  return [...new Set(out)];
}

/** Things sold online, where a city makes no sense in searches ("python notes in Pune"). */
const ONLINE_HINTS = /\b(online|software|saas|apps?|templates?|notes|courses?|tutorials?|digital|e-?books?|plugins?|themes?|api|tools?|downloads?|programming|coding)\b/i;

/** Local business: a shop/clinic/trade by its category, or any business with a city that doesn't sell online. */
export function isLocalBusiness(p: Pick<ResearchProfile, "categories" | "keywords" | "local" | "city">): boolean {
  if (typeof p.local === "boolean") return p.local;
  if (looksLocal(p)) return true;
  return !!p.city?.trim() && !ONLINE_HINTS.test([...p.categories, ...p.keywords].join(" "));
}

/** Questions we never ask: they name a business, compare, or start from a negative angle. */
const NEGATIVE = /\b(worth it|alternatives?|vs\.?|versus|scams?|legit|complain\w*|problems?|mistakes?|avoid|cheapest|worst|bad|fake|fraud|reviews?)\b/i;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Keeps only neutral, on-topic discovery questions: no brand or competitor names (so the answer shows whether AI
 * recommends you on its own) and no negative or comparison framing.
 */
export function keepDiscoveryQuestions<T extends { text: string }>(items: T[], names: string[]): T[] {
  const nameRes = names
    .map((n) => n.trim())
    .filter((n) => n.length >= 3)
    .map((n) => new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(n)}($|[^\\p{L}\\p{N}])`, "iu"));
  return items.filter((q) => !NEGATIVE.test(q.text) && !nameRes.some((re) => re.test(q.text)));
}

/**
 * Deterministic customer questions (used when no LLM is available). Neutral discovery questions people ask AI when
 * looking for this kind of business — never naming the brand or competitors, never negative. Topics come from
 * the SEO keywords first, then short phrases of "what you sell".
 */
export function templatePrompts(p: ResearchProfile, max = DEFAULT_PROMPT_COUNT): PromptCandidate[] {
  const country = p.countries[0] ?? "IN";
  const countryName = COUNTRY_NAMES[country] ?? country;
  const locale = localeFor(p.languages[0] ?? "en", country);
  const topics = [
    ...new Set(
      [...p.keywords, ...p.categories.flatMap((c) => topicPhrases(c))]
        .map((t) => t.toLowerCase().replace(/^best\s+/, "").replace(/\s+(?:near me|online|in [\p{L} .-]+)$/iu, "").trim())
        .filter((t) => t.length >= 3 && t.split(/\s+/).length <= 7),
    ),
  ];
  if (topics.length === 0) topics.push("this kind of service");
  const rawAudience = p.audience?.trim().replace(/[.!?]+$/, "");
  const audience = rawAudience && rawAudience.length <= 60 && !/[.!?;\n]/.test(rawAudience) ? rawAudience : undefined;
  const city = p.city?.trim();
  const local = isLocalBusiness(p);
  const where = local ? (city ? `in ${city}` : "near me") : `in ${countryName}`;

  const patterns: [(t: string) => string | undefined, PromptIntent][] = [
    [(t) => `What are the best ${t} ${where}?`, "commercial"],
    [(t) => `What should I look for when choosing ${t}?`, "informational"],
    [(t) => `Where can I find good ${t} ${where}?`, "commercial"],
    [(t) => audience && `Which ${t} would you recommend for ${audience}?`, "commercial"],
    [(t) => (local ? `Who offers the best ${t} ${where}?` : `Which ${t} do people recommend most?`), "commercial"],
    [(t) => `What is the usual price of ${t} ${where}?`, "transactional"],
    [(t) => `Can you suggest good ${t} ${local ? where : "for beginners"}?`, "commercial"],
    [(t) => `How do I pick the right ${t}?`, "informational"],
  ];

  const out: PromptCandidate[] = [];
  const used = topics.slice(0, 6);
  // Each round gives every topic a different pattern, so the first N questions cover many topics and intents.
  for (let round = 0; round < patterns.length; round++) {
    used.forEach((t, j) => {
      const [make, intent] = patterns[(round + j) % patterns.length]!;
      const text = make(t);
      if (text) out.push({ text, intent, topic: t, locale, source: "template" });
    });
  }
  return keepDiscoveryQuestions(dedupePrompts(out), [...p.brandNames, ...p.competitors.map((c) => c.name)]).slice(0, max);
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
  const names = [...profile.brandNames, ...profile.competitors.map((c) => c.name)];
  if (isLlmConfigured()) {
    const res = await generateStructured({
      schema: llmSchema,
      system:
        "You write the questions real customers type into AI assistants (ChatGPT, Gemini, Claude, Perplexity, Grok) when " +
        "they are looking for this kind of business. Rules: (1) NEVER mention the business's name or any competitor's " +
        "name — the point is to see whether AI recommends the business on its own. (2) Stay strictly inside what the " +
        "business sells; use the keywords and plain category words buyers use, never its marketing copy or slogans. " +
        "(3) Keep every question positive or neutral — no 'is it worth it', 'alternatives to', 'vs', 'scam', 'mistakes to " +
        "avoid', 'cheapest' or complaint-style questions. (4) Short and natural, like a real person typing (under 18 " +
        "words). Mix: finding the best option ('best X in <city/country>', 'X for <audience>'), choosing ('how to choose X', " +
        "'what to look for in X'), and cost ('how much does X cost'). Use the city for local businesses. (5) No duplicates " +
        "or near-duplicates. Write in the requested language.",
      user: JSON.stringify({
        brand: profile.brandNames[0],
        categories: profile.categories,
        audience: profile.audience ?? null,
        country,
        language: profile.languages[0] ?? "en",
        city: profile.city ?? null,
        local: looksLocal(profile),
        keywords: profile.keywords.slice(0, 30),
        count: Math.min(40, max + 10),
      }),
      maxTokens: 2500,
    });
    if (res) {
      const cands: PromptCandidate[] = res.data.prompts.map((p) => ({ text: p.text.trim(), intent: p.intent, topic: p.topic, locale, source: "llm" }));
      const clean = keepDiscoveryQuestions(dedupePrompts(cands, opts.existing), names);
      // Too few survived the filter: top up from the templates rather than show a short list.
      const topUp = clean.length >= max ? [] : dedupePrompts(templatePrompts(profile, 60), [...(opts.existing ?? []), ...clean.map((c) => c.text)]);
      return { candidates: [...clean, ...topUp].slice(0, max), source: "llm", costMicros: res.costMicros };
    }
  }
  return { candidates: dedupePrompts(templatePrompts(profile, 60), opts.existing).slice(0, max), source: "template", costMicros: 0 };
}
