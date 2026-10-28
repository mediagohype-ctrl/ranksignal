// POST → rebuild an unsent report from current data (replaces the summary and headline edits).
import { HttpError, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { generateMonthlyReport } from "@/lib/monthly-report/generate";
import { clientIp, getReportForStaff, staffAuditLog } from "@/lib/monthly-report/admin";

export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request, { params }: { params: Promise<{ reportId: string }> }) => {
  const staff = await requireStaff();
  const { reportId } = await params;
  const report = await getReportForStaff(reportId);
  if (report.status === "sent") throw new HttpError(409, "already_sent", "Sent reports can't be regenerated.");
  const item = await generateMonthlyReport(report.projectId, report.organizationId, report.period, { holdForReview: true });
  await staffAuditLog({
    staffUserId: staff.user.id, organizationId: report.organizationId, action: "monthly_report.regenerate", reportId: report.id,
    before: { status: report.status, summary: report.summary }, after: { status: item.status }, ip: clientIp(req),
  });
  return json({ item: { id: item.id, status: item.status } });
});
