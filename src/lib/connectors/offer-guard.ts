// Owner decision 1 (15 Nov 2026): "Do it myself" has NO website connections — the owner makes every change by hand.
// The website-connector connect routes call this so the rule is enforced on the server, not only hidden in the menu.
// Google Search Console / GA4 (read-only data for reports) are not website connections and are NOT guarded.
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { canConnectWebsite } from "@/lib/billing/offer";

export const CONNECT_REFUSED_CODE = "connections_not_on_plan";
export const CONNECT_REFUSED_MESSAGE =
  "Website connections aren't part of Do it myself — you make each change yourself, with ready-to-paste text and steps. " +
  "Want our team to make the changes for you? Book a free call.";

/** Throws 403 unless the organization's offer includes website connections (Do it for me / Custom). */
export async function assertCanConnectWebsite(organizationId: string): Promise<void> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { planId: true, serviceTier: true } });
  if (!canConnectWebsite(org)) throw new HttpError(403, CONNECT_REFUSED_CODE, CONNECT_REFUSED_MESSAGE);
}
