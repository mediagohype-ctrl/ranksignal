// One call to build <PlanBanner /> props in a server component (app layout).
import { getOrgAccess } from "./access";
import { getVisibilityRunAllowance } from "./ai-limits";
import { getUsageSummary } from "./usage";

export async function getPlanBannerData(orgId: string) {
  const [access, usage, ai] = await Promise.all([getOrgAccess(orgId), getUsageSummary(orgId), getVisibilityRunAllowance(orgId)]);
  return {
    access,
    usage: { creditsUsed: usage.used, creditsLimit: usage.limit, aiChecksUsed: ai.used, aiChecksLimit: ai.limit },
  };
}
