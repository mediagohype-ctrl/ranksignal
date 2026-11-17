// Client-shareable report links. Pure helpers (no DB) so they are unit-testable.
//
// State lives in Project.settings.share = { enabled, tokenId, slug? }. The public URL carries a JWT signed with a key
// derived from SESSION_SECRET (distinct audience, so a share token can never be used as a session and vice versa):
//   sub = projectId, jti = tokenId, aud = "report-share".
// Revoking = enabled:false, or rotating tokenId (old tokens then fail because jti !== current tokenId).
//
// Short links (audit fix 33): settings.share.slug = "<site name>-<10 random chars>" (e.g. /r/gohype-k3m9x2p7qa). The
// random part (31^10 ≈ 8×10^14 combinations, views rate-limited) makes it unguessable; the slug is looked up in
// Project.settings, follows the same enabled switch, and is replaced whenever the link is replaced. The long signed
// links keep working exactly as before.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { BRAND } from "@/lib/brand";

export const SHARE_AUDIENCE = "report-share";
const ISSUER = "ranksignal";

export interface ShareSettings {
  enabled: boolean;
  tokenId: string;
  /** Short link id (newer links only). */
  slug?: string;
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

/** Same look-alike-free alphabet idea as referral codes (no 0/o, 1/i/l): easy to read out and type. */
const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const SLUG_RANDOM_LENGTH = 10;
const SLUG_RE = new RegExp("^(?:[a-z0-9]{1,24}-)?[" + SLUG_ALPHABET + "]{" + SLUG_RANDOM_LENGTH + "}$");

/** True for a short-link id (never true for a signed token, which contains dots). */
export function isShareSlug(v: unknown): v is string {
  return typeof v === "string" && v.length <= 40 && SLUG_RE.test(v);
}

/** "https://www.go-hype.in" → "gohype-k3m9x2p7qa". The readable part is decoration; the random part is the secret. */
export function newShareSlug(websiteUrl?: string | null, rand: (n: number) => Buffer = randomBytes): string {
  let name = "";
  try {
    name = (new URL(websiteUrl ?? "").hostname.replace(/^www\./, "").split(".")[0] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);
  } catch {
    name = "";
  }
  const bytes = rand(SLUG_RANDOM_LENGTH);
  let id = "";
  for (let i = 0; i < SLUG_RANDOM_LENGTH; i++) id += SLUG_ALPHABET[bytes[i]! % SLUG_ALPHABET.length];
  return name ? `${name}-${id}` : id;
}

/** Read Project.settings.share defensively; null when never configured or malformed. */
export function readShareSettings(settings: unknown): ShareSettings | null {
  if (!isObj(settings) || !isObj(settings.share)) return null;
  const { enabled, tokenId, slug } = settings.share;
  if (typeof tokenId !== "string" || !tokenId) return null;
  return { enabled: enabled === true, tokenId, ...(isShareSlug(slug) ? { slug } : {}) };
}

/** New settings object with `share` replaced; every other key is preserved as-is. */
export function mergeShareSettings(settings: unknown, share: ShareSettings): Record<string, unknown> {
  const base = isObj(settings) ? settings : {};
  return { ...base, share: { enabled: share.enabled, tokenId: share.tokenId, ...(share.slug ? { slug: share.slug } : {}) } };
}

const sameSecret = (x: string, y: string) => {
  const a = Buffer.from(x);
  const b = Buffer.from(y);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** The verified token is only honoured while sharing is enabled and its jti is the current tokenId. */
export function isShareActive(settings: unknown, claims: ShareClaims): boolean {
  const share = readShareSettings(settings);
  if (!share || !share.enabled) return false;
  return sameSecret(share.tokenId, claims.tokenId);
}

/** A short link is honoured only while sharing is on and it is the project's current slug. */
export function isSlugActive(settings: unknown, slug: string): boolean {
  const share = readShareSettings(settings);
  return !!share && share.enabled && !!share.slug && sameSecret(share.slug, slug);
}

/** `token` is a signed token or a short-link slug. */
export function shareUrl(token: string, appUrl: string = BRAND.appUrl): string {
  return `${appUrl.replace(/\/+$/, "")}/r/${token}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Score badge (audit fix 41): its own switch in Project.settings.badge = { enabled, tokenId }, independent of the
// report share link, so turning the report link off (or replacing it) never breaks a badge already on a website.
// The badge URL carries a token signed exactly like a share token (jti = badge tokenId).

export interface BadgeSettings {
  enabled: boolean;
  tokenId: string;
}

export function readBadgeSettings(settings: unknown): BadgeSettings | null {
  if (!isObj(settings) || !isObj(settings.badge)) return null;
  const { enabled, tokenId } = settings.badge;
  if (typeof tokenId !== "string" || !tokenId) return null;
  return { enabled: enabled === true, tokenId };
}

export function mergeBadgeSettings(settings: unknown, badge: BadgeSettings): Record<string, unknown> {
  const base = isObj(settings) ? settings : {};
  return { ...base, badge: { enabled: badge.enabled, tokenId: badge.tokenId } };
}

/**
 * Does this badge token show a score?
 *  - Badge settings exist → only while the badge is on and the token is the badge's.
 *  - No badge settings (badges placed before the badge had its own switch) → the old rule: while sharing is on with
 *    the same token. The share API copies such a badge into its own switch before sharing is turned off or replaced,
 *    so those badges keep working.
 */
export function isBadgeActive(settings: unknown, claims: ShareClaims): boolean {
  const badge = readBadgeSettings(settings);
  if (badge) return badge.enabled && sameSecret(badge.tokenId, claims.tokenId);
  return isShareActive(settings, claims);
}

/**
 * Settings to write BEFORE the share link is turned off or replaced: a project whose badge still runs on the share
 * link (no badge settings, sharing on) gets its own badge switch, on, with the same token — so any badge already
 * pasted on a website keeps working. Null when nothing needs to change.
 */
export function preserveBadgeOnShareChange(settings: unknown): BadgeSettings | null {
  if (readBadgeSettings(settings)) return null;
  const share = readShareSettings(settings);
  if (!share || !share.enabled) return null;
  return { enabled: true, tokenId: share.tokenId };
}
