// Staff-only guard for the admin back-office. Non-staff (and signed-out visitors) get a 404 so the
// admin surface is never revealed. isStaff is always re-read from the database (never trusted from the JWT).
import { notFound } from "next/navigation";
import { HttpError } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { SessionContext } from "@/lib/types";

export interface StaffContext {
  session: SessionContext;
  user: { id: string; email: string; name: string | null };
}

async function loadStaff(): Promise<StaffContext | null> {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, isStaff: true },
  });
  if (!user?.isStaff) return null;
  return { session, user: { id: user.id, email: user.email, name: user.name } };
}

/** Route handlers: throws HttpError 404 for anyone who is not staff. */
export async function requireStaffApi(): Promise<StaffContext> {
  const staff = await loadStaff();
  if (!staff) throw new HttpError(404, "not_found", "Not found");
  return staff;
}

/** Server components: renders the 404 page for anyone who is not staff. */
export async function requireStaffPage(): Promise<StaffContext> {
  const staff = await loadStaff();
  if (!staff) notFound();
  return staff;
}
