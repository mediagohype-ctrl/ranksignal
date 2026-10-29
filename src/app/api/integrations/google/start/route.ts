// GET /api/integrations/google/start?projectId=…&product=gsc|ga4 — admin+ (or staff support mode, which is admin).
// Redirects to Google's consent screen with a signed, short-lived `state` and sets a matching nonce cookie.
import { NextResponse } from "next/server";
import { HttpError, handler, requireProject, requireSession } from "@/lib/api";
import { assertGoogleConfigured } from "@/lib/google/config";
import { buildAuthUrl } from "@/lib/google/oauth";
import { productSchema, projectIdSchema } from "@/lib/google/route-helpers";
import { NONCE_COOKIE, STATE_TTL_SECONDS, signOAuthState } from "@/lib/google/state";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  assertGoogleConfigured();
  const s = await requireSession("admin");
  const q = new URL(req.url).searchParams;
  const projectId = projectIdSchema.safeParse(q.get("projectId"));
  const product = productSchema.safeParse(q.get("product"));
  if (!projectId.success || !product.success) throw new HttpError(400, "invalid_request", "projectId and product (gsc or ga4) are required");
  const project = await requireProject(s, projectId.data);

  const { token, nonce } = await signOAuthState({ projectId: project.id, orgId: s.organizationId, userId: s.userId, product: product.data });
  const res = NextResponse.redirect(buildAuthUrl(product.data, token), 302);
  res.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // Google's redirect back is a top-level GET navigation
    path: "/api/integrations/google",
    maxAge: STATE_TTL_SECONDS,
  });
  return res;
});
