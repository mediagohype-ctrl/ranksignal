import type { Pillar } from "@/lib/report/types";
import type { CheckContext, EvaluatedCheck } from "@/lib/report/inputs";
import { seoChecks } from "@/lib/report/checks/seo";
import { aeoChecks } from "@/lib/report/checks/aeo";
import { geoChecks } from "@/lib/report/checks/geo";
import { brandChecks } from "@/lib/report/checks/brand";
import { depthChecks } from "@/lib/report/checks/depth";

export { seoChecks, aeoChecks, geoChecks, brandChecks, depthChecks };

export function runAllChecks(ctx: CheckContext): Record<Pillar, EvaluatedCheck[]> {
  const depth = depthChecks(ctx);
  // Real Core Web Vitals replace the size-based speed estimate (no double counting of speed).
  const measured = depth.some((c) => c.id === "seo.core_web_vitals");
  const seo = [...seoChecks(ctx).filter((c) => !(measured && c.id === "seo.page_speed_proxy")), ...depth];
  return { seo, aeo: aeoChecks(ctx), geo: geoChecks(ctx), brand: brandChecks(ctx) };
}
