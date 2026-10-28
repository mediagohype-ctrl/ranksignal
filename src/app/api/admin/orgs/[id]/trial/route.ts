// POST /api/admin/orgs/[id]/trial — extend a trial by 7/14/30 days (from today or the current end, whichever is later).
import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { reasonSchema, staffAudit } from "@/lib/admin/audit";
import { trialEndFor } from "@/lib/admin/metrics";
import { DAY_MS } from "@/lib/admin/params";

const schema = z.object({
  days: z.union([z.literal(7), z.literal(14), z.literal(30)]),
  reason: reasonSchema,
});

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaffApi();
  const { id } = await params;
  const { days, reason } = await parseBody(req, schema);
  const org = await db.organization.findUnique({
    where: { id },
    select: {
      id: true,
      planId: true,
      createdAt: true,
      subscriptions: {
        where: { status: "trialing", trialEndsAt: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, trialEndsAt: true },
      },
    },
  });
  if (!org) throw new HttpError(404, "not_found", "Organization not found");
  if (org.planId !== "trial") {
    throw new HttpError(409, "not_on_trial", "This organization is not on the trial plan. Change the plan to Trial first.");
  }

  const currentEnd = trialEndFor(org, org.subscriptions);
  const base = Math.max(Date.now(), currentEnd.getTime());
  const trialEndsAt = new Date(base + days * DAY_MS);
  const existing = org.subscriptions[0];
  if (existing) {
    await db.subscription.update({ where: { id: existing.id }, data: { trialEndsAt } });
  } else {
    await db.subscription.create({ data: { organizationId: id, provider: "manual", planId: "trial", status: "trialing", trialEndsAt } });
  }
  await staffAudit(staff, req, {
    organizationId: id,
    action: "admin.trial_extended",
    resourceType: "organization",
    resourceId: id,
    before: { trialEndsAt: currentEnd.toISOString() },
    after: { trialEndsAt: trialEndsAt.toISOString(), days },
    reason,
  });
  return json({ item: { trialEndsAt } });
});
