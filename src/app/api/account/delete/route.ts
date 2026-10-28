import { z } from "zod";
import { handler, json, parseBody, requireSession, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { clearSessionCookie } from "@/lib/auth/session";
import { checkRateLimit, clientIp } from "@/lib/auth/rate-limit";
import { verifyPassword } from "@/lib/auth/password";
import { executeAccountDeletion, loadMembershipsForDeletion, planAccountDeletion } from "@/lib/auth/account";
import { writeAuditLog } from "@/lib/audit-log";

const schema = z.object({
  password: z.string().min(1, "Enter your password.").max(200),
  confirm: z.literal("DELETE", { errorMap: () => ({ message: 'Type DELETE to confirm.' }) }),
});

/**
 * POST {password, confirm:"DELETE"} — permanently delete my account.
 * Sole owner of a workspace with other members → 409 (transfer ownership first).
 * Sole member of a workspace → that workspace and all its data are deleted too.
 */
export const POST = handler(async (req: Request) => {
  const s = await requireSession("viewer");
  const ip = clientIp(req);
  if (!checkRateLimit(`acct-delete:${s.userId}`, 5, 15 * 60 * 1000).allowed) {
    throw new HttpError(429, "rate_limited", "Too many attempts. Please wait a few minutes and try again.");
  }
  const input = await parseBody(req, schema);
  const user = await db.user.findUniqueOrThrow({ where: { id: s.userId }, select: { id: true, passwordHash: true } });
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw new HttpError(400, "invalid_password", "That password isn't right.", { fieldErrors: { password: ["That password isn't right."] } });
  }

  const plan = planAccountDeletion(await loadMembershipsForDeletion(s.userId));
  if (plan.blocked.length > 0) {
    const names = plan.blocked.map((b) => b.organizationName).join(", ");
    throw new HttpError(
      409,
      "transfer_ownership",
      `You're the only owner of ${names}, which has other members. Make someone else an owner (Settings → Members) or remove the other members first.`,
      { organizations: plan.blocked },
    );
  }

  // Org-scoped audit rows are deleted with their org, so the erasure record is written without an org.
  for (const organizationId of plan.leaveOrganizations) {
    await writeAuditLog({ organizationId, actorId: s.userId, action: "org.member_left_account_deleted", resourceType: "user", resourceId: s.userId, ip });
  }
  await executeAccountDeletion(s.userId, plan);
  await writeAuditLog({
    organizationId: null,
    actorId: s.userId,
    action: "account.deleted",
    resourceType: "user",
    resourceId: s.userId,
    after: { deletedOrganizations: plan.deleteOrganizations, leftOrganizations: plan.leaveOrganizations },
    ip,
  });
  await clearSessionCookie();
  return json({ ok: true, deletedOrganizations: plan.deleteOrganizations.length });
});
