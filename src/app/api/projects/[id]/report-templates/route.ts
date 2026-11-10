// Client report templates for one website (+ the organization default).
import { handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit-log";
import { clientIp } from "@/lib/auth/rate-limit";
import { templateCreateSchema } from "@/lib/report-builder/sections";
import { createProjectTemplate, listTemplates, saveOrgDefault } from "@/lib/report-builder/server";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };
const NO_STORE = { headers: { "Cache-Control": "no-store" } };
const isAdmin = (r: Role) => r === "admin" || r === "owner";

/** GET → { items, orgDefault, limits } (viewer+) */
export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  return json(await listTemplates(s.organizationId, project.id), NO_STORE);
});

/** POST { name, sections, intro, notes, range, shareEnabled?, scope? } → { item }. Project templates: member+; org default: admin+. */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id } = await params;
  const project = await requireProject(s, id);
  const { scope, ...input } = await parseBody(req, templateCreateSchema);
  const orgDefault = scope === "org_default";
  if (orgDefault && !isAdmin(s.role)) {
    return json({ error: { code: "forbidden", message: "Only owners and admins can set the organization default." } }, { status: 403 });
  }
  const item = orgDefault
    ? await saveOrgDefault({ organizationId: s.organizationId, userId: s.userId, input })
    : await createProjectTemplate({ organizationId: s.organizationId, projectId: project.id, userId: s.userId, input, canShare: isAdmin(s.role) });
  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    action: orgDefault ? "report_template.org_default_saved" : "report_template.created",
    resourceType: "report_template",
    resourceId: item.id,
    after: { projectId: orgDefault ? null : project.id, name: item.name, shareEnabled: item.shareEnabled },
    ip: clientIp(req),
  }).catch((e) => console.error("[report-templates] audit log failed", e instanceof Error ? e.message : e));
  return json({ item }, { status: 201, ...NO_STORE });
});
