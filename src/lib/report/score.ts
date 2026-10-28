// Report scoring (METHODOLOGY_VERSION "report-1"):
// - pillar score = Σ(check.score × check.weight) / Σ(weight) over measured checks (status ≠ not_measured);
//   null when no check in the pillar is measured.
// - overall = weighted average of measured pillars (seo .35, aeo .20, geo .30, brand .15), weights
//   renormalised over the pillars that have a score.
// - grades: A ≥ 90, B ≥ 80, C ≥ 65, D ≥ 50, otherwise F.
// Scores summarise observable signals; they are not predictions of rankings or AI inclusion.
import type { CheckResult, Grade, Pillar } from "@/lib/report/types";

export const METHODOLOGY_VERSION = "report-1";
export const PILLAR_WEIGHTS: Record<Pillar, number> = { seo: 0.35, aeo: 0.2, geo: 0.3, brand: 0.15 };
export const PILLAR_ORDER: Pillar[] = ["seo", "aeo", "geo", "brand"];
export const PILLAR_LABELS: Record<Pillar, string> = {
  seo: "SEO",
  aeo: "AEO (answer engines)",
  geo: "GEO (generative AI)",
  brand: "Brand",
};

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

export function pillarSummary(pillar: Pillar, score: number | null, checks: CheckResult[]): string {
  const measured = checks.filter((c) => c.status !== "not_measured");
  if (score === null) {
    return pillar === "geo" || pillar === "brand"
      ? `Not measured yet — run a website scan${pillar === "geo" ? " and an AI visibility check" : ""} to see this.`
      : "Not measured yet — run a website scan to see this.";
  }
  const passing = measured.filter((c) => c.status === "pass").length;
  const failing = measured.filter((c) => c.status === "fail").length;
  const tone = score >= 80 ? "In good shape" : score >= 65 ? "Decent, with room to improve" : score >= 50 ? "Needs attention" : "Needs significant work";
  return `${tone}: ${passing} of ${measured.length} checks pass${failing ? `, ${failing} need${failing === 1 ? "s" : ""} fixing` : ""}.`;
}
