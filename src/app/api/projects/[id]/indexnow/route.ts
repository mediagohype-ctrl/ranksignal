// IndexNow settings for a project. GET (viewer): status + recent submissions. PATCH (admin): switch triggers on/off,
// turn IndexNow off, or generate a new key (which needs the new key file uploaded and verified again).
import { z } from "zod";
import { db } from "@/lib/db";
import { handler, HttpError, json, parseBody, requireProject, requireSession } from "@/lib/api";
import { writeAuditLog, auditActorFromSession } from "@/lib/audit-log";
import { generateIndexNowKey, keyFileUrl, siteOf } from "@/lib/indexnow-customer/core";
import { getOrCreateIndexNowSite } from "@/lib/indexnow-customer/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireSession("viewer");
  const { id } = await params;
  const project = await requireProject(s, id);
  // Read-only: the key is created when an admin opens the settings page or changes a setting.
  const site = await db.indexNowSite.findFirst({ where: { organizationId: s.organizationId, projectId: project.id } });
  const submissions = await db.indexNowSubmission.findMany({
    where: { organizationId: s.organizationId, projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, trigger: true, urlCount: true, status: true, httpStatus: true, message: true, attempts: true, sentAt: true, createdAt: true },
  });
  const origin = siteOf(project.websiteUrl)?.origin ?? "";
  return json({ item: site ? { ...site, keyFileUrl: keyFileUrl(origin, site.key) } : null, submissions });
});

const patchSchema = z
  .object({
    onFixPublished: z.boolean().optional(),
    onCrawlChanges: z.boolean().optional(),
    /** Only false is accepted: turning IndexNow on happens by verifying the key file. */
    enabled: z.literal(false).optional(),
    rotateKey: z.literal(true).optional(),
  })
  .strict();

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireSession("admin");
  const { id } = await params;
  const project = await requireProject(s, id);
  const body = await parseBody(req, patchSchema);
  if (Object.keys(body).length === 0) throw new HttpError(400, "empty", "Nothing to change.");
  const site = await getOrCreateIndexNowSite(project);
  const data: Record<string, unknown> = {};
  if (body.onFixPublished !== undefined) data.onFixPublished = body.onFixPublished;
  if (body.onCrawlChanges !== undefined) data.onCrawlChanges = body.onCrawlChanges;
  if (body.enabled === false) Object.assign(data, { enabled: false });
  if (body.rotateKey) Object.assign(data, { key: generateIndexNowKey(), status: "pending", enabled: false, verifiedAt: null, lastCheckError: null });
  const updated = await db.indexNowSite.update({ where: { id: site.id }, data });
  await writeAuditLog({
    organizationId: s.organizationId, ...auditActorFromSession(s), action: "indexnow.settings_changed",
    resourceType: "project", resourceId: project.id, after: { ...body },
  });
  return json({ item: updated });
});
