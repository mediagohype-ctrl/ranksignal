import { handler, json, requireSession, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireActiveMembership } from "@/lib/auth/membership";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { sendInviteEmail } from "@/lib/auth/invite";
import { isEmailConfigured } from "@/lib/email/send";
import { writeAuditLog } from "@/lib/audit-log";

type Ctx = { params: Promise<{ id: string }> };

/** POST — resend the invitation email for a pending (invited) member. Owner/admin only. */
export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("admin");
  await requireActiveMembership(s, ["owner", "admin"]);
  const m = await db.membership.findFirst({
    where: { id, organizationId: s.organizationId, status: "invited" },
    include: { user: { select: { email: true } }, organization: { select: { name: true } } },
  });
  if (!m) throw new HttpError(404, "not_found", "No pending invitation found for this person.");
  if (!isEmailConfigured()) throw new HttpError(503, "email_unavailable", "Email sending isn't set up yet, so we can't resend invitations.");
  if (!checkRateLimit(`invite-resend:${m.id}`, 3, 60 * 60 * 1000).allowed || !checkRateLimit(`invite-org:${s.organizationId}`, 30, 24 * 60 * 60 * 1000).allowed) {
    throw new HttpError(429, "rate_limited", "This invitation was resent recently. Please wait a while before trying again.");
  }

  const inviter = await db.user.findUnique({ where: { id: s.userId }, select: { name: true, email: true } });
  const sent = await sendInviteEmail({
    membershipId: m.id,
    email: m.user.email,
    role: m.role,
    organizationName: m.organization.name,
    inviterName: inviter?.name || inviter?.email || "A teammate",
  });
  if (!sent.ok) throw new HttpError(502, "email_failed", "We couldn't send the email just now. Please try again shortly.");
  await db.membership.update({ where: { id: m.id }, data: { invitedAt: new Date() } });
  await writeAuditLog({ organizationId: s.organizationId, actorId: s.userId, action: "org.invite_resent", resourceType: "membership", resourceId: m.id });
  return json({ ok: true });
});
