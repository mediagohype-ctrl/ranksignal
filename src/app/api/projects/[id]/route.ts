import { Prisma } from "@prisma/client";
import { handler, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/billing/plans";
import { writeAuditLog } from "@/lib/audit-log";
import { projectPatchSchema, readSettings } from "@/lib/dashboard/project-schema";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const item = await requireProject(s, id);
  return json({ item });
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("member");
  const { id } = await params;
  const project = await requireProject(s, id);
  const body = await parseBody(req, projectPatchSchema);

  const data: Prisma.ProjectUpdateInput = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.websiteUrl !== undefined) data.websiteUrl = body.websiteUrl;
  if (body.brandNames !== undefined) data.brandNames = body.brandNames;
  if (body.categories !== undefined) data.categories = body.categories;
  if (body.audience !== undefined) data.audience = body.audience;
  if (body.countries !== undefined) data.countries = body.countries;
  if (body.languages !== undefined) data.languages = body.languages;
  if (body.competitors !== undefined) data.competitors = body.competitors as Prisma.InputJsonValue;
  if (body.keywords !== undefined) data.keywords = body.keywords;

  const before = readSettings(project.settings);
  let automationChanged = false;
  if (body.settings) {
    const org = await db.organization.findUnique({ where: { id: s.organizationId }, select: { planId: true } });
    const plan = getPlan(org?.planId ?? "trial");
    const next = { ...before, ...body.settings };
    if (body.settings.maxPagesPerCrawl !== undefined) next.maxPagesPerCrawl = Math.min(body.settings.maxPagesPerCrawl, plan.maxPagesPerCrawl);
    if (body.settings.automation) {
      next.automation = { allowClassB: body.settings.automation.allowClassB ?? [] };
      automationChanged =
        JSON.stringify([...(before.automation?.allowClassB ?? [])].sort()) !==
        JSON.stringify([...next.automation.allowClassB!].sort());
    }
    data.settings = next as Prisma.InputJsonValue;
  }

  const item = await db.project.update({ where: { id: project.id }, data });
  if (automationChanged) {
    // Automation permissions gate auto-execution — keep an audit trail of who changed them.
    await writeAuditLog({
      organizationId: s.organizationId,
      actorId: s.userId,
      action: "project.automation_updated",
      resourceType: "project",
      resourceId: project.id,
      before: before.automation ?? null,
      after: readSettings(item.settings).automation ?? null,
    });
  }
  return json({ item });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("admin");
  const { id } = await params;
  const project = await requireProject(s, id);
  await db.project.delete({ where: { id: project.id } });
  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    action: "project.deleted",
    resourceType: "project",
    resourceId: project.id,
    before: { name: project.name, websiteUrl: project.websiteUrl },
  });
  return json({ item: { id: project.id, deleted: true } });
});
