// Signed OAuth `state` (jose HS256). The key is derived from SESSION_SECRET with a purpose label so it can't be
// confused with session tokens, and the audience is "google-oauth". A random nonce is also set as a short-lived
// httpOnly cookie at /start and must match at /callback (binds the flow to the browser that started it).
import { createHmac, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { isGoogleProduct, type GoogleProduct } from "./config";

export const STATE_AUDIENCE = "google-oauth";
export const STATE_TTL_SECONDS = 600;
export const NONCE_COOKIE = "g_oauth_nonce";

export interface OAuthState {
  projectId: string;
  orgId: string;
  userId: string;
  product: GoogleProduct;
  nonce: string;
}

function stateKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (>= 32 chars)");
  return new Uint8Array(createHmac("sha256", s).update("google-oauth-state:v1").digest());
}

export function newNonce(): string {
  return randomBytes(18).toString("base64url");
}

export async function signOAuthState(o: Omit<OAuthState, "nonce"> & { nonce?: string }): Promise<{ token: string; nonce: string }> {
  const nonce = o.nonce ?? newNonce();
  const token = await new SignJWT({ pid: o.projectId, org: o.orgId, prd: o.product, nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(o.userId)
    .setAudience(STATE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SECONDS}s`)
    .sign(stateKey());
  return { token, nonce };
}

/** Returns the state payload, or null when the token is forged, expired, for another audience or malformed. */
export async function verifyOAuthState(token: string | null | undefined): Promise<OAuthState | null> {
  if (!token || token.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(token, stateKey(), { audience: STATE_AUDIENCE, algorithms: ["HS256"] });
    const { pid, org, prd, nonce, sub } = payload as Record<string, unknown>;
    if (typeof pid !== "string" || typeof org !== "string" || typeof sub !== "string" || typeof nonce !== "string") return null;
    if (!isGoogleProduct(prd)) return null;
    return { projectId: pid, orgId: org, userId: sub, product: prd, nonce };
  } catch {
    return null;
  }
}
