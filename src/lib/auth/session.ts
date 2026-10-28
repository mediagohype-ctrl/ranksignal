// Signed, httpOnly session cookie (JWT via jose). Server-only.
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role, SessionContext } from "@/lib/types";

const COOKIE = "av_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (>= 32 chars)");
  return new TextEncoder().encode(s);
}

export async function createSessionToken(ctx: SessionContext) {
  return new SignJWT({ email: ctx.email, org: ctx.organizationId, role: ctx.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(ctx.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionContext | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.org !== "string") return null;
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

export async function setSessionCookie(ctx: SessionContext) {
  const token = await createSessionToken(ctx);
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
