// POST /api/admin/orgs/[id]/enter — "support mode": the staff user gets a session inside the customer's
// workspace with role admin and staffMode=true (see src/lib/auth/access.ts). Audit-logged with a reason.
import { z } from "zod";
import { handler, json, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth/session";
import { requireStaffApi } from "@/lib/admin/guard";
import { isFormPost, reasonSchema, seeOther, staffAudit } from "@/lib/admin/audit";

const schema = z.object({ reason: reasonSchema });

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaffApi();
  const { id } = await params;
  const form = isFormPost(req);
  let raw: unknown;
  try {
    raw = form ? Object.fromEntries((await req.formData()).entries()) : await req.json();
  } catch {
    throw new HttpError(400, "invalid_body", "Request body must be JSON or a form");
  }
  const { reason } = schema.parse(raw);

  const org = await db.organization.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!org) throw new HttpError(404, "not_found", "Organization not found");

  await setSessionCookie({ userId: staff.user.id, email: staff.user.email, organizationId: org.id, role: "admin", staffMode: true });
  await staffAudit(staff, req, {
    organizationId: org.id,
    action: "support.enter",
    resourceType: "organization",
    resourceId: org.id,
    after: { fromOrganizationId: staff.session.organizationId },
    reason,
  });
  return form ? seeOther("/app") : json({ item: { redirect: "/app", organizationId: org.id } });
});
