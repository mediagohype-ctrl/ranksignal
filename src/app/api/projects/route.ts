import { Prisma } from "@prisma/client";
import { handler, json, parseBody, requireSession } from "@/lib/api";
import { db } from "@/lib/db";
import { projectCreateSchema } from "@/lib/dashboard/project-schema";
import { assertProjectLimit } from "@/lib/billing/usage";
import { getPlan } from "@/lib/billing/plans";
import { writeAuditLog } from "@/lib/audit-log";

export const GET = handler(async () => {
  const s = await requireSession("viewer");
  const items = await db.project.findMany({
    where: { organizationId: s.organizationId },
    orderBy: { createdAt: "desc" },
  });
  return json({ items });
});

export const POST = handler(async (req: Request) => {
  const s = await requireSession("member");
  const body = await parseBody(req, projectCreateSchema);
  await assertProjectLimit(s.organizationId);
  const org = await db.organization.findUnique({ where: { id: s.organizationId }, select: { planId: true } });
  const plan = getPlan(org?.planId ?? "trial");
  const settings = {
    ...(body.settings ?? {}),
    maxPagesPerCrawl: Math.min(body.settings?.maxPagesPerCrawl ?? plan.maxPagesPerCrawl, plan.maxPagesPerCrawl),
    automation: { allowClassB: body.settings?.automation?.allowClassB ?? [] },
  };
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
    },
  });
  await writeAuditLog({
    organizationId: s.organizationId,
    actorId: s.userId,
    action: "project.created",
    resourceType: "project",
    resourceId: item.id,
    after: { name: item.name, websiteUrl: item.websiteUrl, automation: settings.automation },
  });
  return json({ item }, { status: 201 });
});
