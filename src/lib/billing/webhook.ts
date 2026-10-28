// Razorpay webhook processing: verify signature -> idempotency (WebhookEvent unique) -> map to Subscription/Organization.
// Billing state is changed ONLY here (signed server-to-server events); client checkout redirects are never trusted.
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isPlanId, planIdFromRazorpayPlan } from "./plans";
import { verifyRazorpaySignature, type RazorpaySubscription } from "./razorpay";

type SubStatus = "trialing" | "active" | "past_due" | "cancelled" | "expired";
type OrgStatus = "active" | "past_due" | "cancelled" | "suspended";

export const RAZORPAY_EVENT_MAP: Record<string, { sub: SubStatus; org: OrgStatus }> = {
  "subscription.activated": { sub: "active", org: "active" },
  "subscription.charged": { sub: "active", org: "active" },
  "subscription.pending": { sub: "past_due", org: "past_due" },
  "subscription.halted": { sub: "past_due", org: "past_due" },
  "subscription.cancelled": { sub: "cancelled", org: "cancelled" },
  "subscription.completed": { sub: "expired", org: "cancelled" },
};

export type WebhookResult =
  | { status: "invalid_signature" }
  | { status: "invalid_payload" }
  | { status: "duplicate"; eventId: string }
  | { status: "ignored"; eventId: string; reason: string }
  | { status: "processed"; eventId: string; organizationId: string };

interface RazorpayEventBody {
  event?: string;
  payload?: { subscription?: { entity?: RazorpaySubscription } };
}

const toDate = (s?: number | null) => (s ? new Date(s * 1000) : null);

export async function processRazorpayWebhook(
  rawBody: string,
  headers: { signature: string | null; eventId: string | null },
  secret = process.env.RAZORPAY_WEBHOOK_SECRET,
): Promise<WebhookResult> {
  if (!verifyRazorpaySignature(rawBody, headers.signature, secret)) return { status: "invalid_signature" };

  let body: RazorpayEventBody;
  try {
    body = JSON.parse(rawBody) as RazorpayEventBody;
  } catch {
    return { status: "invalid_payload" };
  }
  const type = typeof body.event === "string" ? body.event : "unknown";
  // Razorpay sends X-Razorpay-Event-Id; fall back to a body digest so identical replays are still caught.
  const eventId = headers.eventId || `sha256:${createHash("sha256").update(rawBody).digest("hex")}`;

  const mapping = RAZORPAY_EVENT_MAP[type];
  const entity = body.payload?.subscription?.entity;

  try {
    return await db.$transaction(async (tx) => {
      // Insert first: unique(provider,eventId) makes concurrent/replayed deliveries fail with P2002.
      await tx.webhookEvent.create({
        data: { provider: "razorpay", eventId, type, payload: body as unknown as Prisma.InputJsonValue },
      });
      if (!mapping || !entity?.id) return { status: "ignored", eventId, reason: `unhandled event ${type}` } as const;

      const existing = await tx.subscription.findUnique({ where: { providerSubscriptionId: entity.id } });
      const noteOrg = entity.notes?.organizationId;
      const organizationId = existing?.organizationId ?? (typeof noteOrg === "string" ? noteOrg : null);
      if (!organizationId) return { status: "ignored", eventId, reason: "subscription not linked to an organization" } as const;
      const org = await tx.organization.findUnique({ where: { id: organizationId }, select: { id: true, planId: true, status: true } });
      if (!org) return { status: "ignored", eventId, reason: "organization not found" } as const;

      const notePlan = entity.notes?.planId;
      const planId =
        planIdFromRazorpayPlan(entity.plan_id) ??
        (typeof notePlan === "string" && isPlanId(notePlan) && notePlan !== "trial" ? notePlan : null) ??
        existing?.planId ??
        org.planId;

      const subData = {
        planId,
        status: mapping.sub,
        currentPeriodStart: toDate(entity.current_start) ?? existing?.currentPeriodStart ?? null,
        currentPeriodEnd: toDate(entity.current_end) ?? existing?.currentPeriodEnd ?? null,
      };
      if (existing) {
        await tx.subscription.update({ where: { id: existing.id }, data: subData });
      } else {
        await tx.subscription.create({
          data: { ...subData, organizationId, provider: "razorpay", providerSubscriptionId: entity.id },
        });
      }
      if (mapping.sub === "active") {
        // Paid subscription supersedes the trial.
        await tx.subscription.updateMany({ where: { organizationId, status: "trialing" }, data: { status: "expired" } });
      }
      await tx.organization.update({
        where: { id: organizationId },
        data: { status: mapping.org, ...(mapping.sub === "active" ? { planId } : {}) },
      });
      await tx.auditLog.create({
        data: {
          organizationId,
          actorType: "system",
          action: `billing.${type}`,
          resourceType: "subscription",
          resourceId: entity.id,
          before: { planId: org.planId, status: org.status },
          after: { planId: mapping.sub === "active" ? planId : org.planId, status: mapping.org },
        },
      });
      return { status: "processed", eventId, organizationId } as const;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { status: "duplicate", eventId };
    }
    throw err;
  }
}
