import { db } from "@/lib/db";
import { HttpError, handler, json, requireSession } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit-log";
import { getConnectorForIntegration } from "@/lib/connectors/registry";
import { publicIntegration } from "@/lib/connectors/serialize";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const s = await requireSession("member");
  const integration = await db.integration.findFirst({ where: { id, organizationId: s.organizationId } });
  if (!integration) throw new HttpError(404, "not_found", "Integration not found");
  let result: { ok: boolean; identity?: string; error?: string };
  try {
    const connector = await getConnectorForIntegration(integration.id, s.organizationId);
    result = await connector.testConnection();
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  }
  const row = await db.integration.update({
    where: { id: integration.id },
    data: { health: result.ok ? "healthy" : "failed", lastSyncAt: new Date() },
  });
  await writeAuditLog({
    organizationId: s.organizationId, actorId: s.userId, action: "integration.tested",
    resourceType: "integration", resourceId: integration.id, after: { ok: result.ok, error: result.error ?? null },
  });
  return json({ item: { ...publicIntegration(row), test: result } });
});
