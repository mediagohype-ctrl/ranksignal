// Pure: snapshot rows → score-history chart points. Shared by the Progress page (tiles) and HistoryExplorer (chart).
import type { HistoryMarker, ScoreHistoryPoint } from "@/components/app/charts";

export interface ScoreRow {
  id: string;
  at: string; // ISO
  crawlRunId: string | null;
  overall: number | null;
  seo: number | null;
  aeo: number | null;
  geo: number | null;
  brand: number | null;
  promptSetVersion: number | null;
  methodologyVersion: string;
}

/**
 * One point per website check, plus a new point whenever a later AI check changed that check's score (AI answers
 * are part of the score). So the newest point is the newest snapshot's overall score — the same number as Home.
 * Rows must be oldest first.
 */
export function buildScorePoints(rows: ScoreRow[]): { points: ScoreHistoryPoint[]; markers: HistoryMarker[] } {
  const points: ScoreHistoryPoint[] = [];
  const markers: HistoryMarker[] = [];
  const lastByCrawl = new Map<string, ScoreHistoryPoint>();
  let prevMethod: string | null = null;
  let prevPromptSet: number | null = null;
  for (const s of rows) {
    const t = new Date(s.at).getTime();
    if (prevMethod !== null && s.methodologyVersion !== prevMethod) markers.push({ t, kind: "methodology", label: "Scoring method changed" });
    prevMethod = s.methodologyVersion;
    if (s.promptSetVersion !== null) {
      if (prevPromptSet !== null && s.promptSetVersion !== prevPromptSet) markers.push({ t, kind: "prompt_set", label: "Customer questions changed" });
      prevPromptSet = s.promptSetVersion;
    }
    if (s.overall === null && s.seo === null) continue;
    const key = s.crawlRunId ?? s.id;
    const prev = lastByCrawl.get(key);
    const same =
      prev && prev.overall === s.overall && prev.seo === s.seo && prev.aeo === s.aeo && prev.geo === s.geo && prev.brand === s.brand;
    if (same) continue;
    const p: ScoreHistoryPoint = { t, overall: s.overall, seo: s.seo, aeo: s.aeo, geo: s.geo, brand: s.brand };
    points.push(p);
    lastByCrawl.set(key, p);
  }
  return { points, markers };
}

/** Latest overall score minus the first one; null with fewer than two scored points. */
export function scoreChange(points: ScoreHistoryPoint[]): number | null {
  const scored = points.filter((p) => p.overall !== null);
  if (scored.length < 2) return null;
  return Math.round((scored[scored.length - 1].overall as number) - (scored[0].overall as number));
}
