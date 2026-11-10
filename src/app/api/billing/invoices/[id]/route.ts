// GET /api/billing/invoices/:id — one GST invoice of this organization (404 for anyone else's). Owner/admin only.
import { handler, HttpError, json, requireSession } from "@/lib/api";
import { requireActiveMembership } from "@/lib/auth/membership";
import { getInvoice } from "@/lib/billing/invoice";

export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const s = await requireSession("admin");
  await requireActiveMembership(s, ["owner", "admin"]);
  const { id } = await ctx.params;
  const inv = await getInvoice(s.organizationId, id);
  if (!inv) throw new HttpError(404, "not_found", "Invoice not found.");
  return json({ item: { ...inv, paidAt: inv.paidAt.toISOString(), createdAt: inv.createdAt.toISOString() } });
});
