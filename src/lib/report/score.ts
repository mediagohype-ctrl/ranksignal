// Report scoring (METHODOLOGY_VERSION "report-1"):
// - pillar score = Σ(check.score × check.weight) / Σ(weight) over measured checks (status ≠ not_measured);
//   null when no check in the pillar is measured.
// - overall = weighted average of measured pillars (seo .35, aeo .20, geo .30, brand .15), weights
//   renormalised over the pillars that have a score.
// - grades: A ≥ 90, B ≥ 80, C ≥ 65, D ≥ 50, otherwise F (kept for Expert views; customers see one number + colour).
// - bands shown to customers (one rule everywhere): Good ≥ 75, Needs work 50–74, Poor < 50.
// Scores summarise observable signals; they are not predictions of rankings or AI inclusion.
import type { CheckResult, Grade, Pillar } from "@/lib/report/types";

export const METHODOLOGY_VERSION = "report-1";
export const PILLAR_WEIGHTS: Record<Pillar, number> = { seo: 0.35, aeo: 0.2, geo: 0.3, brand: 0.15 };
export const PILLAR_ORDER: Pillar[] = ["seo", "aeo", "geo", "brand"];
/** Pillar names: SEO, AEO, GEO and Brand (the owner prefers these over plain-word names). */
export const PILLAR_LABELS: Record<Pillar, string> = {
  seo: "SEO",
  aeo: "AEO",
  geo: "GEO",
  brand: "Brand",
};

/** Pillars whose checks partly depend on AI answers; shown as "waiting for AI results" until they arrive. */
export const AI_PILLARS: readonly Pillar[] = ["geo", "brand"];

/** One label per score, the same on every screen: Good ≥ 75, Needs work 50–74, Poor < 50. */
export function scoreLabel(score: number | null): string {
  if (score === null || !Number.isFinite(score)) return "Not checked yet";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs work";
  return "Poor";
}

export function gradeFor(score: number | null): Grade | null {
  if (score === null || !Number.isFinite(score)) return null;
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 65) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function pillarScore(checks: Pick<CheckResult, "status" | "score" | "weight">[]): number | null {
  const measured = checks.filter((c) => c.status !== "not_measured" && c.weight > 0);
  const w = measured.reduce((a, c) => a + c.weight, 0);
  if (w === 0) return null;
  return Math.round(measured.reduce((a, c) => a + c.score * c.weight, 0) / w);
}

export function overallScore(scores: Partial<Record<Pillar, number | null>>): number | null {
  let w = 0;
  let sum = 0;
  for (const p of PILLAR_ORDER) {
    const s = scores[p];
    if (typeof s === "number" && Number.isFinite(s)) {
      w += PILLAR_WEIGHTS[p];
      sum += s * PILLAR_WEIGHTS[p];
    }
  }
  return w === 0 ? null : Math.round(sum / w);
}

export function pillarSummary(pillar: Pillar, score: number | null, checks: CheckResult[], aiMeasured = true): string {
  const measured = checks.filter((c) => c.status !== "not_measured");
  if (score === null) {
    return AI_PILLARS.includes(pillar)
      ? "Not checked yet. Run a website check and an AI check to see this."
      : "Not checked yet. Run a website check to see this.";
  }
  const passing = measured.filter((c) => c.status === "pass").length;
  const failing = measured.filter((c) => c.status === "fail").length;
  const tone = score >= 75 ? "Good" : score >= 50 ? "Needs work" : "Poor";
  const waiting = !aiMeasured && AI_PILLARS.includes(pillar) ? " Waiting for AI results — this score covers your website only." : "";
  return `${tone}: ${passing} of ${measured.length} checks pass${failing ? `, ${failing} need${failing === 1 ? "s" : ""} fixing` : ""}.${waiting}`;
}
