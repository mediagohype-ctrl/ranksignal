// GET /api/admin/leads/export — CSV of leads matching the current filters (max 10,000 rows). Audit-logged.
import { handler } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaffApi } from "@/lib/admin/guard";
import { staffAudit } from "@/lib/admin/audit";
import { leadWhere, searchParamsFromUrl } from "@/lib/admin/lead-filters";
import { leadsToCsv } from "@/lib/admin/leads";

export const dynamic = "force-dynamic";
const MAX_ROWS = 10_000;

export const GET = handler(async (req: Request) => {
  const staff = await requireStaffApi();
  const sp = searchParamsFromUrl(req.url);
  const rows = await db.lead.findMany({ where: leadWhere(sp), orderBy: { createdAt: "desc" }, take: MAX_ROWS });
  await staffAudit(staff, req, {
    action: "admin.leads_exported",
    resourceType: "lead",
    resourceId: "export",
    after: { rows: rows.length, filters: sp },
  });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(leadsToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
