// Audit helper for staff actions in the back-office. Every mutating admin route calls this.
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit-log";
import { clientIp } from "@/lib/auth/rate-limit";
import type { StaffContext } from "./guard";

/** Reason prompt shared by every admin action (ticket number or short explanation). */
export const reasonSchema = z.string().trim().min(3, "Give a short reason (at least 3 characters).").max(500);

export async function staffAudit(
  staff: StaffContext,
  req: Request,
  e: {
    organizationId?: string | null;
    action: string;
    resourceType: string;
    resourceId: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
  },
) {
  await writeAuditLog({
    organizationId: e.organizationId ?? null,
    actorId: staff.user.id,
    actorType: "staff",
    action: e.action,
    resourceType: e.resourceType,
    resourceId: e.resourceId,
    before: e.before,
    after: { ...((e.after as Record<string, unknown> | undefined) ?? {}), ...(e.reason ? { reason: e.reason } : {}), staffEmail: staff.user.email },
    ip: clientIp(req),
  });
}

/** True when the client posted an HTML form (so we answer with a redirect instead of JSON). */
export function isFormPost(req: Request): boolean {
  const ct = req.headers.get("content-type") ?? "";
  return ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");
}

/** 303 redirect with a relative Location (works behind proxies). */
export function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}
