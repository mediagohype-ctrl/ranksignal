// "Continue with Google" sign-in (OpenID Connect authorization-code flow). Reuses the Google OAuth client from
// Search Console (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) with its own redirect URI (/api/auth/google/callback),
// its own state audience and only the `openid email profile` scopes. No Google tokens are stored.
//
// CSRF: /start sets a random nonce in a short-lived httpOnly cookie and signs it into `state`; /callback requires the
// cookie, the signed state and the id_token's `nonce` claim to all match.
import { createHmac, randomBytes } from "node:crypto";
import { SignJWT, decodeJwt, jwtVerify } from "jose";
import { appUrl, googleClient, isGoogleConfigured } from "@/lib/google/config";
import { GoogleApiError, googleFetch } from "@/lib/google/http";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export const LOGIN_SCOPES = ["openid", "email", "profile"] as const;
export const LOGIN_STATE_AUDIENCE = "google-login";
export const LOGIN_STATE_TTL_SECONDS = 600;
export const LOGIN_NONCE_COOKIE = "g_login_nonce";
export const LOGIN_COOKIE_PATH = "/api/auth/google";

export function isGoogleLoginConfigured(): boolean {
  return isGoogleConfigured();
}

export function googleLoginRedirectUri(): string {
  return `${appUrl()}/api/auth/google/callback`;
}

export interface LoginState {
  /** Same-origin path to open after sign-in (already validated with safeNext). */
  next: string;
  /** Referral code from ?ref= (new accounts only). */
  ref?: string;
  nonce: string;
}

function stateKey(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (>= 32 chars)");
  return new Uint8Array(createHmac("sha256", s).update("google-login-state:v1").digest());
}

export async function signLoginState(o: { next: string; ref?: string | null }): Promise<{ token: string; nonce: string }> {
  const nonce = randomBytes(18).toString("base64url");
  const token = await new SignJWT({ nxt: o.next, ...(o.ref ? { ref: o.ref } : {}), nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(LOGIN_STATE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${LOGIN_STATE_TTL_SECONDS}s`)
    .sign(stateKey());
  return { token, nonce };
}

export async function verifyLoginState(token: string | null | undefined): Promise<LoginState | null> {
  if (!token || token.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(token, stateKey(), { audience: LOGIN_STATE_AUDIENCE, algorithms: ["HS256"] });
    const { nxt, ref, nonce } = payload as Record<string, unknown>;
    if (typeof nxt !== "string" || typeof nonce !== "string") return null;
    return { next: nxt, nonce, ...(typeof ref === "string" ? { ref } : {}) };
  } catch {
    return null;
  }
}

export function buildLoginAuthUrl(state: string, nonce: string, loginHint?: string): string {
  const { clientId } = googleClient();
  const u = new URL(AUTH_ENDPOINT);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", googleLoginRedirectUri());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", LOGIN_SCOPES.join(" "));
  u.searchParams.set("prompt", "select_account");
  u.searchParams.set("state", state);
  u.searchParams.set("nonce", nonce);
  if (loginHint) u.searchParams.set("login_hint", loginHint);
  return u.toString();
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/**
 * Validates id_token claims. The token comes straight from Google's token endpoint over TLS, so its signature need
 * not be re-checked (OIDC Core §3.1.3.7), but issuer, audience, expiry and our nonce must still match.
 */
export function profileFromIdToken(claims: Record<string, unknown>, expected: { clientId: string; nonce: string; nowSec?: number }): GoogleProfile | null {
  const now = expected.nowSec ?? Math.floor(Date.now() / 1000);
  if (typeof claims.iss !== "string" || !ISSUERS.has(claims.iss)) return null;
  const aud = claims.aud;
  if (!(aud === expected.clientId || (Array.isArray(aud) && aud.includes(expected.clientId)))) return null;
  if (typeof claims.exp !== "number" || claims.exp < now - 60) return null;
  if (claims.nonce !== expected.nonce) return null;
  if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255) return null;
  if (typeof claims.email !== "string" || !claims.email.includes("@") || claims.email.length > 254) return null;
  const verified = claims.email_verified === true || claims.email_verified === "true";
  const name = typeof claims.name === "string" && claims.name.trim() ? claims.name.trim().slice(0, 120) : null;
  return { sub: claims.sub, email: claims.email.trim().toLowerCase(), emailVerified: verified, name };
}

export async function exchangeLoginCode(code: string, nonce: string): Promise<GoogleProfile | null> {
  const { clientId, clientSecret } = googleClient();
  const t = await googleFetch<{ id_token?: string }>(TOKEN_ENDPOINT, {
    form: { code, client_id: clientId, client_secret: clientSecret, redirect_uri: googleLoginRedirectUri(), grant_type: "authorization_code" },
  });
  if (!t?.id_token) throw new GoogleApiError(502, "error", "Google didn't return an id_token");
  let claims: Record<string, unknown>;
  try {
    claims = decodeJwt(t.id_token) as Record<string, unknown>;
  } catch {
    return null;
  }
  return profileFromIdToken(claims, { clientId, nonce });
}

/* ------------------------------------------------------------------ account linking (pure) */

export interface LinkCandidate {
  id: string;
  googleId: string | null;
  emailVerified: boolean;
  /** True for invitation placeholders (never signed up) and unverified password accounts. */
  hasUnprovenPassword: boolean;
}

export type GoogleLoginDecision =
  | { kind: "signin"; userId: string }
  | {
      kind: "link";
      userId: string;
      /**
       * Replace the password hash: the account's email was never proven, so whoever set that password may not own
       * the inbox (pre-registration takeover). Rotating the hash also ends every session they hold.
       */
      resetPassword: boolean;
    }
  | { kind: "create" }
  | { kind: "reject"; reason: "email_unverified" | "google_mismatch" };

/**
 * Decide what a Google sign-in does:
 *  1. A user already linked to this Google account (by googleId) signs in.
 *  2. Otherwise Google must vouch for the email (email_verified) before we link or create anything.
 *  3. A user with the same email but a DIFFERENT linked Google account is refused (never re-link silently).
 *  4. A user with the same email and no Google link is linked (and marked verified).
 *  5. Nobody matches: create a new account.
 */
export function resolveGoogleLogin(profile: GoogleProfile, byGoogleId: LinkCandidate | null, byEmail: LinkCandidate | null): GoogleLoginDecision {
  if (byGoogleId) return { kind: "signin", userId: byGoogleId.id };
  if (!profile.emailVerified) return { kind: "reject", reason: "email_unverified" };
  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== profile.sub) return { kind: "reject", reason: "google_mismatch" };
    return { kind: "link", userId: byEmail.id, resetPassword: byEmail.hasUnprovenPassword };
  }
  return { kind: "create" };
}

/** New accounts go straight to setup (keeping a free-check ?website= handoff or an invitation); others to `next`. */
export function nextAfterGoogleLogin(next: string, created: boolean): string {
  if (!created) return next;
  return next.startsWith("/app/onboarding") || next.startsWith("/accept-invite") ? next : "/app/onboarding";
}
