// GET /api/auth/google/start?next=…&ref=…&website=…&from=signup — "Continue with Google". Public (no session).
// Redirects to Google's account chooser with a signed, short-lived `state` and sets the matching nonce cookie.
import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { appUrl } from "@/lib/google/config";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";
import { cleanRef } from "@/lib/auth/create-account";
import {
  LOGIN_COOKIE_PATH,
  LOGIN_NONCE_COOKIE,
  LOGIN_STATE_TTL_SECONDS,
  buildLoginAuthUrl,
  isGoogleLoginConfigured,
  signLoginState,
} from "@/lib/auth/google-login";
import { safeNext } from "@/app/(auth)/safe-next";

export const dynamic = "force-dynamic";

/** Only a plain http(s) URL (the free-check handoff) is carried into setup. */
function safeWebsite(raw: string | null): string | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export const GET = handler(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const from = q.get("from") === "signup" ? "/signup" : "/login";
  if (!isGoogleLoginConfigured()) return NextResponse.redirect(new URL(`${from}?google_error=not_configured`, appUrl()), 302);
  if (!checkRateLimit(`google-login:${clientIp(req)}`, 30, 15 * 60 * 1000).allowed) {
    return NextResponse.redirect(new URL(`${from}?google_error=rate_limited`, appUrl()), 302);
  }
  const website = safeWebsite(q.get("website"));
  const fallback = website ? `/app/onboarding?website=${encodeURIComponent(website)}` : "/app";
  const next = safeNext(q.get("next"), fallback, appUrl());
  const { token, nonce } = await signLoginState({ next, ref: cleanRef(q.get("ref")) });
  const res = NextResponse.redirect(buildLoginAuthUrl(token, nonce), 302);
  res.cookies.set(LOGIN_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // the redirect back from Google is a top-level GET navigation
    path: LOGIN_COOKIE_PATH,
    maxAge: LOGIN_STATE_TTL_SECONDS,
  });
  return res;
});
