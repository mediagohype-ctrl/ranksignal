import { z } from "zod";
import { handler, json, parseBody, requireSession, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/auth/membership";
import { UNUSABLE_PASSWORD } from "@/lib/auth/password";
import { getPlan } from "@/lib/billing/plans";
import { writeAuditLog } from "@/lib/audit-log";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { sendInviteEmail } from "@/lib/auth/invite";

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
  // Invites send email to arbitrary addresses: cap volume per workspace to prevent abuse.
  if (!checkRateLimit(`invite-org:${s.organizationId}`, 30, 24 * 60 * 60 * 1000).allowed) {
    throw new HttpError(429, "rate_limited", "You've sent a lot of invitations today. Please try again tomorrow.");
  }
  if (input.role === "owner" && actor.role !== "owner") throw new HttpError(403, "forbidden", "Only owners can invite owners");

  const org = await db.organization.findUniqueOrThrow({ where: { id: s.organizationId }, select: { planId: true, name: true } });
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
  // The invitee accepts via the emailed link (/accept-invite) or by switching to the org (POST /api/auth/switch-org).
  const inviter = await db.user.findUnique({ where: { id: s.userId }, select: { name: true, email: true } });
  const sent = await sendInviteEmail({
    membershipId: membership.id,
    email: input.email,
    role: input.role,
    organizationName: org.name,
    inviterName: inviter?.name || inviter?.email || "A teammate",
  }).catch(() => ({ ok: false, skipped: false }));
  return json({ item: membership, emailSent: sent.ok, emailSkipped: Boolean(sent.skipped) }, { status: 201 });
});
