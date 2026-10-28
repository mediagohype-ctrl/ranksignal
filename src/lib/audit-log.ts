import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface AuditEntry {
  organizationId?: string | null;
  actorId?: string | null;
  actorType?: "user" | "system" | "staff";
  action: string;
  resourceType?: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  requestId?: string;
  ip?: string;
}

/** Append-only audit trail (blueprint §7, §11). Never pass secrets in before/after. */
export async function writeAuditLog(entry: AuditEntry) {
  await db.auditLog.create({
    data: {
      organizationId: entry.organizationId ?? null,
      actorId: entry.actorId ?? null,
      actorType: entry.actorType ?? "user",
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      before: entry.before === undefined ? Prisma.JsonNull : (entry.before as Prisma.InputJsonValue),
      after: entry.after === undefined ? Prisma.JsonNull : (entry.after as Prisma.InputJsonValue),
      requestId: entry.requestId,
      ip: entry.ip,
    },
  });
}
