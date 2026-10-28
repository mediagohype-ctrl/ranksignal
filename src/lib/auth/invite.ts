// Org invitation links (aud "org-invite", 7 days, sub = membershipId) + email delivery.
import { readToken, signToken } from "./tokens";
import { appLink, inviteTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";

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
