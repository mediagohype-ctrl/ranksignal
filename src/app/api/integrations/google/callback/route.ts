// GET /api/integrations/google/callback?code&state — Google redirects here after consent.
// Verifies the signed state + nonce cookie + the signed-in admin, exchanges the code and stores ONLY the refresh
// token (encrypted). The access token is discarded. Always redirects back to the app (never renders tokens).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, requireSession } from "@/lib/api";
import { PRODUCT_SCOPES, appUrl, assertGoogleConfigured } from "@/lib/google/config";
import { GoogleApiError } from "@/lib/google/http";
import { saveGoogleConnection } from "@/lib/google/integration";
import { exchangeCode, revokeToken } from "@/lib/google/oauth";
import { NONCE_COOKIE, verifyOAuthState } from "@/lib/google/state";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

function back(path: string, params: Record<string, string>) {
  const u = new URL(path, appUrl());
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = NextResponse.redirect(u, 302);
  res.cookies.set(NONCE_COOKIE, "", { path: "/api/integrations/google", maxAge: 0 });
  return res;
}

export const GET = handler(async (req: Request) => {
  assertGoogleConfigured();
  const q = new URL(req.url).searchParams;
  const state = await verifyOAuthState(q.get("state"));
  if (!state) return back("/app", { google_error: "invalid_state" });
  const page = `/app/projects/${encodeURIComponent(state.projectId)}/integrations`;

  const cookieNonce = req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${NONCE_COOKIE}=`))
    ?.slice(NONCE_COOKIE.length + 1);
  if (!cookieNonce || cookieNonce !== state.nonce) return back(page, { google_error: "invalid_state" });

  let s;
  try {
    s = await requireSession("admin");
  } catch {
    return back(page, { google_error: "not_signed_in" });
  }
  if (s.userId !== state.userId || s.organizationId !== state.orgId) return back(page, { google_error: "invalid_state" });

  const oauthError = q.get("error");
  if (oauthError) return back(page, { google_error: oauthError === "access_denied" ? "access_denied" : "google_error", product: state.product });
  const code = q.get("code");
  if (!code || code.length > 2048) return back(page, { google_error: "missing_code", product: state.product });

  const project = await db.project.findFirst({ where: { id: state.projectId, organizationId: s.organizationId }, select: { id: true } });
  if (!project) return back("/app", { google_error: "project_not_found" });

  try {
    const t = await exchangeCode(code);
    const needed = PRODUCT_SCOPES[state.product].filter((x) => x.startsWith("https://"));
    if (!needed.every((x) => t.scopes.includes(x))) {
      // Granular consent: the user unticked the data permission. Don't keep a useless token.
      await revokeToken(t.refreshToken);
      return back(page, { google_error: "scope_missing", product: state.product });
    }
    await saveGoogleConnection({
      organizationId: s.organizationId,
      projectId: project.id,
      product: state.product,
      refreshToken: t.refreshToken,
      googleEmail: t.email,
      scopes: t.scopes,
      userId: s.userId,
      actorType: s.staffMode ? "staff" : "user",
    });
    return back(page, { google: state.product });
  } catch (e) {
    log.warn("google.oauth.callback_failed", {
      product: state.product,
      kind: e instanceof GoogleApiError ? e.kind : "error",
      status: e instanceof GoogleApiError ? e.status : undefined,
    });
    const code = e instanceof GoogleApiError && /refresh token/i.test(e.message) ? "no_refresh_token" : "exchange_failed";
    return back(page, { google_error: code, product: state.product });
  }
});
