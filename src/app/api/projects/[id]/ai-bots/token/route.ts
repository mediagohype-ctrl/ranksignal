// Ingest token for this project: POST creates or rotates it (shown once), DELETE revokes it. Admins and owners only.
import { db } from "@/lib/db";
import { handler, HttpError, json, requireProject, requireSession } from "@/lib/api";
import { writeAuditLog, auditActorFromSession } from "@/lib/audit-log";
import { generateIngestToken } from "@/lib/ai-bots-analytics/ingest";
import { aiBotLimitsFor } from "@/lib/ai-bots-analytics/limits";
import { planIdForOrg } from "@/lib/ai-bots-analytics/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("admin");
  const { id } = await params;
  const project = await requireProject(s, id);
  if (!aiBotLimitsFor(await planIdForOrg(s.organizationId)).ingest) {
    throw new HttpError(402, "plan_required", "Live crawler logging is included from the Starter plan. Log uploads work on every plan.");
  }
  const { token, hash, prefix } = generateIngestToken();
  const existing = await db.aiBotIngestKey.findFirst({ where: { organizationId: s.organizationId, projectId: project.id } });
  if (existing) {
    await db.aiBotIngestKey.update({ where: { id: existing.id }, data: { tokenHash: hash, tokenPrefix: prefix, createdById: s.userId, createdAt: new Date(), lastUsedAt: null } });
  } else {
    await db.aiBotIngestKey.create({ data: { organizationId: s.organizationId, projectId: project.id, tokenHash: hash, tokenPrefix: prefix, createdById: s.userId } });
  }
  await writeAuditLog({
    organizationId: s.organizationId, ...auditActorFromSession(s), action: existing ? "ai_bots.token_rotated" : "ai_bots.token_created",
    resourceType: "project", resourceId: project.id, after: { prefix },
  });
  // The only time the full token leaves the server.
  return json({ item: { token, prefix } });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("admin");
  const { id } = await params;
  const project = await requireProject(s, id);
  const { count } = await db.aiBotIngestKey.deleteMany({ where: { organizationId: s.organizationId, projectId: project.id } });
  if (count) {
    await writeAuditLog({ organizationId: s.organizationId, ...auditActorFromSession(s), action: "ai_bots.token_revoked", resourceType: "project", resourceId: project.id });
  }
  return json({ ok: true });
});
