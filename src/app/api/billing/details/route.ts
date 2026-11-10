// GET/PUT /api/billing/details — the business details printed on this organization's GST invoices.
// Owner/admin only (they are the ones who pay); always scoped to the session's organization.
import { handler, json, parseBody, requireSession } from "@/lib/api";
import { requireActiveMembership } from "@/lib/auth/membership";
import { writeAuditLog } from "@/lib/audit-log";
import { billingDetailsSchema, getBillingDetails, saveBillingDetails } from "@/lib/billing/billing-details";

export const GET = handler(async () => {
  const s = await requireSession("admin");
  await requireActiveMembership(s, ["owner", "admin"]);
  return json({ item: await getBillingDetails(s.organizationId) });
});

export const PUT = handler(async (req: Request) => {
  const s = await requireSession("admin");
  await requireActiveMembership(s, ["owner", "admin"]);
  const input = await parseBody(req, billingDetailsSchema);
  const before = await getBillingDetails(s.organizationId);
  const item = await saveBillingDetails(s.organizationId, input);
  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    action: "billing.details_updated",
    resourceType: "billing_details",
    resourceId: s.organizationId,
    before: before ? { legalName: before.legalName, gstin: before.gstin, stateCode: before.stateCode } : undefined,
    after: { legalName: item.legalName, gstin: item.gstin, stateCode: item.stateCode },
  });
  return json({ item });
});
