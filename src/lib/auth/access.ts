// Single source of truth for "may this session act in this organization, and with which role?".
// Used by API routes (requireSession) and app pages (requireAppSession).
import { db } from "@/lib/db";
import type { Role, SessionContext } from "@/lib/types";

/**
 * Re-reads access on every request so removals and role changes apply immediately.
 * - Active membership -> the membership's current role.
 * - Staff "support mode" (token issued by POST /api/admin/orgs/[id]/enter) -> "admin", only while the user is still staff.
 * Returns null when the session no longer has access.
 */
export async function resolveAccess(token: SessionContext): Promise<SessionContext | null> {
  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: token.userId, organizationId: token.organizationId } },
    select: { role: true, status: true },
  });
  if (membership?.status === "active") return { ...token, role: membership.role as Role, staffMode: false };
  if (token.staffMode) {
    const user = await db.user.findUnique({ where: { id: token.userId }, select: { isStaff: true } });
    if (user?.isStaff) return { ...token, role: "admin", staffMode: true };
  }
  return null;
}
