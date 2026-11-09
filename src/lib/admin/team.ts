// Staff team management: add staff, set roles, remove access. Guards against locking everyone out.
import { z } from "zod";
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeRoles, STAFF_ROLE_IDS, type StaffRole } from "./rbac";
import { reasonSchema, staffAudit } from "./audit";
import type { StaffContext } from "./guard";

const rolesSchema = z
  .array(z.enum(STAFF_ROLE_IDS as [StaffRole, ...StaffRole[]]))
  .min(1, "Pick at least one role.")
  .max(STAFF_ROLE_IDS.length);

export const addStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  roles: rolesSchema,
  reason: reasonSchema,
});
export const setRolesSchema = z.object({ roles: rolesSchema, reason: reasonSchema });
export const removeStaffSchema = z.object({ reason: reasonSchema });

/** True when `next` would leave the team with no super admin (counting everyone except `userId`). */
export async function wouldRemoveLastSuperAdmin(userId: string, next: readonly StaffRole[] | null): Promise<boolean> {
  if (next?.includes("super_admin")) return false;
  const others = await db.user.count({ where: { isStaff: true, staffRoles: { has: "super_admin" }, id: { not: userId } } });
  return others === 0;
}

export async function listStaff() {
  const users = await db.user.findMany({
    where: { isStaff: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, staffRoles: true, createdAt: true },
  });
  return users.map((u) => ({ ...u, staffRoles: normalizeRoles(u.staffRoles) }));
}

export async function addStaff(staff: StaffContext, req: Request, input: z.infer<typeof addStaffSchema>) {
  const user = await db.user.findUnique({ where: { email: input.email }, select: { id: true, isStaff: true, staffRoles: true } });
  if (!user) throw new HttpError(404, "user_not_found", "No account uses this email. Ask them to sign up first, then add them here.");
  const roles = normalizeRoles(input.roles);
  const item = await db.user.update({
    where: { id: user.id },
    data: { isStaff: true, staffRoles: roles },
    select: { id: true, email: true, staffRoles: true },
  });
  await staffAudit(staff, req, {
    action: user.isStaff ? "admin.staff_roles_changed" : "admin.staff_granted",
    resourceType: "user",
    resourceId: user.id,
    before: { isStaff: user.isStaff, staffRoles: user.staffRoles },
    after: { isStaff: true, staffRoles: roles },
    reason: input.reason,
  });
  return item;
}

export async function setStaffRoles(staff: StaffContext, req: Request, userId: string, input: z.infer<typeof setRolesSchema>) {
  if (userId === staff.user.id) throw new HttpError(400, "cannot_change_self", "You can't change your own roles. Ask another super admin.");
  const before = await db.user.findUnique({ where: { id: userId }, select: { isStaff: true, staffRoles: true } });
  if (!before?.isStaff) throw new HttpError(404, "not_found", "Staff member not found");
  const roles = normalizeRoles(input.roles);
  if (await wouldRemoveLastSuperAdmin(userId, roles)) throw new HttpError(409, "last_super_admin", "Keep at least one super admin on the team.");
  const item = await db.user.update({ where: { id: userId }, data: { staffRoles: roles }, select: { id: true, email: true, staffRoles: true } });
  await staffAudit(staff, req, {
    action: "admin.staff_roles_changed",
    resourceType: "user",
    resourceId: userId,
    before: { staffRoles: before.staffRoles },
    after: { staffRoles: roles },
    reason: input.reason,
  });
  return item;
}

export async function removeStaff(staff: StaffContext, req: Request, userId: string, reason: string) {
  if (userId === staff.user.id) throw new HttpError(400, "cannot_change_self", "You can't remove your own staff access.");
  const before = await db.user.findUnique({ where: { id: userId }, select: { isStaff: true, staffRoles: true } });
  if (!before?.isStaff) throw new HttpError(404, "not_found", "Staff member not found");
  if (await wouldRemoveLastSuperAdmin(userId, null)) throw new HttpError(409, "last_super_admin", "Keep at least one super admin on the team.");
  await db.user.update({ where: { id: userId }, data: { isStaff: false, staffRoles: [] } });
  await staffAudit(staff, req, {
    action: "admin.staff_revoked",
    resourceType: "user",
    resourceId: userId,
    before: { isStaff: true, staffRoles: before.staffRoles },
    after: { isStaff: false, staffRoles: [] },
    reason,
  });
}
