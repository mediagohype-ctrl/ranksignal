// One client report template: update (member+; sharing and the org default need admin+) or delete.
import { handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit-log";
import { clientIp } from "@/lib/auth/rate-limit";
import { templatePatchSchema } from "@/lib/report-builder/sections";
import { deleteTemplate, updateTemplate } from "@/lib/report-builder/server";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; templateId: string }> };
const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const isAdmin = (r: Role) => r === "admin" || r === "owner";

/** PATCH { name?, sections?, intro?, notes?, range?, shareEnabled? } → { item } */
export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id, templateId } = await params;
  const project = await requireProject(s, id);
  const patch = await parseBody(req, templatePatchSchema);
  const item = await updateTemplate({ organizationId: s.organizationId, projectId: project.id, templateId, patch, isAdmin: isAdmin(s.role) });
  if (patch.shareEnabled !== undefined) {
    await writeAuditLog({
      organizationId: s.organizationId,
      actorId: s.userId,
      action: patch.shareEnabled ? "report_template.share_enabled" : "report_template.share_disabled",
      resourceType: "report_template",
      resourceId: item.id,
      after: { shareEnabled: item.shareEnabled },
      ip: clientIp(req),
    }).catch((e) => console.error("[report-templates] audit log failed", e instanceof Error ? e.message : e));
  }
  return json({ item }, NO_STORE);
});

/** DELETE → { ok: true } */
export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id, templateId } = await params;
  const project = await requireProject(s, id);
  await deleteTemplate({ organizationId: s.organizationId, projectId: project.id, templateId, isAdmin: isAdmin(s.role) });
  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    action: "report_template.deleted",
    resourceType: "report_template",
    resourceId: templateId,
    ip: clientIp(req),
  }).catch((e) => console.error("[report-templates] audit log failed", e instanceof Error ? e.message : e));
  return json({ ok: true }, NO_STORE);
});
