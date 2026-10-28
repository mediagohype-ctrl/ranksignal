// Stateless email-verification tokens (signed JWT, 24h, aud "email-verify"), delivered via sendEmail.
import { readToken, signToken } from "./tokens";
import { appLink, verifyEmailTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/send";

export async function createEmailVerificationToken(userId: string, email: string) {
  return signToken("email-verify", userId, { email }, "24h");
}

export async function readEmailVerificationToken(token: string): Promise<{ userId: string; email: string } | null> {
  const payload = await readToken("email-verify", token);
  if (!payload || typeof payload.email !== "string") return null;
  return { userId: payload.sub, email: payload.email };
}

/** Sends the verification link. Never logs the link or token. */
export async function sendVerificationEmail(userId: string, email: string, name?: string | null) {
  const token = await createEmailVerificationToken(userId, email);
  const link = appLink(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
  return sendEmail({ to: email, ...verifyEmailTemplate({ name, link }) });
}
