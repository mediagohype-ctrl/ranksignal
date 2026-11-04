// Setup screen 2 ("Is this right?"): read the owner's homepage and guess the business facts so they only have to
// check them. Fetches through the SSRF-safe crawler fetcher, extracts deterministic signals (title, meta, main
// heading, og:site_name, JSON-LD Organization/LocalBusiness, html lang, visible text), then — when an AI provider
// is configured and the daily AI budget allows — asks the LLM to summarise them. Every failure degrades to the
// heuristic guess (or empty fields), never an error the owner can't get past.
import { z } from "zod";
import { safeFetch, SafeFetchError } from "@/lib/crawler/safe-fetch";
import { generateStructured, isLlmConfigured } from "@/lib/providers/llm";
import { countryCode, emptyFacts, languageCode, nameFromHost, type BusinessFacts } from "./facts";
import { extractSiteSignals, heuristicFacts, tldCountry, type SiteSignals } from "./signals";

export { extractSiteSignals, heuristicFacts, type SiteSignals };

export type UnderstandSource = "ai" | "website" | "none";

export interface UnderstandResult {
  facts: BusinessFacts;
  /** "ai" = LLM summary, "website" = read from the page without AI, "none" = couldn't read the site. */
  source: UnderstandSource;
  /** URL after redirects (use it as the project website when it differs only by scheme/www). */
  finalUrl: string;
  /** Plain-words reason when the site couldn't be read (shown above the empty fields). */
  problem?: string;
}

const llmSchema = z.object({
  name: z.string().max(120),
  sells: z.string().max(200),
  customers: z.string().max(200),
  city: z.string().max(80),
  country: z.string().max(60),
  language: z.string().max(20),
});

function fetchProblem(e: unknown): string {
  if (e instanceof SafeFetchError) {
    if (e.code === "dns_failed") return "We couldn't find that website. Check the address, or fill in the details below.";
    if (e.code === "timeout") return "Your website took too long to answer. Fill in the details below, or try again.";
    if (e.code === "blocked" || e.code === "invalid_url") return "We can't open that address. Check it, or fill in the details below.";
  }
  return "We couldn't read your website just now. Fill in the details below, or try again.";
}

async function aiFacts(signals: SiteSignals, guess: BusinessFacts): Promise<BusinessFacts | null> {
  if (!isLlmConfigured()) return null;
  const res = await generateStructured({
    schema: llmSchema,
    system:
      "You read a small business's homepage and describe it for its owner in very plain, short English (or the site's " +
      "language). Return: name = the business name customers use (not a slogan, no 'Home' or page words); sells = what " +
      "they sell or do, under 12 words; customers = who buys from them, under 12 words; city = the city they are based in " +
      "or serve, '' if unknown; country = ISO 3166-1 alpha-2 code ('' if unknown); language = ISO 639-1 code of the site. " +
      "Use the guesses only when the page supports them. Never invent an address.",
    user: JSON.stringify({ page: signals, guesses: guess }),
    maxTokens: 400,
  }).catch(() => null);
  if (!res) return null;
  const d = res.data;
  const pick = (v: string, fallback: string) => (v.trim() ? v.trim() : fallback);
  return {
    name: pick(d.name, guess.name).slice(0, 120),
    sells: pick(d.sells, guess.sells).slice(0, 300),
    customers: pick(d.customers, guess.customers).slice(0, 300),
    city: pick(d.city, guess.city).slice(0, 120),
    country: countryCode(d.country) ?? guess.country,
    language: languageCode(d.language) ?? guess.language,
  };
}

/** Never throws for site problems: returns empty/heuristic facts plus a `problem` message instead. */
export async function understandWebsite(websiteUrl: string): Promise<UnderstandResult> {
  let host = "";
  try {
    host = new URL(websiteUrl).hostname;
  } catch {
    return { facts: emptyFacts(), source: "none", finalUrl: websiteUrl, problem: "That doesn't look like a website address." };
  }
  const fallback: BusinessFacts = { ...emptyFacts(nameFromHost(host)), country: tldCountry(host) ?? "IN" };
  let html = "";
  let finalUrl = websiteUrl;
  try {
    const res = await safeFetch(websiteUrl, { timeoutMs: 12_000, maxBytes: 3 * 1024 * 1024, maxRedirects: 5 });
    finalUrl = res.finalUrl;
    if (res.status >= 400 || !res.body) {
      return { facts: fallback, source: "none", finalUrl, problem: "Your homepage didn't open for us. Fill in the details below, or try again." };
    }
    html = res.body;
  } catch (e) {
    return { facts: fallback, source: "none", finalUrl, problem: fetchProblem(e) };
  }
  const signals = extractSiteSignals(html, finalUrl);
  const guess = heuristicFacts(signals);
  const ai = await aiFacts(signals, guess);
  return ai ? { facts: ai, source: "ai", finalUrl } : { facts: guess, source: "website", finalUrl };
}

