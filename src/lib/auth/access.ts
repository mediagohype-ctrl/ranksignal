// Single source of truth for "may this session act in this organization, and with which role?".
// Used by API routes (requireSession) and app pages (requireAppSession).
import { db } from "@/lib/db";
import type { Role, SessionContext } from "@/lib/types";
import { permissionsFor } from "@/lib/admin/rbac";

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
    const user = await db.user.findUnique({ where: { id: token.userId }, select: { isStaff: true, staffRoles: true } });
    // Re-checked every request: losing the staff role (or the permission) ends the session in the workspace.
    const perms = user?.isStaff ? permissionsFor(user.staffRoles) : new Set<string>();
    // "View as customer" (readOnly) sessions are viewers; every write API also rejects them (src/middleware.ts).
    if (token.readOnly && perms.has("customers.enter")) return { ...token, role: "viewer", staffMode: true, readOnly: true };
    if (!token.readOnly && perms.has("customers.enter") && perms.has("customers.manage")) return { ...token, role: "admin", staffMode: true };
  }
  return null;
}
