// Server-component helpers: session + tenant-scoped project loading for /app pages.
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { resolveAccess } from "@/lib/auth/access";
import { db } from "@/lib/db";
import type { Role, SessionContext } from "@/lib/types";

export async function requireAppSession(): Promise<SessionContext> {
  const token = await getSession();
  if (!token) redirect("/login");
  // Same membership / staff-support check as API routes, so removed members lose page access immediately.
  const s = await resolveAccess(token);
  if (!s) redirect("/login");
  return s;
}

export async function requireAppProject(projectId: string) {
  const session = await requireAppSession();
  const project = await db.project.findFirst({ where: { id: projectId, organizationId: session.organizationId } });
  if (!project) notFound();
  return { session, project };
}

const RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
export function hasRole(s: SessionContext, min: Role): boolean {
  return RANK[s.role] >= RANK[min];
}
