// /api/admin/users/[id]
//   PATCH {isStaff, reason}                        — grant/revoke staff (never your own account)
//   POST  {action: "password_reset"|"resend_verification", reason} — send account emails
import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/auth/password-reset";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import { requireStaffApi } from "@/lib/admin/guard";
import { reasonSchema, staffAudit } from "@/lib/admin/audit";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({ isStaff: z.boolean(), reason: reasonSchema });
const postSchema = z.object({ action: z.enum(["password_reset", "resend_verification"]), reason: reasonSchema });

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi();
  const { id } = await params;
  const { isStaff, reason } = await parseBody(req, patchSchema);
  if (id === staff.user.id) throw new HttpError(400, "cannot_change_self", "You can't change your own staff access.");
  const before = await db.user.findUnique({ where: { id }, select: { id: true, isStaff: true } });
  if (!before) throw new HttpError(404, "not_found", "User not found");
  const item = await db.user.update({ where: { id }, data: { isStaff }, select: { id: true, email: true, isStaff: true } });
  await staffAudit(staff, req, {
    action: isStaff ? "admin.staff_granted" : "admin.staff_revoked",
    resourceType: "user",
    resourceId: id,
    before: { isStaff: before.isStaff },
    after: { isStaff },
    reason,
  });
  return json({ item });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi();
  const { id } = await params;
  const { action, reason } = await parseBody(req, postSchema);
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, passwordHash: true, emailVerified: true },
  });
  if (!user) throw new HttpError(404, "not_found", "User not found");

  let result: { ok: boolean; skipped?: boolean };
  if (action === "password_reset") {
    result = await sendPasswordResetEmail(user);
  } else {
    if (user.emailVerified) throw new HttpError(409, "already_verified", "This email address is already verified.");
    result = await sendVerificationEmail(user.id, user.email, user.name);
  }
  await staffAudit(staff, req, {
    action: action === "password_reset" ? "admin.password_reset_sent" : "admin.verification_resent",
    resourceType: "user",
    resourceId: id,
    after: { delivered: result.ok, skipped: !!result.skipped },
    reason,
  });
  if (!result.ok) {
    throw new HttpError(503, "email_unavailable", result.skipped ? "Email is not configured on this server." : "The email could not be sent.");
  }
  return json({ item: { sent: true } });
});
