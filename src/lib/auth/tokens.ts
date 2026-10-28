// Purpose-scoped signed tokens. Each purpose gets its own HMAC key derived from SESSION_SECRET and a
// distinct `aud`, so a token minted for one flow (or a session cookie) can never be replayed in another.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export type TokenAudience = "password-reset" | "email-verify" | "org-invite";

export function derivedKey(aud: TokenAudience): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (>= 32 chars)");
  return new Uint8Array(createHmac("sha256", s).update(`ranksignal:token-key:${aud}`).digest());
}

export async function signToken(aud: TokenAudience, sub: string, claims: Record<string, unknown>, ttl: string): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(aud)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(derivedKey(aud));
}

export async function readToken(aud: TokenAudience, token: string): Promise<(JWTPayload & { sub: string }) | null> {
  if (!token || token.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(token, derivedKey(aud), { audience: aud, algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return payload as JWTPayload & { sub: string };
  } catch {
    return null;
  }
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
