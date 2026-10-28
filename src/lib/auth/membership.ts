// Membership helpers shared by auth + org routes.
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import type { Role, SessionContext } from "@/lib/types";

export const ROLES: readonly Role[] = ["owner", "admin", "member", "viewer"] as const;

/** Re-reads the actor's membership from the DB (JWT role may be stale) and enforces a minimum role. */
export async function requireActiveMembership(session: SessionContext, allowed: Role[]) {
  const m = await db.membership.findUnique({
    where: { userId_organizationId: { userId: session.userId, organizationId: session.organizationId } },
  });
  if (!m || m.status !== "active") throw new HttpError(403, "forbidden", "Not a member of this organization");
  if (!allowed.includes(m.role as Role)) throw new HttpError(403, "forbidden", "Insufficient role");
  return m;
}

export async function countActiveOwners(organizationId: string) {
  return db.membership.count({ where: { organizationId, role: "owner", status: "active" } });
}

/** Picks the membership a user lands in after login: oldest active membership. */
export async function defaultMembership(userId: string) {
  return db.membership.findFirst({
    where: { userId, status: "active" },
    orderBy: { createdAt: "asc" },
  });
}
