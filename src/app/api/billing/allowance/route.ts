import { handler, json, requireSession } from "@/lib/api";
import { getAiAllowance, getWebsiteCheckAllowance } from "@/lib/billing/allowance";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/allowance → { item: { ai: { used, cap, left, monthlyLeft, resetsAt, extra }, website: { allowed, resetsAt } } }.
 * What the run buttons need to disable themselves at the plan limit (customer words: AI answers, never credits).
 */
export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const [ai, website] = await Promise.all([getAiAllowance(s.organizationId), getWebsiteCheckAllowance(s.organizationId)]);
  return json(
    {
      item: {
        // left = plan answers left + extra answers (top-up packs); extra = { left, expiresAt, packs }.
        ai: {
          used: ai.used,
          cap: ai.cap,
          left: ai.left,
          monthlyLeft: ai.monthlyLeft,
          resetsAt: ai.resetsAt?.toISOString() ?? null,
          extra: { left: ai.extra.left, expiresAt: ai.extra.expiresAt?.toISOString() ?? null },
        },
        website: { allowed: website.allowed, resetsAt: website.resetsAt.toISOString() },
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
