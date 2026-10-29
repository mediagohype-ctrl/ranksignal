import { z } from "zod";
import { handler, json, parseBody, requireSession, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth/session";
import { auditActorFromSession, writeAuditLog } from "@/lib/audit-log";
import type { Role } from "@/lib/types";

const schema = z.object({ organizationId: z.string().min(1).max(64) });

/**
 * Switch the active org. Only ACTIVE memberships can be switched into, with one exception: a pending invitation
 * may be accepted here when the account's email address is verified (proven inbox ownership, the same proof the
 * emailed invite link gives). Unverified accounts must use the invitation link (/accept-invite).
 */
export const POST = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  const { organizationId } = await parseBody(req, schema);
  const m = await db.membership.findUnique({ where: { userId_organizationId: { userId: s.userId, organizationId } } });
  if (!m || (m.status !== "active" && m.status !== "invited")) {
    throw new HttpError(404, "not_found", "Organization not found");
  }
  if (m.status === "invited") {
    const user = await db.user.findUnique({ where: { id: s.userId }, select: { emailVerified: true } });
    if (!user?.emailVerified) throw new HttpError(404, "not_found", "Organization not found");
    // Compare-and-swap so a revoked/removed invite can't be resurrected by a racing request.
    const accepted = await db.membership.updateMany({ where: { id: m.id, status: "invited" }, data: { status: "active" } });
    if (accepted.count !== 1) throw new HttpError(404, "not_found", "Organization not found");
    await writeAuditLog({
      organizationId,
      ...auditActorFromSession(s),
      action: "org.invite_accepted",
      resourceType: "membership",
      resourceId: m.id,
      after: { via: "switch_org_verified_email" },
    });
  }
  await setSessionCookie({ userId: s.userId, email: s.email, organizationId, role: m.role as Role });
  return json({ item: { organizationId, role: m.role } });
});
