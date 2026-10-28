import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { getSession, setSessionCookie } from "@/lib/auth/session";
import { readInviteToken } from "@/lib/auth/invite";
import { writeAuditLog } from "@/lib/audit-log";
import type { Role } from "@/lib/types";

const schema = z.object({ token: z.string().min(10).max(4096) });

/**
 * Accepts an org invitation for the signed-in user. 401 → client sends them to sign in / sign up
 * (with ?next back to the invite page). The invite must belong to the signed-in account.
 */
export const POST = handler(async (req: Request) => {
  const { token } = await parseBody(req, schema);
  const invite = await readInviteToken(token);
  if (!invite) throw new HttpError(400, "invalid_token", "This invitation link is invalid or has expired. Ask the person who invited you to resend it.");

  const membership = await db.membership.findUnique({
    where: { id: invite.membershipId },
    include: { user: { select: { id: true, email: true } }, organization: { select: { id: true, name: true } } },
  });
  if (!membership || membership.user.email !== invite.email || membership.status === "removed") {
    throw new HttpError(410, "invite_revoked", "This invitation is no longer valid. Ask the person who invited you to send a new one.");
  }

  const session = await getSession();
  if (!session) {
    throw new HttpError(401, "unauthorized", "Sign in to accept this invitation.", { email: invite.email, organizationName: membership.organization.name });
  }
  if (session.userId !== membership.userId) {
    throw new HttpError(403, "wrong_account", `This invitation was sent to ${invite.email}. Sign out and sign in with that email to accept it.`);
  }

  if (membership.status === "invited") {
    await db.membership.update({ where: { id: membership.id }, data: { status: "active" } });
    await writeAuditLog({
      organizationId: membership.organizationId,
      actorId: session.userId,
      action: "org.invite_accepted",
      resourceType: "membership",
      resourceId: membership.id,
    });
  }
  // The link arrived at this address, so it proves the user controls the inbox.
  await db.user.updateMany({ where: { id: session.userId, emailVerified: false }, data: { emailVerified: true } });
  await setSessionCookie({ userId: session.userId, email: session.email, organizationId: membership.organizationId, role: membership.role as Role });
  return json({ item: { organizationId: membership.organizationId, organizationName: membership.organization.name, role: membership.role } });
});
