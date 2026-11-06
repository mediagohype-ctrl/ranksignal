// Setup screen 3: SEO keywords — the words people type into Google to find this business. Some come pre-ticked
// (the most important ones), the rest are extra ideas the owner can tick. The LLM writes them when available
// (budget-guarded inside generateStructured); otherwise they are built from "what you sell" and the city.
import { z } from "zod";
import { generateStructured, isLlmConfigured } from "@/lib/providers/llm";
import { isLocalBusiness, topicPhrases } from "@/lib/prompts/research";
import { countryLabel, type BusinessFacts } from "./facts";

export interface KeywordSuggestions {
  /** Pre-ticked: the keywords this business should clearly rank for. */
  picked: string[];
  /** Extra ideas, shown unticked. */
  more: string[];
}

export const PICKED_KEYWORDS = 8;
export const MORE_KEYWORDS = 12;
/** Most keywords a project can save from setup. */
export const MAX_SETUP_KEYWORDS = 40;

const llmSchema = z.object({
  primary: z.array(z.string().min(2).max(80)).max(15),
  more: z.array(z.string().min(2).max(80)).max(25),
});

/** Lower-case, trimmed, 2–80 chars, at most 7 words, no brand name, deduped; keeps order. */
export function cleanKeywords(list: string[], brand: string, exclude: string[] = []): string[] {
  const brandLc = brand.trim().toLowerCase();
  const seen = new Set(exclude.map((k) => k.toLowerCase()));
  const out: string[] = [];
  for (const raw of list) {
    const k = raw.toLowerCase().replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
    if (k.length < 2 || k.length > 80 || k.split(" ").length > 7) continue;
    if (brandLc.length >= 3 && k.includes(brandLc)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/** Keyword ideas from the facts alone (no AI). Pure. */
export function templateKeywords(facts: BusinessFacts): KeywordSuggestions {
  const topics = topicPhrases(facts.sells);
  const city = facts.city.trim().toLowerCase();
  const country = countryLabel(facts.country).toLowerCase();
  const local = isLocalBusiness({ categories: [facts.sells], keywords: [], city });
  const all: string[] = [];
  // Most important first: each topic as people search it, then buyer-intent variants.
  for (const t of topics.slice(0, 6)) {
    all.push(t);
    all.push(local ? (city ? `${t} in ${city}` : `${t} near me`) : `best ${t}`);
  }
  for (const t of topics.slice(0, 6)) {
    if (local) all.push(`${t} near me`, `best ${t}${city ? ` in ${city}` : ""}`, `affordable ${t}`);
    else all.push(`${t} online`, `${t} in ${country}`, `free ${t}`);
  }
  const clean = cleanKeywords(all, facts.name);
  return { picked: clean.slice(0, PICKED_KEYWORDS), more: clean.slice(PICKED_KEYWORDS, PICKED_KEYWORDS + MORE_KEYWORDS) };
}

export async function suggestKeywords(facts: BusinessFacts, host: string): Promise<KeywordSuggestions & { source: "ai" | "template" }> {
  if (isLlmConfigured() && facts.sells.trim()) {
    const res = await generateStructured({
      schema: llmSchema,
      system:
        "You are an SEO specialist for small businesses. List the search keywords people type into Google to find a " +
        "business like this one. 'primary' = the 8 most important keywords it must rank for (its main products or " +
        "services, with the city for local businesses). 'more' = 12 extra ideas: specific services, long-tail and " +
        "buyer-intent searches. Rules: lower case, 2–6 words each, no brand or business names, nothing negative, no " +
        "duplicates, in the site's language.",
      user: JSON.stringify({
        website: host,
        sells: facts.sells,
        customers: facts.customers,
        city: facts.city,
        country: countryLabel(facts.country),
        language: facts.language,
      }),
      maxTokens: 600,
    }).catch(() => null);
    if (res) {
      const picked = cleanKeywords(res.data.primary, facts.name).slice(0, PICKED_KEYWORDS);
      const more = cleanKeywords(res.data.more, facts.name, picked).slice(0, MORE_KEYWORDS);
      if (picked.length >= 3) return { picked, more, source: "ai" };
    }
  }
  return { ...templateKeywords(facts), source: "template" };
}
