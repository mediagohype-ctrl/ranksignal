// /api/admin/seo/keywords/[id] — PATCH (update position, AI mention, target page…) / DELETE. seo.manage.
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { keywordPatchSchema } from "@/lib/seo/keywords";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  await requireStaffApi("seo.manage");
  const { id } = await params;
  const patch = await parseBody(req, keywordPatchSchema);
  const touchedRank = patch.googlePosition !== undefined || patch.aiMentioned !== undefined;
  const item = await db.seoKeyword
    .update({ where: { id }, data: { ...patch, ...(touchedRank ? { checkedAt: new Date() } : {}) } })
    .catch(() => {
      throw new HttpError(404, "not_found", "Keyword not found");
    });
  return json({ item });
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  await requireStaffApi("seo.manage");
  const { id } = await params;
  await db.seoKeyword.delete({ where: { id } }).catch(() => {
    throw new HttpError(404, "not_found", "Keyword not found");
  });
  return json({ item: { deleted: true } });
});
