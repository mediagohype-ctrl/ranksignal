// /api/admin/seo/keywords/[id] — PATCH (update position, AI mention, target page…) / DELETE. seo.manage, audit-logged.
import { Prisma } from "@prisma/client";
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { staffAudit } from "@/lib/admin/audit";
import { keywordPatchSchema } from "@/lib/seo/keywords";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi("seo.manage");
  const { id } = await params;
  const patch = await parseBody(req, keywordPatchSchema);
  const before = await db.seoKeyword.findUnique({ where: { id } });
  if (!before) throw new HttpError(404, "not_found", "Keyword not found");
  const touchedRank = patch.googlePosition !== undefined || patch.aiMentioned !== undefined;
  const item = await db.seoKeyword.update({ where: { id }, data: { ...patch, ...(touchedRank ? { checkedAt: new Date() } : {}) } }).catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError(409, "duplicate", "This phrase is already tracked.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") throw new HttpError(404, "not_found", "Keyword not found");
    throw e;
  });
  const changed = Object.keys(patch) as (keyof typeof patch)[];
  await staffAudit(staff, req, {
    action: "seo.keyword_updated",
    resourceType: "seo_keyword",
    resourceId: id,
    before: Object.fromEntries(changed.map((k) => [k, before[k]])),
    after: { phrase: item.phrase, ...patch },
  });
  return json({ item });
});

export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaffApi("seo.manage");
  const { id } = await params;
  const before = await db.seoKeyword.findUnique({ where: { id }, select: { phrase: true, targetPath: true } });
  if (!before) throw new HttpError(404, "not_found", "Keyword not found");
  await db.seoKeyword.delete({ where: { id } }).catch((e) => {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") throw new HttpError(404, "not_found", "Keyword not found");
    throw e;
  });
  await staffAudit(staff, req, { action: "seo.keyword_deleted", resourceType: "seo_keyword", resourceId: id, before });
  return json({ item: { deleted: true } });
});
