// Setup screens 3 and 4: competitor suggestions and the customer questions, both from the confirmed facts.
// Competitors come from the LLM (budget-guarded inside generateStructured); with no AI configured the owner just
// adds their own. Questions reuse the prompt-research module (LLM, or deterministic templates as a fallback).
import { z } from "zod";
import { generateStructured, isLlmConfigured } from "@/lib/providers/llm";
import { researchPrompts, type PromptCandidate } from "@/lib/prompts/research";
import { countryLabel, projectFieldsFromFacts, type BusinessFacts } from "./facts";

export interface CompetitorSuggestion {
  name: string;
  domain?: string;
}

const competitorLlmSchema = z.object({
  competitors: z
    .array(z.object({ name: z.string().min(1).max(120), domain: z.string().max(253) }))
    .max(6),
});

const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

/** Normalises "https://www.x.com/path" → "x.com"; returns undefined when it isn't a plain domain. */
export function cleanDomain(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const d = raw.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0]?.toLowerCase() ?? "";
  return DOMAIN_RE.test(d) && d.length <= 253 ? d : undefined;
}

/** Drops the owner's own site/name and duplicates; keeps at most `max`. Pure. */
export function filterCompetitors(items: CompetitorSuggestion[], own: { name: string; host: string }, max = 3): CompetitorSuggestion[] {
  const ownHost = own.host.replace(/^www\./i, "").toLowerCase();
  const ownName = own.name.trim().toLowerCase();
  const seen = new Set<string>();
  const out: CompetitorSuggestion[] = [];
  for (const c of items) {
    const name = c.name.trim().slice(0, 120);
    const domain = cleanDomain(c.domain);
    if (!name || name.toLowerCase() === ownName || (domain && ownHost && domain === ownHost)) continue;
    const key = (domain ?? name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(domain ? { name, domain } : { name });
    if (out.length >= max) break;
  }
  return out;
}

export async function suggestCompetitors(facts: BusinessFacts, host: string): Promise<{ items: CompetitorSuggestion[]; source: "ai" | "none" }> {
  if (!isLlmConfigured()) return { items: [], source: "none" };
  const res = await generateStructured({
    schema: competitorLlmSchema,
    system:
      "You name real businesses that compete with a small business for the same customers. Prefer direct local " +
      "competitors in the same city when a city is given, otherwise well-known competitors in the same country. Only " +
      "name businesses you are confident exist; give their main website domain (or '' if unsure). Never include the " +
      "business itself. Return 5 so the best 3 can be kept.",
    user: JSON.stringify({
      business: facts.name,
      website: host,
      sells: facts.sells,
      customers: facts.customers,
      city: facts.city,
      country: countryLabel(facts.country),
    }),
    maxTokens: 500,
  }).catch(() => null);
  if (!res) return { items: [], source: "none" };
  return { items: filterCompetitors(res.data.competitors, { name: facts.name, host }), source: "ai" };
}

export async function suggestQuestions(
  facts: BusinessFacts,
  competitors: { name: string }[],
  count: number,
): Promise<{ items: PromptCandidate[]; source: "llm" | "template" }> {
  const p = projectFieldsFromFacts(facts);
  const { candidates, source } = await researchPrompts(
    {
      brandNames: p.brandNames,
      categories: p.categories,
      audience: p.audience ?? null,
      countries: p.countries,
      languages: p.languages,
      competitors,
      keywords: [],
    },
    { max: count },
  );
  return { items: candidates.slice(0, count), source };
}
