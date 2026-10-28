import { Prisma } from "@prisma/client";
import { handler, HttpError, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/billing/plans";
import { writeAuditLog } from "@/lib/audit-log";
import {
  SettingsPatchError, mergeSettingsPatch, patchNeedsAdmin, projectPatchSchema, readSchedule, readSettings,
} from "@/lib/dashboard/project-schema";

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
  // Schedules spend credits and automation decides what is published without review: admin+ only.
  if (patchNeedsAdmin(body) && s.role !== "admin" && s.role !== "owner") {
    throw new HttpError(403, "forbidden", "Only owners and admins can change schedules or automatic fixes");
  }

  const data: Prisma.ProjectUpdateInput = {};
  const changed: string[] = [];
  const set = <K extends keyof typeof body>(key: K, apply: () => void) => {
    if (body[key] !== undefined) {
      apply();
      changed.push(String(key));
    }
  };
  set("name", () => (data.name = body.name));
  set("websiteUrl", () => (data.websiteUrl = body.websiteUrl));
  set("brandNames", () => (data.brandNames = body.brandNames));
  set("categories", () => (data.categories = body.categories));
  set("audience", () => (data.audience = body.audience));
  set("countries", () => (data.countries = body.countries));
  set("languages", () => (data.languages = body.languages));
  set("competitors", () => (data.competitors = body.competitors as Prisma.InputJsonValue));
  set("keywords", () => (data.keywords = body.keywords));

  const before = readSettings(project.settings);
  let automationChanged = false;
  let scheduleChanged = false;
  if (body.settings) {
    const org = await db.organization.findUnique({ where: { id: s.organizationId }, select: { planId: true } });
    try {
      // Only known keys are merged; server-owned keys (e.g. `share`) keep their stored value.
      const merged = mergeSettingsPatch(before, body.settings, getPlan(org?.planId ?? "trial"));
      automationChanged = merged.automationChanged;
      scheduleChanged = merged.scheduleChanged;
      changed.push(...merged.changed);
      data.settings = merged.next as Prisma.InputJsonValue;
    } catch (e) {
      if (e instanceof SettingsPatchError) throw new HttpError(400, e.code, e.message);
      throw e;
    }
  }

  const item = await db.project.update({ where: { id: project.id }, data });
  const after = readSettings(item.settings);
  const log = (action: string, b: unknown, a: unknown) =>
    writeAuditLog({ organizationId: s.organizationId, actorId: s.userId, action, resourceType: "project", resourceId: project.id, before: b, after: a });
  // Automation permissions gate auto-execution and schedules spend credits — keep an audit trail of who changed them.
  if (automationChanged) await log("project.automation_updated", before.automation ?? null, after.automation ?? null);
  if (scheduleChanged) await log("project.schedule_updated", readSchedule(before), readSchedule(after));
  if (changed.length) await log("project.updated", { fields: changed }, { fields: changed });
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
