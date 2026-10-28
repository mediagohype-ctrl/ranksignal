// Client-shareable report links. Pure helpers (no DB) so they are unit-testable.
//
// State lives in Project.settings.share = { enabled, tokenId }. The public URL carries a JWT signed with a key
// derived from SESSION_SECRET (distinct audience, so a share token can never be used as a session and vice versa):
//   sub = projectId, jti = tokenId, aud = "report-share".
// Revoking = enabled:false, or rotating tokenId (old tokens then fail because jti !== current tokenId).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { BRAND } from "@/lib/brand";

export const SHARE_AUDIENCE = "report-share";
const ISSUER = "ranksignal";

export interface ShareSettings {
  enabled: boolean;
  tokenId: string;
}

export interface ShareClaims {
  projectId: string;
  tokenId: string;
}

/** Separate signing key: HMAC(SESSION_SECRET, purpose label). Never the raw session secret. */
function shareKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (>= 32 chars)");
  return new Uint8Array(createHmac("sha256", s).update("report-share-link-key:v1").digest());
}

/** Random 16-byte id, base64url (22 chars). */
export function newTokenId(): string {
  return randomBytes(16).toString("base64url");
}

export async function signShareToken(c: ShareClaims, o: { expiresInDays?: number } = {}): Promise<string> {
  let jwt = new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(SHARE_AUDIENCE)
    .setSubject(c.projectId)
    .setJti(c.tokenId); // no iat: the same tokenId always yields the same, stable URL
  if (o.expiresInDays) jwt = jwt.setExpirationTime(`${Math.round(o.expiresInDays * 86_400)}s`);
  return jwt.sign(shareKey());
}

/** Signature + audience check only. Callers must still compare against the project's current share settings. */
export async function verifyShareToken(token: string | undefined | null): Promise<ShareClaims | null> {
  if (!token || token.length > 2048) return null;
  try {
    const { payload } = await jwtVerify(token, shareKey(), { algorithms: ["HS256"], audience: SHARE_AUDIENCE, issuer: ISSUER });
    if (typeof payload.sub !== "string" || !payload.sub || typeof payload.jti !== "string" || !payload.jti) return null;
    return { projectId: payload.sub, tokenId: payload.jti };
  } catch {
    return null;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Read Project.settings.share defensively; null when never configured or malformed. */
export function readShareSettings(settings: unknown): ShareSettings | null {
  if (!isObj(settings) || !isObj(settings.share)) return null;
  const { enabled, tokenId } = settings.share;
  if (typeof tokenId !== "string" || !tokenId) return null;
  return { enabled: enabled === true, tokenId };
}

/** New settings object with `share` replaced; every other key is preserved as-is. */
export function mergeShareSettings(settings: unknown, share: ShareSettings): Record<string, unknown> {
  const base = isObj(settings) ? settings : {};
  return { ...base, share: { enabled: share.enabled, tokenId: share.tokenId } };
}

/** The verified token is only honoured while sharing is enabled and its jti is the current tokenId. */
export function isShareActive(settings: unknown, claims: ShareClaims): boolean {
  const share = readShareSettings(settings);
  if (!share || !share.enabled) return false;
  const a = Buffer.from(share.tokenId);
  const b = Buffer.from(claims.tokenId);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function shareUrl(token: string, appUrl: string = BRAND.appUrl): string {
  return `${appUrl.replace(/\/+$/, "")}/r/${token}`;
}
