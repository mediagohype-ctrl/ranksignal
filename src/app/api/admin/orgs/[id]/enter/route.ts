// POST /api/admin/orgs/[id]/enter — staff session inside a customer's workspace (see src/lib/auth/access.ts).
// mode "view" (default) = "View as customer": READ-ONLY (role viewer + readOnly; src/middleware.ts rejects every
// write API). mode "support" = support mode with role admin, for fixing things on the customer's behalf.
// Every entry is audit-logged with a reason.
import { z } from "zod";
import { handler, json, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth/session";
import { requireStaffApi } from "@/lib/admin/guard";
import { isFormPost, reasonSchema, seeOther, staffAudit } from "@/lib/admin/audit";

const schema = z.object({ reason: reasonSchema, mode: z.enum(["view", "support"]).default("view") });

/** Support-mode sessions are short-lived: staff re-enter (with a fresh, audit-logged reason) after 2 hours. */
const SUPPORT_SESSION_MAX_AGE_SECONDS = 2 * 60 * 60;

export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const staff = await requireStaffApi("customers.enter");
  const { id } = await params;
  const form = isFormPost(req);
  let raw: unknown;
  try {
    raw = form ? Object.fromEntries((await req.formData()).entries()) : await req.json();
  } catch {
    throw new HttpError(400, "invalid_body", "Request body must be JSON or a form");
  }
  const { reason, mode } = schema.parse(raw);
  const readOnly = mode === "view";
  if (!readOnly && !staff.can("customers.manage")) {
    throw new HttpError(403, "forbidden", 'Support mode (making changes) needs the "customers.manage" permission. Use "View as customer" instead.');
  }

  const org = await db.organization.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!org) throw new HttpError(404, "not_found", "Organization not found");

  await setSessionCookie(
    {
      userId: staff.user.id,
      email: staff.user.email,
      organizationId: org.id,
      role: readOnly ? "viewer" : "admin",
      staffMode: true,
      ...(readOnly ? { readOnly: true } : {}),
    },
    { maxAgeSeconds: SUPPORT_SESSION_MAX_AGE_SECONDS },
  );
  await staffAudit(staff, req, {
    organizationId: org.id,
    action: readOnly ? "support.view_as_customer" : "support.enter",
    resourceType: "organization",
    resourceId: org.id,
    after: { mode, readOnly, fromOrganizationId: staff.session.organizationId, sessionMaxAgeSeconds: SUPPORT_SESSION_MAX_AGE_SECONDS },
    reason,
  });
  return form ? seeOther("/app") : json({ item: { redirect: "/app", organizationId: org.id, readOnly } });
});
