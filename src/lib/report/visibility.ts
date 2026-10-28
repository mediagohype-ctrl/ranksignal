// AI visibility summary for the report, from stored observations (pure).
// Real observations are preferred; simulated (demo) answers are only summarised — flagged — when no real
// answers exist, and are never used for scoring.
import type { Citation, VisibilityMetrics } from "@/lib/types";
import { BRAND_KEY, computeMetrics } from "@/lib/visibility/metrics";
import type { AiVisibilitySummary } from "@/lib/report/types";

export interface VisObservation {
  provider: string;
  platformLabel: string;
  promptText: string;
  brandMentioned: boolean;
  brandCited: boolean;
  brandRecommended: boolean;
  competitorMentions: Record<string, number> | null;
  citations: Citation[] | null;
  simulated: boolean;
  createdAt: Date | string;
}

export interface VisRun {
  metrics: unknown;
  finishedAt: Date | null;
}

export function emptyVisibility(): AiVisibilitySummary {
  return {
    measured: false,
    simulated: false,
    providers: [],
    sampleSize: 0,
    collected: 0,
    mentionRate: null,
    citationRate: null,
    recommendationRate: null,
    visibilityIndex: null,
    topCompetitors: [],
    brandShare: null,
    topCitedDomains: [],
    promptsWhereMissing: [],
    measuredAt: null,
  };
}

function parseBrandKnowledge(metrics: unknown): AiVisibilitySummary["brandKnowledge"] {
  const raw = (metrics as { brandKnowledge?: unknown } | null)?.brandKnowledge;
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .filter((b): b is Record<string, unknown> => !!b && typeof b === "object")
    .map((b) => ({
      provider: typeof b.provider === "string" ? b.provider : "unknown",
      knowsBrand: b.knowsBrand === true,
      summary: typeof b.summary === "string" ? b.summary.slice(0, 1000) : "",
      inaccuracies: Array.isArray(b.inaccuracies) ? b.inaccuracies.filter((x): x is string => typeof x === "string").slice(0, 10) : [],
    }));
  return out.length ? out : undefined;
}

const isMetrics = (m: unknown): m is VisibilityMetrics =>
  !!m && typeof m === "object" && typeof (m as VisibilityMetrics).mentionRate === "number" && typeof (m as VisibilityMetrics).collected === "number";

/**
 * @returns summary plus how many simulated observations were excluded because real ones exist.
 */
export function summarizeVisibility(
  run: VisRun | null,
  observations: VisObservation[],
  brandNames: string[],
): { summary: AiVisibilitySummary; excludedSimulated: number } {
  const base = emptyVisibility();
  if (!run) return { summary: base, excludedSimulated: 0 };
  const brandKnowledge = parseBrandKnowledge(run.metrics);
  if (observations.length === 0) return { summary: { ...base, brandKnowledge }, excludedSimulated: 0 };

  const real = observations.filter((o) => !o.simulated);
  const used = real.length ? real : observations;
  const excludedSimulated = observations.length - used.length;
  const brandLabel = brandNames[0];

  // Stored metrics include failed calls in sampleSize; recompute only when we had to drop simulated rows.
  const metrics: VisibilityMetrics =
    excludedSimulated === 0 && isMetrics(run.metrics)
      ? run.metrics
      : computeMetrics(
          used.map((o) => ({ ...o, competitorMentions: o.competitorMentions ?? {}, citations: o.citations ?? [] })),
          { from: new Date(0), to: new Date(8.64e15), brandLabel },
        );

  const brandKeys = new Set([BRAND_KEY, ...brandNames].map((b) => b.toLowerCase()));
  const shares = Object.entries(metrics.competitorShare ?? {});
  const brandShare = shares.filter(([k]) => brandKeys.has(k.toLowerCase())).reduce((a, [, v]) => a + v, 0);
  const topCompetitors = shares
    .filter(([k]) => !brandKeys.has(k.toLowerCase()))
    .map(([name, share]) => ({ name, share }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 5);

  const byPrompt = new Map<string, { mentioned: boolean; competitors: Set<string> }>();
  for (const o of used) {
    const g = byPrompt.get(o.promptText) ?? { mentioned: false, competitors: new Set<string>() };
    g.mentioned ||= o.brandMentioned;
    for (const [name, cnt] of Object.entries(o.competitorMentions ?? {})) if (cnt > 0 && !brandKeys.has(name.toLowerCase())) g.competitors.add(name);
    byPrompt.set(o.promptText, g);
  }
  const promptsWhereMissing = Array.from(byPrompt.entries())
    .filter(([, g]) => !g.mentioned)
    .map(([prompt, g]) => ({ prompt: prompt.slice(0, 300), competitorsMentioned: Array.from(g.competitors).slice(0, 8) }))
    .sort((a, b) => b.competitorsMentioned.length - a.competitorsMentioned.length)
    .slice(0, 10);

  const finished = run.finishedAt ?? used.map((o) => new Date(o.createdAt)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  return {
    excludedSimulated,
    summary: {
      measured: metrics.collected > 0,
      simulated: used.some((o) => o.simulated),
      providers: Array.from(new Set(used.map((o) => o.platformLabel))).sort(),
      sampleSize: metrics.collected,
      collected: metrics.collected,
      mentionRate: metrics.mentionRate,
      citationRate: metrics.citationRate,
      recommendationRate: metrics.recommendationRate,
      visibilityIndex: metrics.visibilityIndex,
      topCompetitors,
      brandShare: metrics.collected > 0 ? Math.round(brandShare * 10000) / 10000 : null,
      topCitedDomains: (metrics.citationSources ?? []).slice(0, 10),
      promptsWhereMissing,
      brandKnowledge,
      measuredAt: finished ? new Date(finished).toISOString() : null,
    },
  };
}
