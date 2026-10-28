import { NextResponse } from "next/server";
import { handler, json, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { readEmailVerificationToken, sendVerificationEmail } from "@/lib/auth/email-verification";

/** GET ?token=… — consumes a verification link, then redirects into the app. */
export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const parsed = await readEmailVerificationToken(token);
  if (parsed) {
    await db.user.updateMany({ where: { id: parsed.userId, email: parsed.email }, data: { emailVerified: true } });
  }
  return NextResponse.redirect(new URL(parsed ? "/app?verified=1" : "/login?verify_error=1", url.origin));
});

/** POST — resend the verification link for the signed-in user (dev: logged to console). */
export const POST = handler(async () => {
  const s = await requireSession("viewer");
  const user = await db.user.findUnique({ where: { id: s.userId }, select: { id: true, email: true, emailVerified: true } });
  if (user && !user.emailVerified) await sendVerificationEmail(user.id, user.email);
  return json({ ok: true });
});
