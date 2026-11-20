// "Better than N% of websites checked on MyWebRank": compares a free-check score with the scores of earlier free
// checks (Lead rows, source free_check, last 12 months). Shown only when there are enough checks to be fair.
import { db } from "@/lib/db";
import type { FreeCheckBenchmark } from "./types";

/** Fewer earlier checks than this and we show no comparison (a percentage of a handful would mislead). */
export const BENCHMARK_MIN_SAMPLE = 30;

/** Pure: the comparison from counts. Null when the sample is too small or the score is missing. */
export function benchmarkFrom(score: number | null, total: number, below: number, average: number | null): FreeCheckBenchmark | null {
  if (score === null || total < BENCHMARK_MIN_SAMPLE || average === null) return null;
  const betterThan = Math.max(1, Math.min(99, Math.round((below / total) * 100)));
  return { betterThan, average: Math.round(average), sample: total };
}

/** Reads the counts. Best-effort: any database problem means no comparison, never a failed check. */
export async function freeCheckBenchmark(score: number | null): Promise<FreeCheckBenchmark | null> {
  if (score === null) return null;
  try {
    const where = { source: "free_check", score: { not: null }, createdAt: { gte: new Date(Date.now() - 365 * 86_400_000) } };
    const [total, below, avg] = await Promise.all([
      db.lead.count({ where }),
      db.lead.count({ where: { ...where, score: { lt: Math.round(score) } } }),
      db.lead.aggregate({ where, _avg: { score: true } }),
    ]);
    return benchmarkFrom(score, total, below, avg._avg.score);
  } catch {
    return null;
  }
}
