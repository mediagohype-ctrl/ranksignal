// Server-side staff guard (older call sites). The JWT never carries isStaff or roles; they are re-read from the DB.
import { HttpError } from "@/lib/api";
import { loadStaff } from "@/lib/admin/guard";
import type { Permission } from "@/lib/admin/rbac";

/** Staff context when signed in as staff holding `permission` (if given), else null. */
export async function getStaffUser(permission?: Permission) {
  const staff = await loadStaff();
  if (!staff || (permission && !staff.can(permission))) return null;
  return { ...staff, user: { ...staff.user, isStaff: true as const } };
}

/** API guard: 403 unless signed in as staff holding `permission` (if given). */
export async function requireStaff(permission?: Permission) {
  const staff = await loadStaff();
  if (!staff) throw new HttpError(403, "forbidden", "Staff access required");
  if (permission && !staff.can(permission)) {
    throw new HttpError(403, "forbidden", "Your staff role doesn't include this. Ask a super admin to add it.");
  }
  return { ...staff, user: { ...staff.user, isStaff: true as const } };
}
