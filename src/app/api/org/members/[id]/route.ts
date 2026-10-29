import { z } from "zod";
import { handler, json, parseBody, requireSession, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { countActiveOwners, requireActiveMembership } from "@/lib/auth/membership";
import { auditActorFromSession, writeAuditLog } from "@/lib/audit-log";

type Ctx = { params: Promise<{ id: string }> };

async function loadTarget(organizationId: string, id: string) {
  const m = await db.membership.findFirst({ where: { id, organizationId, status: { in: ["active", "invited"] } } });
  if (!m) throw new HttpError(404, "not_found", "Member not found");
  return m;
}

const patchSchema = z.object({ role: z.enum(["owner", "admin", "member", "viewer"]) });

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("admin");
  const actor = await requireActiveMembership(s, ["owner", "admin"]);
  const { role } = await parseBody(req, patchSchema);
  const target = await loadTarget(s.organizationId, id);

  // Only owners may grant or modify the owner role.
  if ((role === "owner" || target.role === "owner") && actor.role !== "owner") {
    throw new HttpError(403, "forbidden", "Only owners can change owner roles");
  }
  if (target.role === "owner" && role !== "owner" && target.status === "active" && (await countActiveOwners(s.organizationId)) <= 1) {
    throw new HttpError(409, "last_owner", "An organization must keep at least one owner");
  }

  const updated = await db.membership.update({ where: { id: target.id }, data: { role } });
  await writeAuditLog({
    organizationId: s.organizationId,
    ...auditActorFromSession(s),
    action: "org.member_role_changed",
    resourceType: "membership",
    resourceId: target.id,
    before: { role: target.role },
    after: { role },
  });
  return json({ item: { id: updated.id, role: updated.role, status: updated.status } });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("viewer");
  const target = await loadTarget(s.organizationId, id);
  const isSelf = target.userId === s.userId;
  // Members may leave; removing others needs owner/admin, and only owners may remove owners.
  const actor = await requireActiveMembership(s, isSelf ? ["owner", "admin", "member", "viewer"] : ["owner", "admin"]);
  if (!isSelf && target.role === "owner" && actor.role !== "owner") throw new HttpError(403, "forbidden", "Only owners can remove owners");
  if (target.role === "owner" && target.status === "active" && (await countActiveOwners(s.organizationId)) <= 1) {
    throw new HttpError(409, "last_owner", "Cannot remove the last owner");
  }

  await db.membership.update({ where: { id: target.id }, data: { status: "removed" } });
  await writeAuditLog({
    organizationId: s.organizationId,
    ...auditActorFromSession(s),
    action: "org.member_removed",
    resourceType: "membership",
    resourceId: target.id,
    before: { role: target.role, status: target.status },
    after: { status: "removed" },
  });
  return json({ ok: true });
});
