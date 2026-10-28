import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { checkRateLimit, clientIp, resetRateLimit } from "@/lib/auth/rate-limit";
import { defaultMembership } from "@/lib/auth/membership";
import { writeAuditLog } from "@/lib/audit-log";
import type { Role } from "@/lib/types";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

const GENERIC = "Invalid email or password";

export const POST = handler(async (req: Request) => {
  const input = await parseBody(req, schema);
  const ip = clientIp(req);
  const key = `login:${ip}:${input.email}`;
  const rl = checkRateLimit(key, 5, 15 * 60 * 1000);
  // Also cap per-IP volume to slow credential stuffing across many emails.
  const rlIp = checkRateLimit(`login-ip:${ip}`, 50, 15 * 60 * 1000);
  if (!rl.allowed || !rlIp.allowed) {
    throw new HttpError(429, "rate_limited", "Too many sign-in attempts. Try again later.", { retryAfterSec: rl.retryAfterSec });
  }

  const user = await db.user.findUnique({ where: { email: input.email } });
  // verifyPassword always runs bcrypt (dummy hash for unknown users) so timing doesn't reveal account existence.
  const ok = await verifyPassword(input.password, user?.passwordHash);
  if (!user || !ok) throw new HttpError(401, "invalid_credentials", GENERIC);

  const membership = await defaultMembership(user.id);
  if (!membership) throw new HttpError(403, "no_organization", "Your account is not a member of any active organization.");

  resetRateLimit(key);
  await setSessionCookie({ userId: user.id, email: user.email, organizationId: membership.organizationId, role: membership.role as Role });
  await writeAuditLog({ organizationId: membership.organizationId, actorId: user.id, action: "auth.login", resourceType: "user", resourceId: user.id, ip });
  return json({ item: { userId: user.id, organizationId: membership.organizationId, role: membership.role } });
});
