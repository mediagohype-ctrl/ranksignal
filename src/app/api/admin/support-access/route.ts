import { z } from "zod";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi as requireStaff } from "@/lib/admin/guard";
import { clientIp } from "@/lib/auth/rate-limit";
import { writeAuditLog } from "@/lib/audit-log";

const schema = z.object({
  organizationId: z.string().min(1).max(64),
  reason: z.string().trim().min(5).max(500),
});

/**
 * Read-only support view of a tenant. Every access is written to the tenant's audit log (actorType "staff")
 * with the stated reason. Never returns credentials or secrets.
 */
export const POST = handler(async (req: Request) => {
  const { user } = await requireStaff();
  const { organizationId, reason } = await parseBody(req, schema);
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, planId: true, status: true, region: true, publishingEnabled: true, createdAt: true },
  });
  if (!org) throw new HttpError(404, "not_found", "Organization not found");

  await writeAuditLog({
    organizationId,
    actorId: user.id,
    actorType: "staff",
    action: "support.access",
    resourceType: "organization",
    resourceId: organizationId,
    after: { reason, staffEmail: user.email },
    ip: clientIp(req),
  });

  const [members, projects, recentRuns, integrations, subscriptions] = await Promise.all([
    db.membership.findMany({
      where: { organizationId },
      select: { role: true, status: true, user: { select: { email: true, name: true } } },
    }),
    db.project.findMany({ where: { organizationId }, select: { id: true, name: true, websiteUrl: true, createdAt: true } }),
    db.workflowRun.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, kind: true, state: true, error: true, errorClass: true, attempts: true, createdAt: true },
    }),
    db.integration.findMany({
      where: { organizationId },
      select: { id: true, provider: true, health: true, lastSyncAt: true }, // never credentialEncrypted
    }),
    db.subscription.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  return json({ item: { organization: org, members, projects, recentRuns, integrations, subscriptions } });
});
