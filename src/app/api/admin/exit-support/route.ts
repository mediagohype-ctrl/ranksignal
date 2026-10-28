// POST /api/admin/exit-support — leave support mode: re-issue the staff user's session for their own first
// active membership. Accepts JSON (returns {item:{redirect}}) or a plain HTML form post (303 → /admin).
import { handler, json, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth/session";
import type { Role } from "@/lib/types";
import { requireStaffApi } from "@/lib/admin/guard";
import { isFormPost, seeOther, staffAudit } from "@/lib/admin/audit";

export const POST = handler(async (req: Request) => {
  const staff = await requireStaffApi();
  const home = await db.membership.findFirst({
    where: { userId: staff.user.id, status: "active" },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true, role: true },
  });
  if (!home) throw new HttpError(409, "no_home_workspace", "You have no workspace of your own to return to.");

  const left = staff.session.staffMode ? staff.session.organizationId : null;
  await setSessionCookie({ userId: staff.user.id, email: staff.user.email, organizationId: home.organizationId, role: home.role as Role });
  if (left) {
    await staffAudit(staff, req, { organizationId: left, action: "support.exit", resourceType: "organization", resourceId: left });
  }
  return isFormPost(req) ? seeOther("/admin") : json({ item: { redirect: "/admin", organizationId: home.organizationId } });
});
