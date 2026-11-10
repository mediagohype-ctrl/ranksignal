// GET /api/billing/invoices — this organization's GST invoices, newest first. Owner/admin only.
import { handler, json, requireSession } from "@/lib/api";
import { requireActiveMembership } from "@/lib/auth/membership";
import { listInvoices } from "@/lib/billing/invoice";

export const GET = handler(async () => {
  const s = await requireSession("admin");
  await requireActiveMembership(s, ["owner", "admin"]);
  const items = await listInvoices(s.organizationId);
  return json({
    items: items.map((i) => ({
      id: i.id,
      number: i.number,
      kind: i.kind,
      description: i.description,
      basePaise: i.basePaise,
      gstPaise: i.gstPaise,
      totalPaise: i.totalPaise,
      paidAt: i.paidAt.toISOString(),
      url: `/app/settings/invoices/${i.id}`,
    })),
  });
});
