// Server-side staff guard. The JWT never carries isStaff; it is always re-read from the database.
import { HttpError, requireSession } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function getStaffUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, isStaff: true } });
  return user?.isStaff ? { session, user } : null;
}

export async function requireStaff() {
  const session = await requireSession("viewer");
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, isStaff: true } });
  if (!user?.isStaff) throw new HttpError(403, "forbidden", "Staff access required");
  return { session, user };
}
