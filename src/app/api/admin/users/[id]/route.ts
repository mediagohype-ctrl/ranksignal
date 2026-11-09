// /api/admin/users/[id]
//   PATCH {isStaff: false, reason}                 — revoke staff (grant on /admin/team); never your own account
//   POST  {action: "password_reset"|"resend_verification", reason} — send account emails
import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/auth/password-reset";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import { requireStaffApi } from "@/lib/admin/guard";
import { reasonSchema, staffAudit } from "@/lib/admin/audit";
import { removeStaff } from "@/lib/admin/team";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({ isStaff: z.boolean(), reason: reasonSchema });
const postSchema = z.object({ action: z.enum(["password_reset", "resend_verification"]), reason: reasonSchema });

// Legacy entry point. Granting staff happens on /admin/team (where roles are chosen); revoking goes through the
// same removeStaff() as the Team page, so the last-super-admin guard and workspace clean-up always apply.
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi("team.manage");
  const { id } = await params;
  const { isStaff, reason } = await parseBody(req, patchSchema);
  if (isStaff) throw new HttpError(400, "use_team_page", "Add people to the team on Team & roles, where you choose their roles.");
  await removeStaff(staff, req, id, reason);
  return json({ item: { id, isStaff: false } });
});

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi("users.manage");
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
