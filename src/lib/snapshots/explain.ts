// "Why did my score change?" — ONE plain sentence with the main reason, worked out from two measurements.
// Pure (no DB): the loader in ./explain-server.ts turns two history snapshots into ScoreFacts.
//
// The reason is derived from data only, never guessed:
//   1. which single check moved the score most (when both measurements kept their full report), else
//   2. which part of the score (SEO / AEO / GEO / Brand) moved most, plus what is known to have changed between the
//      two measurements: AI answers added, a different number of pages read, a new scoring method.
// When none of those explains it, the sentence simply lists the parts that moved: "SEO +7, GEO −4".
import { PILLAR_LABELS, PILLAR_ORDER, PILLAR_WEIGHTS } from "@/lib/report/score";
import type { Pillar } from "@/lib/report/types";

export interface ScoreFactCheck {
  id: string;
  pillar: Pillar;
  label: string;
  status: string;
  score: number;
  weight: number;
}

export interface ScoreFacts {
  at: Date;
  overall: number | null;
  pillars: Partial<Record<Pillar, number | null>>;
  /** Pages read in the website check behind this score; null when unknown. */
  pages: number | null;
  crawlRunId: string | null;
  /** True when real AI answers were part of this score. */
  aiMeasured: boolean;
  /** Real AI answers behind the score, and how many named the business (null when not measured / unknown). */
  aiAnswers: number | null;
  aiNamed: number | null;
  /** When AI answers first became part of the score (between the two measurements), if known. */
  aiSince?: Date | null;
  methodologyVersion: string | null;
  /** Check scores from the stored report; null when this measurement kept no report. */
  checks: ScoreFactCheck[] | null;
}

export type ScoreChangeReason = "ai_added" | "ai_changed" | "speed" | "pages" | "method" | "check" | "parts";

export interface ScoreChangeExplanation {
  /** after − before, whole points. */
  delta: number;
  reason: ScoreChangeReason;
  /** One sentence, ready to show. */
  line: string;
}

const AI_CHECK = /^(geo\.ai_|geo\.competitor_share|brand\.ai_)/;
const SPEED_CHECK = /^seo\.(core_web_vitals|page_speed_proxy)$/;
const PAGE_PILLARS: Pillar[] = ["seo", "aeo"];
const signed = (n: number) => `${n > 0 ? "+" : "−"}${Math.abs(n)}`;
const sameSign = (a: number, b: number) => (a > 0 && b > 0) || (a < 0 && b < 0);

function defaultDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/** Points each part added to (or took from) the overall score, with the pillar weights renormalised like overallScore. */
function pillarContributions(before: ScoreFacts, after: ScoreFacts): { pillar: Pillar; delta: number | null; weighted: number }[] {
  const share = (f: ScoreFacts, p: Pillar) => {
    const s = f.pillars[p];
    if (typeof s !== "number") return 0;
    const w = PILLAR_ORDER.reduce((a, q) => a + (typeof f.pillars[q] === "number" ? PILLAR_WEIGHTS[q] : 0), 0);
    return w > 0 ? (s * PILLAR_WEIGHTS[p]) / w : 0;
  };
  return PILLAR_ORDER.map((p) => {
    const b = before.pillars[p];
    const a = after.pillars[p];
    return { pillar: p, delta: typeof a === "number" && typeof b === "number" ? Math.round(a - b) : null, weighted: share(after, p) - share(before, p) };
  });
}

/** Points each check added to (or took from) the overall score (same weights the report uses). Null without both reports. */
function checkContributions(before: ScoreFacts, after: ScoreFacts): { id: string; label: string; pillar: Pillar; weighted: number }[] | null {
  if (!before.checks || !after.checks) return null;
  const part = (f: ScoreFacts, c: ScoreFactCheck | undefined) => {
    if (!c || c.status === "not_measured" || c.weight <= 0) return 0;
    const inPillar = f.checks!.filter((x) => x.pillar === c.pillar && x.status !== "not_measured" && x.weight > 0).reduce((a, x) => a + x.weight, 0);
    const pillarW = PILLAR_ORDER.reduce((a, q) => a + (typeof f.pillars[q] === "number" ? PILLAR_WEIGHTS[q] : 0), 0);
    if (inPillar <= 0 || pillarW <= 0) return 0;
    return ((c.score * c.weight) / inPillar) * (PILLAR_WEIGHTS[c.pillar] / pillarW);
  };
  const ids = new Set([...before.checks, ...after.checks].map((c) => c.id));
  return [...ids].map((id) => {
    const b = before.checks!.find((c) => c.id === id);
    const a = after.checks!.find((c) => c.id === id);
    const ref = (a ?? b)!;
    return { id, label: ref.label, pillar: ref.pillar, weighted: part(after, a) - part(before, b) };
  });
}

function aiDetail(f: ScoreFacts): string {
  if (f.aiAnswers === null || f.aiNamed === null || f.aiAnswers <= 0) return "";
  return f.aiNamed === 0 ? " (AI tools don't mention you yet)" : ` (AI tools named you in ${f.aiNamed} of ${f.aiAnswers} answers)`;
}

/**
 * The main reason the score moved between two measurements; null when there is nothing to explain (no score on
 * one side, or no change).
 */
