// PATCH /api/admin/orgs/[id] — staff changes to a customer organization (plan, service tier, status, publishing).
// Every change is audit-logged with the stated reason.
import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { reasonSchema, staffAudit } from "@/lib/admin/audit";

const schema = z
  .object({
    publishingEnabled: z.boolean().optional(), // per-tenant publishing kill switch
    status: z.enum(["active", "past_due", "cancelled", "suspended"]).optional(),
    planId: z.enum(["trial", "starter", "growth", "agency"]).optional(),
    serviceTier: z.enum(["fix", "grow", "authority"]).nullable().optional(),
    reason: reasonSchema,
  })
  .refine(
    (v) => v.publishingEnabled !== undefined || v.status !== undefined || v.planId !== undefined || v.serviceTier !== undefined,
    "Nothing to change",
  );

const SELECT = { id: true, name: true, publishingEnabled: true, status: true, planId: true, serviceTier: true } as const;

export const GET = handler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireStaffApi();
  const { id } = await params;
  const item = await db.organization.findUnique({ where: { id }, select: { ...SELECT, createdAt: true, region: true } });
  if (!item) throw new HttpError(404, "not_found", "Organization not found");
  return json({ item });
});

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaffApi();
  const { id } = await params;
  const input = await parseBody(req, schema);
  const before = await db.organization.findUnique({ where: { id }, select: SELECT });
  if (!before) throw new HttpError(404, "not_found", "Organization not found");

  const data = {
    ...(input.publishingEnabled !== undefined ? { publishingEnabled: input.publishingEnabled } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.planId !== undefined ? { planId: input.planId } : {}),
    ...(input.serviceTier !== undefined ? { serviceTier: input.serviceTier } : {}),
  };
  const after = await db.organization.update({ where: { id }, data, select: SELECT });

  const changed = Object.keys(data) as (keyof typeof data)[];
  const action =
    changed.length === 1
      ? ({
          publishingEnabled: "admin.org_publishing_changed",
          status: after.status === "suspended" ? "admin.org_suspended" : before.status === "suspended" ? "admin.org_reactivated" : "admin.org_status_changed",
          planId: "admin.org_plan_changed",
          serviceTier: "admin.org_service_tier_changed",
        } as const)[changed[0]]
      : "admin.org_updated";
  await staffAudit(staff, req, {
    organizationId: id,
    action,
    resourceType: "organization",
    resourceId: id,
    before: Object.fromEntries(changed.map((k) => [k, before[k]])),
    after: Object.fromEntries(changed.map((k) => [k, after[k]])),
    reason: input.reason,
  });
  return json({ item: after });
});
