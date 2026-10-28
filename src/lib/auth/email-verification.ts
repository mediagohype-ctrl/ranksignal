// Stateless email-verification tokens (signed JWT, 24h). Delivery is stubbed: link is logged in dev only.
import { SignJWT, jwtVerify } from "jose";
import { BRAND } from "@/lib/brand";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (>= 32 chars)");
  return new TextEncoder().encode(s);
}

export async function createEmailVerificationToken(userId: string, email: string) {
  return new SignJWT({ purpose: "verify_email", email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret());
}

export async function readEmailVerificationToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== "verify_email" || !payload.sub || typeof payload.email !== "string") return null;
    return { userId: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

/** TODO: wire a transactional email provider. Until then the link is only logged outside production. */
export async function sendVerificationEmail(userId: string, email: string) {
  const token = await createEmailVerificationToken(userId, email);
  const link = `${BRAND.appUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  if (process.env.NODE_ENV !== "production") {
    console.info(`[auth] email verification link for ${email}: ${link}`);
  }
}
