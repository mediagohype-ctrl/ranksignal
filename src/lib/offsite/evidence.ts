// What the latest REAL AI check linked to and said, for one project (server-only; every query is tenant-scoped).
// Feeds both "Your listings" suggestions and competitor suggestions, so the two always agree on who is a competitor.
import { db } from "@/lib/db";
import type { VisibilityMetrics } from "@/lib/types";
import { normalizeDomain, tradeWordsOf, type CitedPage, type ClassifyContext } from "./classify";
import type { CitedDomain, SuggestionContext } from "./suggestions";

const VIS_DONE = ["succeeded", "succeeded_with_warnings"];
const MAX_PAGES_PER_DOMAIN = 5;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : []);

export interface AnswerEvidence {
  /** When the check finished, or null when there is no real (non-simulated) check yet. */
  measuredAt: string | null;
  sources: CitedDomain[];
  answerTexts: string[];
  /** Names the AI answers mentioned besides the business (today: the saved competitors it named). */
  namedBrands: string[];
}

export const NO_EVIDENCE: AnswerEvidence = { measuredAt: null, sources: [], answerTexts: [], namedBrands: [] };

export async function loadAnswerEvidence(organizationId: string, projectId: string): Promise<AnswerEvidence> {
  const runs = await db.visibilityRun.findMany({
    where: { organizationId, projectId, status: { in: VIS_DONE } },
    orderBy: { createdAt: "desc" },
    select: { id: true, metrics: true, finishedAt: true, createdAt: true },
    take: 10,
  });
  // Latest REAL run: skip simulated metrics so we never suggest from made-up answers.
  const real = (runs ?? []).find((r) => isObj(r.metrics) && r.metrics.simulated !== true);
  if (!real) return NO_EVIDENCE;
  const metrics = real.metrics as unknown as VisibilityMetrics;

  // The answers themselves give us the exact pages linked and the names mentioned. Optional: without them we
  // still have the per-domain counts from the run's metrics.
  let obs: { citations: unknown; competitorMentions: unknown; rawResponse: string | null }[] = [];
  try {
    obs =
      (await db.observation.findMany({
        where: { organizationId, visibilityRunId: real.id, simulated: false },
        select: { citations: true, competitorMentions: true, rawResponse: true },
        take: 500,
      })) ?? [];
  } catch {
    obs = [];
  }

  const pages = new Map<string, CitedPage[]>();
  const answersCiting = new Map<string, number>();
  const named = new Set<string>();
  const answerTexts: string[] = [];
  for (const o of obs) {
    if (typeof o.rawResponse === "string" && o.rawResponse) answerTexts.push(o.rawResponse);
    if (isObj(o.competitorMentions)) {
      for (const [name, n] of Object.entries(o.competitorMentions)) if (name !== "__brand__" && typeof n === "number" && n > 0) named.add(name);
    }
    const seen = new Set<string>();
    for (const c of Array.isArray(o.citations) ? o.citations : []) {
      if (!isObj(c) || c.ownedByCustomer === true) continue;
      const url = typeof c.url === "string" ? c.url : null;
      const d = normalizeDomain(typeof c.domain === "string" && c.domain ? c.domain : url);
      if (!d) continue;
      const list = pages.get(d) ?? [];
      if (list.length < MAX_PAGES_PER_DOMAIN && url) list.push({ url, title: typeof c.title === "string" ? c.title : null });
      pages.set(d, list);
      if (!seen.has(d)) {
        seen.add(d);
        answersCiting.set(d, (answersCiting.get(d) ?? 0) + 1);
      }
    }
  }

  const fromMetrics: CitedDomain[] = Array.isArray(metrics?.citationSources) ? metrics.citationSources : [];
  const sources: CitedDomain[] = fromMetrics.length
    ? fromMetrics.map((s) => ({ ...s, pages: pages.get(normalizeDomain(s.domain) ?? "") ?? [] }))
    : [...answersCiting.entries()].sort((a, b) => b[1] - a[1]).map(([domain, count]) => ({ domain, count, owned: false, pages: pages.get(domain) ?? [] }));

  return { measuredAt: (real.finishedAt ?? real.createdAt).toISOString(), sources, answerTexts, namedBrands: [...named] };
}

export interface ProjectForSuggestions {
  websiteUrl: string | null;
  competitors: unknown;
  categories?: unknown;
  keywords?: unknown;
}

export function savedCompetitors(raw: unknown): NonNullable<ClassifyContext["competitors"]> {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isObj).map((c) => ({
    name: typeof c.name === "string" ? c.name : null,
    domain: typeof c.domain === "string" ? c.domain : null,
    aliases: strings(c.aliases),
  }));
}

/** Everything the classifier needs to tell listing sites, competitors and other websites apart for a project. */
export function suggestionContext(project: ProjectForSuggestions, evidence: AnswerEvidence, tracked: SuggestionContext["tracked"] = []): SuggestionContext {
  const competitors = savedCompetitors(project.competitors);
  return {
    ownedDomains: [normalizeDomain(project.websiteUrl)].filter((d): d is string => !!d),
    competitorDomains: competitors.map((c) => c.domain).filter((d): d is string => !!d),
    competitors,
    namedBrands: evidence.namedBrands,
    answerTexts: evidence.answerTexts,
    tradeWords: tradeWordsOf([...strings(project.categories), ...strings(project.keywords)]),
    tracked,
  };
}
