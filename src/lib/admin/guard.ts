// Staff guard for the admin back-office. Non-staff (and signed-out visitors) get a 404 so the admin surface
// is never revealed. Staff without the permission a page needs are sent to /admin/no-access (pages) or get a
// 403 (APIs). isStaff and staffRoles are always re-read from the database (never trusted from the JWT).
import { notFound, redirect } from "next/navigation";
import { HttpError } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { SessionContext } from "@/lib/types";
import { normalizeRoles, permissionsFor, type Permission, type StaffRole } from "./rbac";

export interface StaffContext {
  session: SessionContext;
  user: { id: string; email: string; name: string | null };
  roles: StaffRole[];
  permissions: Set<Permission>;
  can: (p: Permission) => boolean;
}

export async function loadStaff(): Promise<StaffContext | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, isStaff: true, staffRoles: true },
  });
  if (!user?.isStaff) return null;
  const roles = normalizeRoles(user.staffRoles);
  const permissions = permissionsFor(roles);
  return { session, user: { id: user.id, email: user.email, name: user.name }, roles, permissions, can: (p) => permissions.has(p) };
}

/** Route handlers: 404 for non-staff, 403 for staff missing `permission`. */
export async function requireStaffApi(permission?: Permission): Promise<StaffContext> {
  const staff = await loadStaff();
  if (!staff) throw new HttpError(404, "not_found", "Not found");
  if (permission && !staff.can(permission)) {
    throw new HttpError(403, "forbidden", "Your staff role doesn't include this. Ask a super admin to add it.");
  }
  return staff;
}

/** Server components: 404 page for non-staff, /admin/no-access for staff missing `permission`. */
export async function requireStaffPage(permission?: Permission): Promise<StaffContext> {
  const staff = await loadStaff();
  if (!staff) notFound();
  if (permission && !staff.can(permission)) redirect(`/admin/no-access?need=${encodeURIComponent(permission)}`);
  return staff;
}
