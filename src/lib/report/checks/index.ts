import type { Pillar } from "@/lib/report/types";
import type { CheckContext, EvaluatedCheck } from "@/lib/report/inputs";
import { seoChecks } from "@/lib/report/checks/seo";
import { aeoChecks } from "@/lib/report/checks/aeo";
import { geoChecks } from "@/lib/report/checks/geo";
import { brandChecks } from "@/lib/report/checks/brand";

export { seoChecks, aeoChecks, geoChecks, brandChecks };

export function runAllChecks(ctx: CheckContext): Record<Pillar, EvaluatedCheck[]> {
  return { seo: seoChecks(ctx), aeo: aeoChecks(ctx), geo: geoChecks(ctx), brand: brandChecks(ctx) };
}
