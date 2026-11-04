// GET /api/referral → { item: { code, link, signedUp, paying, freeMonthsEarned } }
// The code is created on first request. One free month for each referred business that starts paying
// (see src/lib/growth/referral.ts).
import { handler, json, requireSession } from "@/lib/api";
import { referralSummary } from "@/lib/growth/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const s = await requireSession("viewer");
  return json({ item: await referralSummary(s.organizationId) }, { headers: { "Cache-Control": "no-store" } });
});
