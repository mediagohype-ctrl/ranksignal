// Measurement history contracts (round 4, agent: history). Snapshots freeze scores after each successful
// crawl / AI visibility run so change over time can be shown honestly (with methodology and prompt-set notes).

export type SnapshotKind = "crawl" | "visibility";
export type SnapshotPillar = "seo" | "aeo" | "geo" | "brand";
export const SNAPSHOT_PILLARS: SnapshotPillar[] = ["seo", "aeo", "geo", "brand"];
export const SNAPSHOT_SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type SnapshotSeverity = (typeof SNAPSHOT_SEVERITIES)[number];

export type SnapshotPillarScores = Record<SnapshotPillar, number | null>;
export type SnapshotIssueCounts = Record<SnapshotSeverity, number> & { total: number };

/** Subset of VisibilityMetrics kept per snapshot. Rates are 0-1. */
export interface SnapshotVisibility {
  mentionRate: number;
  citationRate: number;
  recommendationRate: number;
  visibilityIndex: number;
  competitorShare: Record<string, number>;
  sampleSize: number;
  collected: number;
  providers: string[];
  formulaVersion: string;
}

export interface SnapshotView {
  id: string;
  projectId: string;
  kind: SnapshotKind;
  crawlRunId: string | null;
  visibilityRunId: string | null;
  /** When the measurement was taken (the source run's finish time). */
  createdAt: Date;
  overallScore: number | null;
  grade: string | null;
  pillarScores: SnapshotPillarScores;
  openIssues: SnapshotIssueCounts | null;
  visibility: SnapshotVisibility | null;
  promptSetVersion: number | null;
  methodologyVersion: string;
  simulated: boolean;
}

export interface MetricDelta {
  before: number | null;
  after: number | null;
  /** after - before; null when either side is missing. */
  delta: number | null;
}

export interface RateSample {
  sampleSize: number;
  mentionRate: number;
  citationRate: number;
  recommendationRate: number;
}

/** Rates compared only on prompts asked in both runs. */
export interface LikeForLike {
  fromVisibilityRunId: string;
  toVisibilityRunId: string;
  /** Prompt ids present in both runs. */
  promptCount: number;
  /** Prompts only in one run (excluded from the comparison). */
  excludedPrompts: { onlyBefore: number; onlyAfter: number };
  before: RateSample;
  after: RateSample;
  mentionRate: MetricDelta;
  citationRate: MetricDelta;
  recommendationRate: MetricDelta;
}

export interface SnapshotDelta {
  from: { id: string; at: Date } | null;
  to: { id: string; at: Date } | null;
  overall: MetricDelta;
  pillars: Record<SnapshotPillar, MetricDelta>;
  issues: {
    total: MetricDelta;
    bySeverity: Record<SnapshotSeverity, MetricDelta>;
    /** Findings resolved / first detected between the two snapshots (filled by compareSnapshots; null otherwise). */
    fixed: number | null;
    new: number | null;
  };
  visibility: {
    mentionRate: MetricDelta;
    citationRate: MetricDelta;
    recommendationRate: MetricDelta;
    visibilityIndex: MetricDelta;
    /** Present when both visibility run ids were known and comparable prompts exist. */
    likeForLike: LikeForLike | null;
  };
  methodologyChanged: boolean;
  promptSetChanged: boolean;
  /** Plain-English caveats: methodology / prompt-set changes, simulated data, missing baseline, small samples. */
  notes: string[];
}