export function explainScoreChange(
  before: ScoreFacts | null,
  after: ScoreFacts | null,
  o: { now?: Date; fmtDate?: (d: Date) => string } = {},
): ScoreChangeExplanation | null {
  if (!before || !after || typeof before.overall !== "number" || typeof after.overall !== "number") return null;
  const delta = Math.round(after.overall - before.overall);
  if (delta === 0) return null;
  const fmt = o.fmtDate ?? defaultDate;
  const now = o.now ?? new Date();
  const when = fmt(after.at) === fmt(now) ? "today" : `on ${fmt(after.at)}`;
  const start = `Your score ${delta > 0 ? "went up" : "dropped"} ${Math.abs(delta)} because`;
  const done = (reason: ScoreChangeReason, rest: string): ScoreChangeExplanation => ({ delta, reason, line: `${start} ${rest}` });

  const pillars = pillarContributions(before, after);
  const moving = pillars.filter((p) => sameSign(p.weighted, delta)).sort((a, b) => Math.abs(b.weighted) - Math.abs(a.weighted));
  const mainPillar = moving[0]?.pillar ?? null;
  const aiPart = pillars.filter((p) => p.pillar === "geo" || p.pillar === "brand").reduce((a, p) => a + p.weighted, 0);
  const pagePart = pillars.filter((p) => PAGE_PILLARS.includes(p.pillar)).reduce((a, p) => a + p.weighted, 0);

  // 1. AI answers were not part of the score before and are now, and that is the bigger share of the move.
  if (!before.aiMeasured && after.aiMeasured && sameSign(aiPart, delta) && Math.abs(aiPart) >= Math.abs(pagePart)) {
    const since = after.aiSince ?? after.at;
    const aiWhen = fmt(since) === fmt(now) ? "today" : `on ${fmt(since)}`;
    return done("ai_added", `AI answers were added to your score ${aiWhen}${aiDetail(after)}.`);
  }

  // 2. The single check that moved the score most (needs both stored reports).
  const checks = checkContributions(before, after);
  const top = checks?.filter((c) => sameSign(c.weighted, delta)).sort((a, b) => Math.abs(b.weighted) - Math.abs(a.weighted))[0];
  const pagesChanged =
    before.pages !== null && after.pages !== null && before.crawlRunId !== after.crawlRunId &&
    Math.abs(after.pages - before.pages) >= Math.max(2, Math.round(0.2 * Math.max(1, before.pages)));
  const pagesReason = () =>
    done("pages", `we read ${after.pages! > before.pages! ? "more" : "fewer"} pages (${after.pages} instead of ${before.pages}).`);

  if (before.methodologyVersion && after.methodologyVersion && before.methodologyVersion !== after.methodologyVersion) {
    return done("method", `we changed how the score is worked out ${when}. Your website may not have changed.`);
  }
  // A very different number of pages changes almost every page check at once, so it outranks any single check.
  if (pagesChanged && mainPillar && PAGE_PILLARS.includes(mainPillar)) return pagesReason();

  if (top && Math.abs(top.weighted) >= 0.5) {
    if (SPEED_CHECK.test(top.id)) {
      return done("speed", `Google's speed test gave ${delta > 0 ? "better" : "worse"} results ${when}.`);
    }
    if (AI_CHECK.test(top.id)) {
      const was = before.aiNamed !== null && before.aiAnswers ? `, was ${before.aiNamed} of ${before.aiAnswers}` : "";
      const nowNamed = after.aiNamed !== null && after.aiAnswers ? ` (named in ${after.aiNamed} of ${after.aiAnswers} answers${was})` : "";
      return done("ai_changed", `AI tools named you ${delta > 0 ? "more" : "less"} often in the latest AI check${nowNamed}. AI answers change from one check to the next.`);
    }
    return done("check", `“${top.label}” got ${delta > 0 ? "better" : "worse"} (part of ${PILLAR_LABELS[top.pillar]}).`);
  }
  if (pagesChanged) return pagesReason();

  // 3. Fallback: just say which parts moved.
  const parts = pillars.filter((p) => p.delta !== null && p.delta !== 0).map((p) => `${PILLAR_LABELS[p.pillar]} ${signed(p.delta!)}`);
  return {
    delta,
    reason: "parts",
    line: parts.length
      ? `Your score ${delta > 0 ? "went up" : "dropped"} ${Math.abs(delta)} because of these parts: ${parts.join(", ")}.`
      : `Your score ${delta > 0 ? "went up" : "dropped"} ${Math.abs(delta)} since ${fmt(before.at)}.`,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Free check vs full check (first app screen)

/**
 * Why the free check's score differs from the first full score. Real numbers only: with no free-check score on file
 * the generic sentence (no numbers) is returned. Null when there is no full score yet.
 */
export function freeCheckGapLine(o: {
  freeScore: number | null;
  freePages: number | null;
  fullScore: number | null;
  fullPages: number | null;
  aiMeasured: boolean;
}): string | null {
  if (typeof o.fullScore !== "number") return null;
  const ai = o.aiMeasured ? " and asked AI about you" : "";
  const read = typeof o.fullPages === "number" && o.fullPages > 0 ? `We've now read ${o.fullPages === 1 ? "1 page" : `${o.fullPages} pages`}${ai}` : `We've now read your whole website${ai}`;
  if (typeof o.freeScore === "number" && o.freeScore !== o.fullScore) {
    const pages = typeof o.freePages === "number" && o.freePages > 0 ? `up to ${o.freePages} pages` : "a few pages";
    return `Your free check read ${pages} (${o.freeScore}). ${read}, so your full score is ${o.fullScore}.`;
  }
  if (typeof o.freeScore === "number") return null; // same number: nothing to explain
  return `A free check reads only a few pages. ${read}, so your full score can be different.`;
}
