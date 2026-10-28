// Pure comparison math for snapshots (no DB) — unit-tested in tests/snapshots.
import {
  SNAPSHOT_PILLARS, SNAPSHOT_SEVERITIES,
  type LikeForLike, type MetricDelta, type RateSample, type SnapshotDelta, type SnapshotSeverity, type SnapshotView,
} from "./types";

const SMALL_SAMPLE = 30;
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

export function metricDelta(before: number | null | undefined, after: number | null | undefined, rate = false): MetricDelta {
  const b = typeof before === "number" && Number.isFinite(before) ? before : null;
  const a = typeof after === "number" && Number.isFinite(after) ? after : null;
  const d = a !== null && b !== null ? a - b : null;
  return { before: b, after: a, delta: d === null ? null : rate ? round4(d) : Math.round(d * 10) / 10 };
}

export interface LikeForLikeObservation {
  promptId: string;
  brandMentioned: boolean;
  brandCited: boolean;
  brandRecommended: boolean;
}

function sample(rows: LikeForLikeObservation[]): RateSample {
  const n = rows.length;
  const r = (k: keyof Omit<LikeForLikeObservation, "promptId">) => (n ? round4(rows.filter((o) => o[k]).length / n) : 0);
  return { sampleSize: n, mentionRate: r("brandMentioned"), citationRate: r("brandCited"), recommendationRate: r("brandRecommended") };
}

/** Compare two runs on the prompts asked in both (by Observation.promptId). Null when no prompt overlaps. */
export function likeForLikeFromObservations(
  fromVisibilityRunId: string,
  toVisibilityRunId: string,
  beforeObs: LikeForLikeObservation[],
  afterObs: LikeForLikeObservation[],
): LikeForLike | null {
  const beforeIds = new Set(beforeObs.map((o) => o.promptId));
  const afterIds = new Set(afterObs.map((o) => o.promptId));
  const common = new Set([...beforeIds].filter((id) => afterIds.has(id)));
  if (common.size === 0) return null;
  const before = sample(beforeObs.filter((o) => common.has(o.promptId)));
  const after = sample(afterObs.filter((o) => common.has(o.promptId)));
  return {
    fromVisibilityRunId,
    toVisibilityRunId,
    promptCount: common.size,
    excludedPrompts: { onlyBefore: beforeIds.size - common.size, onlyAfter: afterIds.size - common.size },
    before,
    after,
    mentionRate: metricDelta(before.mentionRate, after.mentionRate, true),
    citationRate: metricDelta(before.citationRate, after.citationRate, true),
    recommendationRate: metricDelta(before.recommendationRate, after.recommendationRate, true),
  };
}

/**
 * Compare two snapshots. Either side may be null (no baseline / nothing measured yet) — deltas are then null
 * and a note explains why. Pass `likeForLike` (from computeLikeForLike) to compare rates on shared prompts only.
 */
export function computeDelta(
  before: SnapshotView | null,
  after: SnapshotView | null,
  o: { likeForLike?: LikeForLike | null; fixed?: number | null; new?: number | null } = {},
): SnapshotDelta {
  const notes: string[] = [];
  const b = before;
  const a = after;
  const lfl = o.likeForLike ?? null;

  const pillars = Object.fromEntries(
    SNAPSHOT_PILLARS.map((p) => [p, metricDelta(b?.pillarScores[p], a?.pillarScores[p])]),
  ) as SnapshotDelta["pillars"];
  const bySeverity = Object.fromEntries(
    SNAPSHOT_SEVERITIES.map((s: SnapshotSeverity) => [s, metricDelta(b?.openIssues?.[s], a?.openIssues?.[s])]),
  ) as SnapshotDelta["issues"]["bySeverity"];

  const bv = b?.visibility ?? null;
  const av = a?.visibility ?? null;
  const methodologyChanged = !!b && !!a && b.methodologyVersion !== a.methodologyVersion;
  const promptSetChanged = !!b && !!a && b.promptSetVersion !== null && a.promptSetVersion !== null && b.promptSetVersion !== a.promptSetVersion;

  if (!a) notes.push("Nothing has been measured yet.");
  else if (!b) notes.push("No earlier measurement to compare against yet, so changes will show after the next check.");
  if (methodologyChanged) {
    notes.push(`Our scoring method changed (${b!.methodologyVersion} → ${a!.methodologyVersion}), so part of any score change comes from the new method.`);
  }
  if (promptSetChanged) {
    notes.push(
      lfl
        ? `The AI questions changed (v${b!.promptSetVersion} → v${a!.promptSetVersion}); mention and citation rates are compared on the ${lfl.promptCount} question${lfl.promptCount === 1 ? "" : "s"} asked both times.`
        : `The AI questions changed (v${b!.promptSetVersion} → v${a!.promptSetVersion}), so AI visibility numbers aren't directly comparable.`,
    );
  } else if (lfl && (lfl.excludedPrompts.onlyBefore || lfl.excludedPrompts.onlyAfter)) {
    notes.push(`Rates are compared on the ${lfl.promptCount} question${lfl.promptCount === 1 ? "" : "s"} asked both times.`);
  }
  if (bv && av && bv.formulaVersion !== av.formulaVersion) notes.push("The visibility index formula changed between these checks.");
  if (b?.simulated || a?.simulated) notes.push("Includes simulated demo data, which is not a real measurement.");
  if (b && a && b.visibilityRunId && b.visibilityRunId === a.visibilityRunId) notes.push("No new AI visibility check since the earlier date.");
  const minSample = lfl ? Math.min(lfl.before.sampleSize, lfl.after.sampleSize) : bv && av ? Math.min(bv.collected, av.collected) : null;
  if (minSample !== null && minSample > 0 && minSample < SMALL_SAMPLE) {
    notes.push(`AI rates are based on a small sample (${minSample} answers), so they can move a lot between checks.`);
  }

  return {
    from: b ? { id: b.id, at: b.createdAt } : null,
    to: a ? { id: a.id, at: a.createdAt } : null,
    overall: metricDelta(b?.overallScore, a?.overallScore),
    pillars,
    issues: {
      total: metricDelta(b?.openIssues?.total, a?.openIssues?.total),
      bySeverity,
      fixed: b && a ? (o.fixed ?? null) : null,
      new: b && a ? (o.new ?? null) : null,
    },
    visibility: {
      mentionRate: lfl ? lfl.mentionRate : metricDelta(bv?.mentionRate, av?.mentionRate, true),
      citationRate: lfl ? lfl.citationRate : metricDelta(bv?.citationRate, av?.citationRate, true),
      recommendationRate: lfl ? lfl.recommendationRate : metricDelta(bv?.recommendationRate, av?.recommendationRate, true),
      visibilityIndex: metricDelta(bv?.visibilityIndex, av?.visibilityIndex),
      likeForLike: lfl,
    },
    methodologyChanged,
    promptSetChanged,
    notes,
  };
}
