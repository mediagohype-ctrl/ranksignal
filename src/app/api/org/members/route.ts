import { z } from "zod";
import { handler, json, parseBody, requireSession, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/auth/membership";
import { UNUSABLE_PASSWORD } from "@/lib/auth/password";
import { getPlan } from "@/lib/billing/plans";
import { writeAuditLog } from "@/lib/audit-log";

const memberSelect = {
  id: true,
  role: true,
  status: true,
  invitedAt: true,
  createdAt: true,
  user: { select: { id: true, email: true, name: true } },
} as const;

export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const items = await db.membership.findMany({
    where: { organizationId: s.organizationId, status: { in: ["active", "invited"] } },
    select: memberSelect,
    orderBy: { createdAt: "asc" },
  });
  return json({ items });
});

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
});

export const POST = handler(async (req: Request) => {
  const s = await requireSession("admin");
  const actor = await requireActiveMembership(s, ["owner", "admin"]);
  const input = await parseBody(req, inviteSchema);
  if (input.role === "owner" && actor.role !== "owner") throw new HttpError(403, "forbidden", "Only owners can invite owners");

  const org = await db.organization.findUniqueOrThrow({ where: { id: s.organizationId }, select: { planId: true } });
  const plan = getPlan(org.planId);
  const seatsUsed = await db.membership.count({ where: { organizationId: s.organizationId, status: { in: ["active", "invited"] } } });
  if (seatsUsed >= plan.seats) {
    throw new HttpError(402, "plan_limit", `Your ${plan.name} plan includes ${plan.seats} seats.`, { limit: plan.seats, current: seatsUsed });
  }

  // Existing user -> invited membership; unknown email -> placeholder user that can claim the account at sign-up.
  const user =
    (await db.user.findUnique({ where: { email: input.email } })) ??
    (await db.user.create({ data: { email: input.email, passwordHash: UNUSABLE_PASSWORD } }));

  const existing = await db.membership.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: s.organizationId } } });
  if (existing && existing.status !== "removed") throw new HttpError(409, "already_member", "This person is already a member or invited");

  const membership = existing
    ? await db.membership.update({ where: { id: existing.id }, data: { role: input.role, status: "invited", invitedAt: new Date() }, select: memberSelect })
    : await db.membership.create({
        data: { userId: user.id, organizationId: s.organizationId, role: input.role, status: "invited", invitedAt: new Date() },
        select: memberSelect,
      });

  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    action: "org.member_invited",
    resourceType: "membership",
    resourceId: membership.id,
    after: { email: input.email, role: input.role },
  });
  // TODO: send invitation email. The invitee accepts by signing in and switching to the org (POST /api/auth/switch-org).
  return json({ item: membership }, { status: 201 });
});
