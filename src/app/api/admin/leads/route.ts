// GET /api/admin/leads — paginated lead list (filters: source, status, from, to, q, page, size).
import { handler, json } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { leadWhere, searchParamsFromUrl } from "@/lib/admin/lead-filters";
import { pageParams } from "@/lib/admin/params";

export const GET = handler(async (req: Request) => {
  await requireStaffApi();
  const sp = searchParamsFromUrl(req.url);
  const { skip, take, page } = pageParams(sp);
  const where = leadWhere(sp);
  const [items, total] = await Promise.all([
    db.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    db.lead.count({ where }),
  ]);
  return json({ items, total, page, nextCursor: skip + take < total ? String(page + 1) : undefined });
});
