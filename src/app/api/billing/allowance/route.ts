import { handler, json, requireSession } from "@/lib/api";
import { getAiAllowance, getWebsiteCheckAllowance } from "@/lib/billing/allowance";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/allowance → { item: { ai: { used, cap, left, resetsAt }, website: { allowed, resetsAt } } }.
 * What the run buttons need to disable themselves at the plan limit (customer words: AI answers, never credits).
 */
export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const [ai, website] = await Promise.all([getAiAllowance(s.organizationId), getWebsiteCheckAllowance(s.organizationId)]);
  return json(
    {
      item: {
        ai: { ...ai, resetsAt: ai.resetsAt?.toISOString() ?? null },
        website: { allowed: website.allowed, resetsAt: website.resetsAt.toISOString() },
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
