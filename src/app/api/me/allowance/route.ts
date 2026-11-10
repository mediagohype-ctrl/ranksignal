// GET: "AI answers left" for the header widget — { used, cap, left, monthlyLeft, extraLeft, extraExpiresAt, resetsAt,
// canBuyMore } for the signed-in workspace. left = plan answers left + extra answers (top-up packs).
import { handler, json, requireSession } from "@/lib/api";
import { getAiAllowance } from "@/lib/billing/allowance";

export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const a = await getAiAllowance(s.organizationId);
  return json({
    item: {
      used: a.used,
      cap: a.cap,
      left: a.left,
      monthlyLeft: a.monthlyLeft,
      extraLeft: a.extra.left,
      extraExpiresAt: a.extra.expiresAt?.toISOString() ?? null,
      resetsAt: a.resetsAt?.toISOString() ?? null,
      // Only owners/admins can buy extra answers (staff "view as customer" sessions are read-only).
      canBuyMore: (s.role === "owner" || s.role === "admin") && !s.readOnly,
    },
  });
});
