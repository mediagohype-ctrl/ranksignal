import { z } from "zod";
import { handler, json, parseBody, requireSession, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit-log";
import type { Role } from "@/lib/types";

const schema = z.object({ organizationId: z.string().min(1).max(64) });

/** Switch active org. Switching into an org with an "invited" membership accepts the invitation. */
export const POST = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  const { organizationId } = await parseBody(req, schema);
  const m = await db.membership.findUnique({ where: { userId_organizationId: { userId: s.userId, organizationId } } });
  if (!m || (m.status !== "active" && m.status !== "invited")) {
    throw new HttpError(404, "not_found", "Organization not found");
  }
  if (m.status === "invited") {
    await db.membership.update({ where: { id: m.id }, data: { status: "active" } });
    await writeAuditLog({ organizationId, actorId: s.userId, action: "org.invite_accepted", resourceType: "membership", resourceId: m.id });
  }
  await setSessionCookie({ userId: s.userId, email: s.email, organizationId, role: m.role as Role });
  return json({ item: { organizationId, role: m.role } });
});
