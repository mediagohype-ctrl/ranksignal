// Edge middleware: coarse auth gate + CSRF origin check. Fine-grained authz (roles, staff, tenancy)
// is always re-checked server-side in route handlers / pages. Must not import Prisma or node APIs.
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "av_session"; // keep in sync with SESSION_COOKIE_NAME in src/lib/auth/session.ts
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE)?.value;
  const s = process.env.SESSION_SECRET;
  if (!token || !s || s.length < 32) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(s), { algorithms: ["HS256"] });
    return Boolean(payload.sub && typeof payload.org === "string");
  } catch {
    return false;
  }
}

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Same-origin check: Origin (or Referer fallback) host must equal the request Host. */
function sameOrigin(req: NextRequest): boolean {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const source = req.headers.get("origin") ?? req.headers.get("referer");
  if (!host || !source || source === "null") return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/webhooks/")) return NextResponse.next(); // authenticated by signature
    if (pathname === "/api/health") return NextResponse.next(); // Render health check
    if (MUTATING.has(req.method) && !sameOrigin(req)) {
      return apiError(403, "csrf_rejected", "Cross-origin request rejected");
    }
    if (pathname.startsWith("/api/auth/")) return NextResponse.next();
    if (!(await hasValidSession(req))) return apiError(401, "unauthorized", "Sign in required");
    return NextResponse.next();
  }

  if (pathname === "/app" || pathname.startsWith("/app/") || pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!(await hasValidSession(req))) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/api/:path*"],
};
