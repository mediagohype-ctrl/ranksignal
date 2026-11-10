// Report templates: list / create / update / delete, always scoped by organizationId (+ project). The org default
// is one row per organization with projectId null and isOrgDefault true.
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import {
  DEFAULT_RANGE, DEFAULT_SECTIONS, builderLimitsFor, normalizeSections, readRange, toTemplateView,
  type ReportBuilderLimits, type TemplateInput, type TemplatePatch, type TemplateView,
} from "./sections";

const SELECT = {
  id: true, organizationId: true, projectId: true, name: true, sections: true, intro: true, notes: true, range: true,
  isOrgDefault: true, shareEnabled: true, updatedAt: true,
} as const;

export interface TemplatesList {
  items: TemplateView[];
  orgDefault: TemplateView | null;
  limits: ReportBuilderLimits;
}

export async function planLimitsForOrg(organizationId: string): Promise<ReportBuilderLimits> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { planId: true } });
  return builderLimitsFor(org?.planId ?? "trial");
}

export async function listTemplates(organizationId: string, projectId: string): Promise<TemplatesList> {
  const [rows, orgDefault, limits] = await Promise.all([
    db.reportTemplate.findMany({ where: { organizationId, projectId }, orderBy: { createdAt: "asc" }, select: SELECT, take: 100 }),
    db.reportTemplate.findFirst({ where: { organizationId, projectId: null, isOrgDefault: true }, select: SELECT }),
    planLimitsForOrg(organizationId),
  ]);
  return { items: rows.map(toTemplateView), orgDefault: orgDefault ? toTemplateView(orgDefault) : null, limits };
}

/**
 * A template this project may use: its own, or the org default (id "org-default" or the default's id).
 * Returns null when not found in this organization — callers 404.
 */
export async function findTemplate(organizationId: string, projectId: string, templateId: string): Promise<(TemplateView & { projectId: string | null }) | null> {
  const row =
    templateId === "org-default"
      ? await db.reportTemplate.findFirst({ where: { organizationId, projectId: null, isOrgDefault: true }, select: SELECT })
      : await db.reportTemplate.findFirst({
          where: { id: templateId, organizationId, OR: [{ projectId }, { projectId: null, isOrgDefault: true }] },
          select: SELECT,
        });
  return row ? { ...toTemplateView(row), projectId: row.projectId } : null;
}

/** Built-in starting point when nothing is saved. */
export function builtInTemplate(): Omit<TemplateView, "id" | "updatedAt"> {
  return {
    name: "Monthly client report",
    sections: DEFAULT_SECTIONS.map((s) => ({ ...s })),
    intro: "",
    notes: "",
    range: { ...DEFAULT_RANGE },
    isOrgDefault: false,
    shareEnabled: false,
  };
}

const toData = (t: Partial<TemplateInput>) => ({
  ...(t.name !== undefined ? { name: t.name } : {}),
  ...(t.sections !== undefined ? { sections: normalizeSections(t.sections) as unknown as Prisma.InputJsonValue } : {}),
  ...(t.intro !== undefined ? { intro: t.intro || null } : {}),
  ...(t.notes !== undefined ? { notes: t.notes || null } : {}),
  ...(t.range !== undefined ? { range: readRange(t.range) as unknown as Prisma.InputJsonValue } : {}),
});

export async function createProjectTemplate(o: { organizationId: string; projectId: string; userId: string; input: TemplateInput; canShare: boolean }): Promise<TemplateView> {
  const limits = await planLimitsForOrg(o.organizationId);
  const count = await db.reportTemplate.count({ where: { organizationId: o.organizationId, projectId: o.projectId } });
  if (count >= limits.maxTemplatesPerProject) {
    throw new HttpError(403, "template_limit", `Your plan allows ${limits.maxTemplatesPerProject} saved ${limits.maxTemplatesPerProject === 1 ? "template" : "templates"} per website. Edit an existing one or upgrade.`);
  }
  const row = await db.reportTemplate.create({
    data: {
      organizationId: o.organizationId,
      projectId: o.projectId,
      createdById: o.userId,
      ...toData(o.input),
      name: o.input.name,
      sections: normalizeSections(o.input.sections) as unknown as Prisma.InputJsonValue,
      shareEnabled: o.canShare ? !!o.input.shareEnabled : false,
    },
    select: SELECT,
  });
  return toTemplateView(row);
}

/** Create or replace the organization's default template (admin + plan checked by the caller / here). */
export async function saveOrgDefault(o: { organizationId: string; userId: string; input: TemplateInput }): Promise<TemplateView> {
  const limits = await planLimitsForOrg(o.organizationId);
  if (!limits.orgDefault) throw new HttpError(403, "plan_required", "An organization-wide default template needs the Growth or Agency plan.");
  const existing = await db.reportTemplate.findFirst({ where: { organizationId: o.organizationId, projectId: null, isOrgDefault: true }, select: { id: true } });
  const data = { ...toData(o.input), name: o.input.name, sections: normalizeSections(o.input.sections) as unknown as Prisma.InputJsonValue };
  const row = existing
    ? await db.reportTemplate.update({ where: { id: existing.id }, data, select: SELECT })
    : await db.reportTemplate.create({
        data: { organizationId: o.organizationId, projectId: null, isOrgDefault: true, shareEnabled: false, createdById: o.userId, ...data },
        select: SELECT,
      });
  return toTemplateView(row);
}

export async function updateTemplate(o: {
  organizationId: string;
  projectId: string;
  templateId: string;
  patch: TemplatePatch;
  isAdmin: boolean;
}): Promise<TemplateView> {
  const t = await findTemplate(o.organizationId, o.projectId, o.templateId);
  if (!t) throw new HttpError(404, "not_found", "Template not found");
  if (t.projectId === null && !o.isAdmin) throw new HttpError(403, "forbidden", "Only owners and admins can change the organization default.");
  if (o.patch.shareEnabled !== undefined && !o.isAdmin) throw new HttpError(403, "forbidden", "Only owners and admins can share reports.");
  const data = {
    ...toData(o.patch),
    // The org default is never shared directly (share links are per website).
    ...(o.patch.shareEnabled !== undefined && t.projectId !== null ? { shareEnabled: o.patch.shareEnabled } : {}),
  };
  const res = await db.reportTemplate.updateMany({ where: { id: t.id, organizationId: o.organizationId }, data });
  if (res.count === 0) throw new HttpError(404, "not_found", "Template not found");
  const row = await db.reportTemplate.findFirst({ where: { id: t.id, organizationId: o.organizationId }, select: SELECT });
  return toTemplateView(row!);
}

export async function deleteTemplate(o: { organizationId: string; projectId: string; templateId: string; isAdmin: boolean }): Promise<void> {
  const t = await findTemplate(o.organizationId, o.projectId, o.templateId);
  if (!t) throw new HttpError(404, "not_found", "Template not found");
  if (t.projectId === null && !o.isAdmin) throw new HttpError(403, "forbidden", "Only owners and admins can remove the organization default.");
  await db.reportTemplate.deleteMany({ where: { id: t.id, organizationId: o.organizationId } });
}
