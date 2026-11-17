// DB side of "why did my score change?" (pure logic: ./explain.ts). Reads two history snapshots — with their stored
// reports when they have one — and returns the one-line reason. Never throws: a page must not fail over this line.
import { db } from "@/lib/db";
import { log } from "@/lib/log";
import { isSiteReport } from "@/lib/report/stored";
import type { Pillar } from "@/lib/report/types";
import { explainScoreChange, type ScoreChangeExplanation, type ScoreFactCheck, type ScoreFacts } from "./explain";
import { listSnapshots } from "./index";
import type { SnapshotView } from "./types";

/**
 * Which two measurements to compare.
 *  - "start": the first scored measurement vs the latest (Progress → "Score change since start").
 *  - "recheck": the last measurement of the PREVIOUS website check vs the latest (Home, after a re-check). When there
 *    is only one website check, its first measurement vs its latest (e.g. the AI answers arrived later).
 */
export type ExplainMode = "start" | "recheck";

/** Pure: pick the pair for a mode from snapshots sorted oldest first. Exported for tests. */
export function pickPair(snaps: SnapshotView[], mode: ExplainMode): { before: SnapshotView; after: SnapshotView } | null {
  const scored = snaps.filter((s) => !s.simulated && typeof s.overallScore === "number");
  if (scored.length < 2) return null;
  const after = scored[scored.length - 1];
  if (mode === "start") return { before: scored[0], after };
  const earlier = scored.slice(0, -1);
  const previousCheck = [...earlier].reverse().find((s) => s.crawlRunId !== after.crawlRunId);
  const before = previousCheck ?? earlier.find((s) => s.crawlRunId === after.crawlRunId) ?? null;
  return before && before.id !== after.id ? { before, after } : null;
}

/** Pure: snapshot (+ its stored report JSON and page count, when known) → ScoreFacts. Exported for tests. */
export function factsFrom(s: SnapshotView, report: unknown, pagesCrawled: number | null): ScoreFacts {
  const r = isSiteReport(report) ? report : null;
  const checks: ScoreFactCheck[] | null = r
    ? r.pillars.flatMap((p) => (Array.isArray(p.checks) ? p.checks : []).map((c) => ({ id: c.id, pillar: c.pillar as Pillar, label: c.label, status: c.status, score: c.score, weight: c.weight })))
    : null;
  const vis = s.visibility;
  const aiMeasured = r ? r.aiVisibility.measured === true && r.aiVisibility.simulated !== true : !!vis;
  const answers = r && aiMeasured ? (r.aiVisibility.collected ?? r.aiVisibility.sampleSize ?? null) : (vis?.collected ?? null);
  const rate = r && aiMeasured ? r.aiVisibility.mentionRate : (vis?.mentionRate ?? null);
  return {
    at: s.createdAt,
    overall: s.overallScore,
    pillars: s.pillarScores,
    pages: r?.crawl.pagesCrawled ?? pagesCrawled,
    crawlRunId: s.crawlRunId,
    aiMeasured,
    aiAnswers: aiMeasured && typeof answers === "number" ? answers : null,
    aiNamed: aiMeasured && typeof answers === "number" && typeof rate === "number" ? Math.round(rate * answers) : null,
    methodologyVersion: s.methodologyVersion ?? null,
    checks: checks && checks.length ? checks : null,
  };
}

export async function explainScoreChangeFor(
  projectId: string,
  organizationId: string,
  mode: ExplainMode,
  o: { snapshots?: SnapshotView[]; now?: Date; fmtDate?: (d: Date) => string } = {},
): Promise<(ScoreChangeExplanation & { beforeAt: Date; afterAt: Date }) | null> {
  try {
    const snaps = o.snapshots ?? (await listSnapshots(projectId, organizationId));
    const pair = pickPair(snaps, mode);
    if (!pair) return null;
    const crawlIds = [...new Set([pair.before.crawlRunId, pair.after.crawlRunId].filter((x): x is string => !!x))];
    const [rows, crawls] = await Promise.all([
      db.reportSnapshot.findMany({ where: { organizationId, projectId, id: { in: [pair.before.id, pair.after.id] } }, select: { id: true, report: true } }),
      crawlIds.length
        ? db.crawlRun.findMany({ where: { organizationId, projectId, id: { in: crawlIds } }, select: { id: true, pagesCrawled: true } })
        : Promise.resolve([] as { id: string; pagesCrawled: number }[]),
    ]);
    const reportOf = (id: string) => rows.find((r) => r.id === id)?.report ?? null;
    const pagesOf = (id: string | null) => crawls.find((c) => c.id === id)?.pagesCrawled ?? null;
    const before = factsFrom(pair.before, reportOf(pair.before.id), pagesOf(pair.before.crawlRunId));
    const after = factsFrom(pair.after, reportOf(pair.after.id), pagesOf(pair.after.crawlRunId));
    // The first measurement after `before` that included real AI answers = the day AI joined the score.
    after.aiSince = snaps.find((s) => !s.simulated && s.createdAt > pair.before.createdAt && s.createdAt <= pair.after.createdAt && !!s.visibility)?.createdAt ?? null;
    const e = explainScoreChange(before, after, { now: o.now, fmtDate: o.fmtDate });
    return e ? { ...e, beforeAt: before.at, afterAt: after.at } : null;
  } catch (err) {
    log.warn("snapshots.explain_failed", { projectId, orgId: organizationId, err });
    return null;
  }
}
