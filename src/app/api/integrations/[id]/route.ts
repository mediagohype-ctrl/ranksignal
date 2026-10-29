import { db } from "@/lib/db";
import { HttpError, handler, json, requireSession } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit-log";
import { getConnectorForIntegration } from "@/lib/connectors/registry";
import { disconnectGoogleIntegration } from "@/lib/google/integration";
import { auditActorFromSession } from "@/lib/audit-log";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("admin");
  const integration = await db.integration.findFirst({ where: { id, organizationId: s.organizationId } });
  if (!integration) throw new HttpError(404, "not_found", "Integration not found");
  // Google (OAuth) integrations: revoke the refresh token at Google, wipe it and audit-log.
  if (integration.provider === "gsc" || integration.provider === "ga4") {
    await disconnectGoogleIntegration(integration, { userId: s.userId, actorType: auditActorFromSession(s).actorType });
    return json({ item: { id: integration.id, deleted: true } });
  }
  try {
    const connector = await getConnectorForIntegration(integration.id, s.organizationId);
    await connector.disconnect();
  } catch {
    // Best effort: credentials are wiped regardless.
  }
  // Wipe the stored credential first, then remove the row. Pending actions fail closed at the gate.
  await db.integration.update({ where: { id: integration.id }, data: { credentialEncrypted: null, health: "unknown" } });
  await db.integration.delete({ where: { id: integration.id } });
  await writeAuditLog({
    organizationId: s.organizationId, actorId: s.userId, action: "integration.disconnected",
    resourceType: "integration", resourceId: integration.id,
    before: { provider: integration.provider, projectId: integration.projectId, config: integration.config },
    after: { credentialWiped: true },
  });
  return json({ item: { id: integration.id, deleted: true } });
});
