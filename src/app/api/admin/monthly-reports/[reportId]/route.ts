// GET → { item } (full report for review). PATCH { summary?, headline? } → edit an unsent report.
import { handler, json, parseBody } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { applyReviewEdits, clientIp, getReportForStaff, reviewEditSchema, staffAuditLog } from "@/lib/monthly-report/admin";
import type { MonthlyReportPayload } from "@/lib/monthly-report/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ reportId: string }> };

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  await requireStaff();
  const { reportId } = await params;
  return json({ item: await getReportForStaff(reportId) }, { headers: { "Cache-Control": "no-store" } });
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const staff = await requireStaff();
  const { reportId } = await params;
  const edit = await parseBody(req, reviewEditSchema);
  const { before, after } = await applyReviewEdits(reportId, edit);
  const headlineOf = (p: unknown) => (p as MonthlyReportPayload | null)?.headline ?? null;
  await staffAuditLog({
    staffUserId: staff.user.id, organizationId: after.organizationId, action: "monthly_report.edit", reportId: after.id,
    before: { summary: before.summary, headline: headlineOf(before.payload) },
    after: { summary: after.summary, headline: headlineOf(after.payload) },
    ip: clientIp(req),
  });
  return json({ item: { id: after.id, status: after.status, summary: after.summary, headline: headlineOf(after.payload) } });
});
