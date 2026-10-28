// Staff review queue. GET ?period=YYYY-MM&status=draft|reviewed|sent → { items } (default: drafts + reviewed).
// POST { projectId, period } → generate now (refreshes a draft; never re-sends a sent report) → { item }.
import { handler, json, parseBody, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/staff";
import { generateMonthlyReport } from "@/lib/monthly-report/generate";
import { clientIp, generateSchema, listQueue, queueFilterSchema, staffAuditLog } from "@/lib/monthly-report/admin";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  await requireStaff();
  const sp = new URL(req.url).searchParams;
  const f = queueFilterSchema.parse({ period: sp.get("period") || undefined, status: sp.get("status") || undefined });
  return json({ items: await listQueue(f) }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = handler(async (req: Request) => {
  const staff = await requireStaff();
  const body = await parseBody(req, generateSchema);
  const project = await db.project.findUnique({ where: { id: body.projectId }, select: { id: true, organizationId: true } });
  if (!project) throw new HttpError(404, "not_found", "Project not found");
  const item = await generateMonthlyReport(project.id, project.organizationId, body.period, { holdForReview: true });
  await staffAuditLog({
    staffUserId: staff.user.id, organizationId: project.organizationId, action: "monthly_report.generate", reportId: item.id,
    after: { projectId: project.id, period: body.period, status: item.status }, ip: clientIp(req),
  });
  return json({ item: { id: item.id, status: item.status, period: item.period, projectId: item.projectId } }, { status: 201 });
});
