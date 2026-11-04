import { Prisma } from "@prisma/client";
import { handler, HttpError, json, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { createNeedsAdmin, mergeSettingsPatch, projectCreateSchema, readSchedule, SettingsPatchError } from "@/lib/dashboard/project-schema";
import { businessFactsSchema, isPlaceholderOrgName } from "@/lib/setup/facts";
import { assertProjectLimit } from "@/lib/billing/usage";
import { getPlan } from "@/lib/billing/plans";
import { auditActorFromSession, writeAuditLog } from "@/lib/audit-log";

export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const items = await db.project.findMany({
    where: { organizationId: s.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return json({ items });
});

/** Setup sends the facts the owner confirmed on "Is this right?" (stored as Project.facts). */
const createSchema = projectCreateSchema.extend({ facts: businessFactsSchema.optional() });

export const POST = handler(async (req: Request) => {
  const s = await requireSession("member");
  const body = await parseBody(req, createSchema);
  // Same rule as PATCH: schedules spend credits and the class-B allow-list decides what is published without
  // review, so only owners/admins (or staff support mode, which resolves to admin) may set them.
  if (createNeedsAdmin(body.settings) && s.role !== "admin" && s.role !== "owner") {
    throw new HttpError(403, "forbidden", "Only owners and admins can set schedules or automatic fixes");
  }
  await assertProjectLimit(s.organizationId);
  const org = await db.organization.findUnique({ where: { id: s.organizationId }, select: { planId: true, name: true } });
  const plan = getPlan(org?.planId ?? "trial");
  let settings: Record<string, unknown>;
  try {
    // Known keys only, clamped/validated against the plan (schedule frequency, page cap) exactly like PATCH.
    const { next } = mergeSettingsPatch({}, body.settings ?? {}, plan);
    // Defaults for every new project: pages per scan = plan maximum, automatic fixes off, schedules on
    // (website weekly, AI monthly — stored explicitly so the settings page shows what will run).
    settings = {
      ...next,
      maxPagesPerCrawl: Math.min(body.settings?.maxPagesPerCrawl ?? plan.maxPagesPerCrawl, plan.maxPagesPerCrawl),
      automation: { allowClassB: body.settings?.automation?.allowClassB ?? [] },
      schedule: readSchedule(next),
    };
  } catch (e) {
    if (e instanceof SettingsPatchError) throw new HttpError(400, e.code, e.message);
    throw e;
  }
  const item = await db.project.create({
    data: {
      organizationId: s.organizationId,
      name: body.name,
      websiteUrl: body.websiteUrl,
      brandNames: body.brandNames,
      categories: body.categories,
      audience: body.audience,
      countries: body.countries,
      languages: body.languages,
      competitors: body.competitors as Prisma.InputJsonValue,
      keywords: body.keywords,
      settings: settings as Prisma.InputJsonValue,
      ...(body.facts ? { facts: body.facts as Prisma.InputJsonValue } : {}),
    },
  });
  // Sign-up no longer asks for a business name: the org starts with a placeholder and takes the confirmed name here.
  if (body.facts && org && isPlaceholderOrgName(org.name, s.email) && (s.role === "owner" || s.role === "admin")) {
    await db.organization
      .update({ where: { id: s.organizationId }, data: { name: body.facts.name.slice(0, 120) } })
      .catch(() => undefined);
  }
  await writeAuditLog({
    organizationId: s.organizationId,
    ...auditActorFromSession(s),
    action: "project.created",
    resourceType: "project",
    resourceId: item.id,
    after: {
      name: item.name,
      websiteUrl: item.websiteUrl,
      automation: settings.automation,
      ...(body.settings?.schedule ? { schedule: readSchedule(settings) } : {}),
    },
  });
  return json({ item }, { status: 201 });
});
