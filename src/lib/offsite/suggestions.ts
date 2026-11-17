// Off-site suggestions (pure). From the third-party websites AI answers already link to for this project, list the
// ones worth considering — real listing sites and other websites — and keep competitors OUT of that list (a
// competitor is never a place to "get listed on"; they are returned separately as competitor suggestions).
// Honest framing: these are places worth considering, not a guarantee that a listing will be cited.
import { STARTER_LISTINGS, type OffsiteType, type StarterListing } from "./types";
import { adviceFor, classifyCitedSite, listingSiteFor, normalizeDomain, sameSite, type CitedPage, type ClassifyContext } from "./classify";
import { starterListingsFor, type BusinessKind } from "./starter";

export { normalizeDomain } from "./classify";

export interface CitedDomain {
  domain: string;
  count: number;
  owned: boolean;
  /** The exact pages that were linked, when known (tells a business's home page from a list or article). */
  pages?: CitedPage[];
}

export interface AiCitationSuggestion {
  domain: string;
  /** How many sampled answers cited this domain in the latest real check. */
  count: number;
  type: OffsiteType;
  name: string;
  url: string;
  /** "listing" = a real directory / marketplace / review / social / Q&A / news site; "website" = anything else. */
  kind: "listing" | "website";
  /** One honest line on what to do with it. */
  advice: string;
}

/** A business AI names or links for this project's questions — a competitor, never a place to be listed. */
export interface CompetitorSiteSuggestion {
  domain: string;
  name: string;
  /** How many answers linked to their website. */
  count: number;
  reason: "named" | "same_trade";
}

export interface StarterSuggestion extends StarterListing {
  tracked: boolean;
}

/** Kept for callers that only need a type and a name for a domain. Unknown domains are "other". */
export function classifyDomain(domain: string): { type: OffsiteType; name: string } {
  const hit = listingSiteFor(domain);
  return hit ? { type: hit.type, name: hit.name } : { type: "other", name: domain };
}

export interface SuggestionContext extends Pick<ClassifyContext, "namedBrands" | "answerTexts" | "tradeWords"> {
  /** The client's own website(s). */
  ownedDomains: string[];
  /** Competitor domains (their own sites aren't places the client can be listed). */
  competitorDomains: string[];
  /** Saved competitors with names, when known (a name that matches a domain also marks it as a competitor). */
  competitors?: ClassifyContext["competitors"];
  /** Tracker rows already present (by url and name). */
  tracked: { url: string | null; name: string }[];
}

function trackedDomains(tracked: SuggestionContext["tracked"]): { domains: string[]; names: Set<string> } {
  const domains: string[] = [];
  const names = new Set<string>();
  for (const t of tracked) {
    const d = normalizeDomain(t.url);
    if (d) domains.push(d);
    names.add(t.name.trim().toLowerCase());
  }
  return { domains, names };
}

function classifyCtx(ctx: SuggestionContext): ClassifyContext {
  return {
    ownedDomains: ctx.ownedDomains,
    competitors: [...(ctx.competitors ?? []), ...ctx.competitorDomains.map((domain) => ({ domain }))],
    namedBrands: ctx.namedBrands,
    answerTexts: ctx.answerTexts,
    tradeWords: ctx.tradeWords,
  };
}

/** Splits the websites AI links to into places to consider (listing sites, other websites) and competitors. */
export function splitCitations(
  sources: CitedDomain[] | null | undefined,
  ctx: SuggestionContext,
  limit = 15,
): { places: AiCitationSuggestion[]; competitors: CompetitorSiteSuggestion[] } {
  const places: AiCitationSuggestion[] = [];
  const competitors: CompetitorSiteSuggestion[] = [];
  if (!Array.isArray(sources)) return { places, competitors };
  const cctx = classifyCtx(ctx);
  const { domains: trackedD, names: trackedN } = trackedDomains(ctx.tracked);
  const seen = new Set<string>();
  for (const s of sources) {
    if (!s || typeof s.domain !== "string" || s.owned) continue;
    const d = normalizeDomain(s.domain);
    if (!d || seen.has(d)) continue;
    const site = classifyCitedSite(d, cctx, s.pages ?? []);
    if (site.kind === "own" || site.kind === "ignore") continue;
    seen.add(d);
    const count = typeof s.count === "number" ? s.count : 0;
    if (site.kind === "competitor") {
      // Saved competitors are already on the owner's list; only new ones are worth suggesting.
      if (site.reason !== "saved") competitors.push({ domain: d, name: site.name, count, reason: site.reason ?? "same_trade" });
      continue;
    }
    if (trackedD.some((t) => sameSite(d, t)) || trackedN.has(site.name.toLowerCase()) || trackedN.has(d)) continue;
    if (places.length >= limit) continue;
    const page = site.kind === "website" ? s.pages?.find((p) => p.url)?.url : null;
    places.push({ domain: d, count, type: site.type, name: site.name, url: page || `https://${d}/`, kind: site.kind, advice: adviceFor(site) });
  }
  // Businesses the AI named come before look-alikes; then the most-linked first.
  competitors.sort((a, b) => Number(b.reason === "named") - Number(a.reason === "named") || b.count - a.count);
  return { places, competitors };
}

/** Third-party websites AI links to that aren't on the tracker yet — never the business's own site or a competitor's. */
export function suggestFromCitations(sources: CitedDomain[] | null | undefined, ctx: SuggestionContext, limit = 15): AiCitationSuggestion[] {
  return splitCitations(sources, ctx, limit).places;
}

/**
 * The starter list, marking entries the tracker already has. With a business kind it is that kind's short list
 * (an agency isn't offered software review sites); without one it is the whole catalogue.
 */
export function starterSuggestions(tracked: SuggestionContext["tracked"], kind?: BusinessKind): StarterSuggestion[] {
  const { domains, names } = trackedDomains(tracked);
  return (kind ? starterListingsFor(kind) : STARTER_LISTINGS).map((s) => ({
    ...s,
    tracked: names.has(s.name.toLowerCase()) || domains.some((d) => sameSite(d, s.domain)),
  }));
}
