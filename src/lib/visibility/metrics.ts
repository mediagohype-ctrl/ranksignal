// Visibility metrics (blueprint §9). Pure + deterministic. Definitions:
// - sampleSize: observations attempted in the window (successful + failed).
// - collected: successfully collected answers — the denominator for every rate below.
// - mentionRate / citationRate / recommendationRate: share of collected answers where the brand was
//   mentioned / an owned domain was cited / the brand was recommended (see RECOMMENDATION_RULE).
// - competitorShare: for each entity (brand + competitors), answers mentioning it ÷ the sum of those
//   per-entity answer-mention counts (presence per answer, so verbose repetition doesn't inflate share).
// - citationSources: cited domains, counted once per answer, sorted by count desc.
// - visibilityIndex (FORMULA_VERSION "vi-1"): 100 × (0.45·mentionRate + 0.35·citationRate + 0.20·recommendationRate).
// These are observed measurements of sampled answers, not causal claims or ranking guarantees.
import type { Citation, VisibilityMetrics } from "@/lib/types";

export const FORMULA_VERSION = "vi-1";
export const INDEX_WEIGHTS = { mention: 0.45, citation: 0.35, recommendation: 0.2 } as const;
export const BRAND_KEY = "__brand__";

export interface MetricObservation {
  provider: string;
  brandMentioned: boolean;
  brandCited: boolean;
  brandRecommended: boolean;
  competitorMentions?: Record<string, number> | null;
  citations?: Citation[] | null;
  simulated: boolean;
  /** false when the call failed (no answer); defaults to true. */
  ok?: boolean;
  createdAt?: Date | string;
}

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const rate = (n: number, d: number) => (d > 0 ? round(n / d) : 0);

export function computeMetrics(
  observations: MetricObservation[],
  opts: { from: Date; to: Date; brandLabel?: string },
): VisibilityMetrics {
  const inWindow = observations.filter((o) => {
    if (!o.createdAt) return true;
    const t = new Date(o.createdAt).getTime();
    return t >= opts.from.getTime() && t <= opts.to.getTime();
  });
  const ok = inWindow.filter((o) => o.ok !== false);
  const collected = ok.length;

  const mentioned = ok.filter((o) => o.brandMentioned).length;
  const cited = ok.filter((o) => o.brandCited).length;
  const recommended = ok.filter((o) => o.brandRecommended).length;
  const mentionRate = rate(mentioned, collected);
  const citationRate = rate(cited, collected);
  const recommendationRate = rate(recommended, collected);

  const brandKey = opts.brandLabel ?? BRAND_KEY;
  const entityCounts: Record<string, number> = {};
  if (mentioned > 0) entityCounts[brandKey] = mentioned;
  for (const o of ok) {
    for (const [name, n] of Object.entries(o.competitorMentions ?? {})) {
      if (n > 0) entityCounts[name] = (entityCounts[name] ?? 0) + 1;
    }
  }
  const totalMentions = Object.values(entityCounts).reduce((a, b) => a + b, 0);
  const competitorShare: Record<string, number> = {};
  for (const [name, n] of Object.entries(entityCounts)) competitorShare[name] = rate(n, totalMentions);

  const sources = new Map<string, { count: number; owned: boolean }>();
  for (const o of ok) {
    const domains = new Map<string, boolean>();
    for (const c of o.citations ?? []) if (c?.domain) domains.set(c.domain, domains.get(c.domain) || c.ownedByCustomer);
    for (const [domain, owned] of domains) {
      const cur = sources.get(domain) ?? { count: 0, owned: false };
      sources.set(domain, { count: cur.count + 1, owned: cur.owned || owned });
    }
  }
  const citationSources = [...sources.entries()]
    .map(([domain, v]) => ({ domain, count: v.count, owned: v.owned }))
    .sort((a, b) => b.count - a.count || a.domain.localeCompare(b.domain));

  const byProvider: VisibilityMetrics["byProvider"] = {};
  for (const p of new Set(inWindow.map((o) => o.provider))) {
    const po = ok.filter((o) => o.provider === p);
    byProvider[p] = {
      collected: po.length,
      mentionRate: rate(po.filter((o) => o.brandMentioned).length, po.length),
      citationRate: rate(po.filter((o) => o.brandCited).length, po.length),
    };
  }

  const visibilityIndex =
    collected > 0
      ? Math.round(
          100 *
            (INDEX_WEIGHTS.mention * mentionRate +
              INDEX_WEIGHTS.citation * citationRate +
              INDEX_WEIGHTS.recommendation * recommendationRate) *
            10,
        ) / 10
      : 0;

  return {
    sampleSize: inWindow.length,
    collected,
    mentionRate,
    citationRate,
    recommendationRate,
    competitorShare,
    citationSources,
    byProvider,
    visibilityIndex,
    formulaVersion: FORMULA_VERSION,
    window: { from: opts.from.toISOString(), to: opts.to.toISOString() },
    simulated: inWindow.some((o) => o.simulated),
  };
}
