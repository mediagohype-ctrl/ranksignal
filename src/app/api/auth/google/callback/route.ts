// GET /api/auth/google/callback?code&state — Google redirects here after "Continue with Google".
// Verifies the signed state + nonce cookie (+ the id_token nonce), then signs in, links or creates the account
// (resolveGoogleLogin) and sets the same session cookie as email sign-in. Always redirects; never renders tokens.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { appUrl } from "@/lib/google/config";
import { GoogleApiError } from "@/lib/google/http";
import { setSessionCookie } from "@/lib/auth/session";
import { hashPassword, UNUSABLE_PASSWORD } from "@/lib/auth/password";
import { defaultMembership } from "@/lib/auth/membership";
import { clientIp } from "@/lib/auth/rate-limit";
import { createOwnerWorkspace } from "@/lib/auth/create-account";
import {
  LOGIN_COOKIE_PATH,
  LOGIN_NONCE_COOKIE,
  exchangeLoginCode,
  isGoogleLoginConfigured,
  nextAfterGoogleLogin,
  resolveGoogleLogin,
  verifyLoginState,
  type GoogleProfile,
  type LinkCandidate,
} from "@/lib/auth/google-login";
import { isDisposableEmail } from "@/lib/security/email-policy";
import { placeholderOrgName } from "@/lib/setup/facts";
import { writeAuditLog } from "@/lib/audit-log";
import { log } from "@/lib/log";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

function redirectTo(path: string) {
  const res = NextResponse.redirect(new URL(path, appUrl()), 302);
  res.cookies.set(LOGIN_NONCE_COOKIE, "", { path: LOGIN_COOKIE_PATH, maxAge: 0 });
  return res;
}
const fail = (code: string) => redirectTo(`/login?google_error=${encodeURIComponent(code)}`);

function readCookie(req: Request, name: string): string | undefined {
  return req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/** A password nobody knows (Google users can still set one later with "Forgot password?"). */
const randomPasswordHash = () => hashPassword(randomBytes(32).toString("base64url"));

type UserRow = { id: string; name: string | null; googleId: string | null; emailVerified: boolean; passwordHash: string };

function candidate(u: UserRow | null): LinkCandidate | null {
  return u ? { id: u.id, googleId: u.googleId, emailVerified: u.emailVerified, hasUnprovenPassword: !u.emailVerified || u.passwordHash === UNUSABLE_PASSWORD } : null;
}

export const GET = handler(async (req: Request) => {
  if (!isGoogleLoginConfigured()) return fail("not_configured");
  const q = new URL(req.url).searchParams;
  const state = await verifyLoginState(q.get("state"));
  const cookieNonce = readCookie(req, LOGIN_NONCE_COOKIE);
  if (!state || !cookieNonce || cookieNonce !== state.nonce) return fail("invalid_state");
  if (q.get("error")) return fail(q.get("error") === "access_denied" ? "access_denied" : "google_error");
  const code = q.get("code");
  if (!code || code.length > 2048) return fail("google_error");

  let profile: GoogleProfile | null;
  try {
    profile = await exchangeLoginCode(code, state.nonce);
  } catch (e) {
    log.warn("google.login.exchange_failed", {
      kind: e instanceof GoogleApiError ? e.kind : "error",
      status: e instanceof GoogleApiError ? e.status : undefined,
    });
    return fail("google_error");
  }
  if (!profile) return fail("invalid_state");
  const p = profile;

  const select = { id: true, name: true, googleId: true, emailVerified: true, passwordHash: true } as const;
  const [byGoogleId, byEmail] = await Promise.all([
    db.user.findUnique({ where: { googleId: p.sub }, select }),
    db.user.findUnique({ where: { email: p.email }, select }),
  ]);
  const decision = resolveGoogleLogin(p, candidate(byGoogleId), candidate(byEmail));
  if (decision.kind === "reject") return fail(decision.reason);
  const ip = clientIp(req);

  let userId: string;
  let created = false;
  try {
    if (decision.kind === "signin") {
      userId = decision.userId;
    } else if (decision.kind === "link") {
      userId = decision.userId;
      await db.user.update({
        where: { id: userId },
        data: {
          googleId: p.sub,
          emailVerified: true,
          ...(decision.resetPassword ? { passwordHash: await randomPasswordHash() } : {}),
          ...(!byEmail?.name && p.name ? { name: p.name } : {}),
        },
      });
    } else {
      if (isDisposableEmail(p.email)) return fail("disposable_email");
      const passwordHash = await randomPasswordHash();
      const r = await db.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { email: p.email, name: p.name, passwordHash, emailVerified: true, googleId: p.sub } });
        const org = await createOwnerWorkspace(tx, { userId: user.id, organizationName: placeholderOrgName(p.email), ref: state.ref });
        return { user, org };
      });
      userId = r.user.id;
      created = true;
      await writeAuditLog({ organizationId: r.org.id, actorId: userId, action: "auth.signup", resourceType: "user", resourceId: userId, after: { method: "google" }, ip });
    }
  } catch (e) {
    // Two concurrent callbacks for the same Google account / email: the unique index wins; ask them to try again.
    if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") return fail("try_again");
    throw e;
  }

  let membership = await defaultMembership(userId);
  if (!membership) {
    // e.g. an invited placeholder linking with Google: give them their own workspace, like email sign-up does.
    await db.$transaction((tx) => createOwnerWorkspace(tx, { userId, organizationName: placeholderOrgName(p.email), ref: state.ref }));
    membership = await defaultMembership(userId);
    created = true;
  }
  if (!membership) return fail("google_error");

  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true } });
  await setSessionCookie({ userId: user.id, email: user.email, organizationId: membership.organizationId, role: membership.role as Role });
  await writeAuditLog({
    organizationId: membership.organizationId,
    actorId: user.id,
    action: "auth.login",
    resourceType: "user",
    resourceId: user.id,
    after: { method: "google", ...(decision.kind === "link" ? { linked: true } : {}) },
    ip,
  });
  return redirectTo(nextAfterGoogleLogin(state.next, created));
});
