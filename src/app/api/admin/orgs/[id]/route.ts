import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/staff";
import { writeAuditLog } from "@/lib/audit-log";

const schema = z
  .object({
    publishingEnabled: z.boolean().optional(), // per-tenant publishing kill switch
    status: z.enum(["active", "past_due", "cancelled", "suspended"]).optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .refine((v) => v.publishingEnabled !== undefined || v.status !== undefined, "Nothing to change");

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { user } = await requireStaff();
  const input = await parseBody(req, schema);
  const before = await db.organization.findUnique({ where: { id }, select: { publishingEnabled: true, status: true } });
  if (!before) throw new HttpError(404, "not_found", "Organization not found");
  const after = await db.organization.update({
    where: { id },
    data: { publishingEnabled: input.publishingEnabled, status: input.status },
    select: { id: true, publishingEnabled: true, status: true },
  });
  await writeAuditLog({
    organizationId: id,
    actorId: user.id,
    actorType: "staff",
    action: "admin.org_updated",
    resourceType: "organization",
    resourceId: id,
    before,
    after: { publishingEnabled: after.publishingEnabled, status: after.status, reason: input.reason },
  });
  return json({ item: after });
});
