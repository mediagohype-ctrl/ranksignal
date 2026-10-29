// OAuth 2.0 web-server flow against Google. Only the refresh token is ever persisted (encrypted); access tokens
// live in memory for one request/sync run.
import { decodeJwt } from "jose";
import { PRODUCT_SCOPES, googleClient, googleRedirectUri, type GoogleProduct } from "./config";
import { GoogleApiError, googleFetch } from "./http";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export function buildAuthUrl(product: GoogleProduct, state: string, loginHint?: string): string {
  const { clientId } = googleClient();
  const u = new URL(AUTH_ENDPOINT);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", googleRedirectUri());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", PRODUCT_SCOPES[product].join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "false");
  u.searchParams.set("state", state);
  if (loginHint) u.searchParams.set("login_hint", loginHint);
  return u.toString();
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  expires_in?: number;
}

export interface ExchangedTokens {
  refreshToken: string;
  accessToken: string;
  email: string | null;
  scopes: string[];
}

/** id_token comes straight from Google's token endpoint over TLS, so reading its claims without re-verifying is acceptable (OIDC §3.1.3.7). */
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const claims = decodeJwt(idToken);
    return typeof claims.email === "string" ? claims.email.slice(0, 320) : null;
  } catch {
    return null;
  }
}

export async function exchangeCode(code: string): Promise<ExchangedTokens> {
  const { clientId, clientSecret } = googleClient();
  const t = await googleFetch<TokenResponse>(TOKEN_ENDPOINT, {
    form: { code, client_id: clientId, client_secret: clientSecret, redirect_uri: googleRedirectUri(), grant_type: "authorization_code" },
  });
  if (!t?.access_token) throw new GoogleApiError(502, "error", "Google didn't return an access token");
  if (!t.refresh_token) {
    throw new GoogleApiError(400, "bad_request", "Google didn't return a refresh token. Remove the app's access in your Google account and connect again.");
  }
  return {
    refreshToken: t.refresh_token,
    accessToken: t.access_token,
    email: emailFromIdToken(t.id_token),
    scopes: (t.scope ?? "").split(" ").filter(Boolean),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = googleClient();
  const t = await googleFetch<TokenResponse>(TOKEN_ENDPOINT, {
    form: { refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" },
  });
  if (!t?.access_token) throw new GoogleApiError(401, "auth", "Google didn't return an access token");
  return t.access_token;
}

/** Best effort: revoking an already-revoked token returns 400, which is fine. */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    await googleFetch(REVOKE_ENDPOINT, { form: { token }, timeoutMs: 10_000 });
    return true;
  } catch {
    return false;
  }
}
