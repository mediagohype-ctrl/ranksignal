// Signed, httpOnly session cookie (JWT via jose). Server-only.
// Each session carries `pwf`, a fingerprint of the user's password hash at sign-in, so changing or
// resetting the password ends every other session immediately.
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { passwordFingerprint } from "@/lib/auth/password-reset";
import type { Role, SessionContext } from "@/lib/types";

const COOKIE = "av_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (>= 32 chars)");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(ctx: SessionContext, pwf: string) {
  return new SignJWT({ email: ctx.email, org: ctx.organizationId, role: ctx.role, pwf })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(ctx.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

async function currentFingerprint(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  return user ? passwordFingerprint(user.passwordHash) : null;
}

export async function verifySessionToken(token: string): Promise<SessionContext | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.org !== "string" || typeof payload.pwf !== "string") return null;
    if (payload.pwf !== (await currentFingerprint(payload.sub))) return null; // password changed since sign-in
    return {
      userId: payload.sub,
      email: String(payload.email ?? ""),
      organizationId: payload.org,
      role: (payload.role as Role) ?? "viewer",
    };
  } catch {
    return null;
  }
}

/** Issue a session for the user's CURRENT password; call again after a password change to keep this device signed in. */
export async function setSessionCookie(ctx: SessionContext) {
  const pwf = await currentFingerprint(ctx.userId);
  if (!pwf) throw new Error("Cannot create a session for an unknown user");
  const token = await createSessionToken(ctx, pwf);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<SessionContext | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export const SESSION_COOKIE_NAME = COOKIE;
