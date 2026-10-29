// Org invitation links (aud "org-invite", 7 days, sub = membershipId) + email delivery.
import { readToken, signToken } from "./tokens";
import { appLink, inviteTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";
import { HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { checkRateLimit } from "./rate-limit";

/** Global cap on invitation emails one person can send per day, across every workspace they admin. */
export const INVITES_PER_USER_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Anti-phishing guard for anything that emails an invitation on a user's behalf: the sender must have verified
 * their own email (so invites can't come from throwaway sign-ups using someone else's address), and each user
 * may send at most INVITES_PER_USER_PER_DAY invitations per day. Counts attempts, including ones that fail later.
 */
export async function assertCanSendInvites(userId: string, now = Date.now()): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { emailVerified: true } });
  if (!user?.emailVerified) {
    throw new HttpError(403, "email_unverified", "Verify your email address before inviting teammates. Check your inbox for the link, or resend it from your account page.");
  }
  if (!checkRateLimit(`invite-user:${userId}`, INVITES_PER_USER_PER_DAY, DAY_MS, now).allowed) {
    throw new HttpError(429, "rate_limited", `You can send up to ${INVITES_PER_USER_PER_DAY} invitations a day. Please try again tomorrow.`);
  }
}

export async function createInviteToken(membershipId: string, email: string) {
  return signToken("org-invite", membershipId, { email }, "7d");
}

export async function readInviteToken(token: string): Promise<{ membershipId: string; email: string } | null> {
  const p = await readToken("org-invite", token);
  if (!p || typeof p.email !== "string") return null;
  return { membershipId: p.sub, email: p.email };
}

export async function sendInviteEmail(o: {
  membershipId: string;
  email: string;
  role: string;
  organizationName: string;
  inviterName: string;
}) {
  const token = await createInviteToken(o.membershipId, o.email);
  const link = appLink(`/accept-invite?token=${encodeURIComponent(token)}`);
  return sendEmail({ to: o.email, ...inviteTemplate({ inviterName: o.inviterName, organizationName: o.organizationName, role: o.role, link }) });
}
