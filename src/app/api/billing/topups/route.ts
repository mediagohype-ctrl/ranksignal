// Extra AI answers (one-time top-up packs).
//   GET  → { item: TopUpOverview } — packs on offer (price + GST + total), extra answers left per pack, purchase history.
//   POST { packId } → { item: { orderId, keyId, amount, currency, breakdown } } — opens a Razorpay ORDER for Checkout.
// Owner/admin only for POST. Answers are added ONLY by the signed webhook (order.paid), never by this route.
import { z } from "zod";
import { handler, json, parseBody, requireSession } from "@/lib/api";
import { requireActiveMembership } from "@/lib/auth/membership";
import { TOPUP_PACK_IDS } from "@/lib/billing/topups";
import { getTopUpOverview, startTopUpCheckout } from "@/lib/billing/topup-service";

export const dynamic = "force-dynamic";

const schema = z.object({ packId: z.enum(TOPUP_PACK_IDS) });

export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const item = await getTopUpOverview(s.organizationId);
  return json({ item }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = handler(async (req: Request) => {
  const s = await requireSession("admin");
  await requireActiveMembership(s, ["owner", "admin"]);
  const { packId } = await parseBody(req, schema);
  const r = await startTopUpCheckout({ organizationId: s.organizationId, userId: s.userId, packId });
  return json({ item: { orderId: r.orderId, keyId: r.keyId, amount: r.amount, currency: r.currency, breakdown: r.breakdown } });
});
