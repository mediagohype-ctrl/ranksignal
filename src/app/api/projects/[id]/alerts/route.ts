// Project alerts: settings (rules, thresholds, channels, recipients, digest) + recent alert history.
import { handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit-log";
import { clientIp } from "@/lib/auth/rate-limit";
import { alertConfigInputSchema } from "@/lib/alerts/config";
import { getAlertsView, saveAlertConfig } from "@/lib/alerts/server";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

/** GET /api/projects/[id]/alerts → { item: AlertsView } (members list only for admins) */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  const admin = s.role === "admin" || s.role === "owner";
  return json({ item: { ...(await getAlertsView(s.organizationId, project.id, { includeMembers: admin })), canManage: admin } }, NO_STORE);
});

/** PUT /api/projects/[id]/alerts { rules, channels, recipients, digest } (admin+) → { item } */
export const PUT = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("admin");
  const { id } = await params;
  const project = await requireProject(s, id);
  const input = await parseBody(req, alertConfigInputSchema);
  const { before, after } = await saveAlertConfig({ organizationId: s.organizationId, projectId: project.id, userId: s.userId, input });
  try {
    await writeAuditLog({
      organizationId: s.organizationId,
      actorId: s.userId,
      action: "alerts.settings_updated",
      resourceType: "project",
      resourceId: project.id,
      before: before as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
      ip: clientIp(req),
    });
  } catch (e) {
    console.error("[alerts] audit log failed", e instanceof Error ? e.message : e);
  }
  return json({ item: { ...(await getAlertsView(s.organizationId, project.id, { includeMembers: true })), canManage: true } }, NO_STORE);
});
