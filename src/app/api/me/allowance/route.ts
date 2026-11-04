// GET: "AI answers left" for the header widget — { used, cap, left, resetsAt } for the signed-in workspace.
import { handler, json, requireSession } from "@/lib/api";
import { getAiAllowance } from "@/lib/billing/allowance";

export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const a = await getAiAllowance(s.organizationId);
  return json({ item: { used: a.used, cap: a.cap, left: a.left, resetsAt: a.resetsAt?.toISOString() ?? null } });
});
