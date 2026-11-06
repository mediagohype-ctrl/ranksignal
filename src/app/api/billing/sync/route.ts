import { z } from "zod";
import { handler, json, parseBody, requireSession, HttpError } from "@/lib/api";
import { requireActiveMembership } from "@/lib/auth/membership";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { syncOrganizationFromRazorpay } from "@/lib/billing/sync";

const schema = z.object({ subscriptionId: z.string().regex(/^sub_[A-Za-z0-9]{6,40}$/).optional() });

/**
 * POST — "I paid, please check". Asks Razorpay (server-to-server) for this organization's subscription and
 * switches the plan on if it is active. The body may name the subscription id from checkout; it is only used
 * to look the subscription up, and must belong to the caller's organization.
 */
export const POST = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  await requireActiveMembership(s, ["owner", "admin", "member", "viewer"]);
  if (!checkRateLimit(`billing-sync:${s.organizationId}`, 30, 10 * 60 * 1000).allowed) {
    throw new HttpError(429, "rate_limited", "Please wait a moment before checking again.");
  }
  const { subscriptionId } = await parseBody(req, schema);
  try {
    return json({ item: await syncOrganizationFromRazorpay(s.organizationId, subscriptionId) });
  } catch {
    throw new HttpError(502, "billing_provider_error", "Couldn't reach Razorpay just now. Please try again in a minute.");
  }
});
