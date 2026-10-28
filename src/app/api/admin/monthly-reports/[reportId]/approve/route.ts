// POST → approve & send: records the reviewer, marks the report sent, notifies and emails the client.
import { HttpError, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/auth/staff";
import { deliverMonthlyReport } from "@/lib/monthly-report/deliver";
import { clientIp, getReportForStaff, staffAuditLog } from "@/lib/monthly-report/admin";

export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request, { params }: { params: Promise<{ reportId: string }> }) => {
  const staff = await requireStaff();
  const { reportId } = await params;
  const report = await getReportForStaff(reportId);
  if (report.status === "sent") throw new HttpError(409, "already_sent", "This report has already been sent.");
  if (!report.summary?.trim()) throw new HttpError(409, "missing_summary", "Add a summary before sending.");
  const sent = await deliverMonthlyReport(report.id, { reviewedById: staff.user.id });
  await staffAuditLog({
    staffUserId: staff.user.id, organizationId: report.organizationId, action: "monthly_report.approve_send", reportId: report.id,
    before: { status: report.status }, after: { status: sent.status, sentAt: sent.sentAt?.toISOString() ?? null }, ip: clientIp(req),
  });
  return json({ item: { id: sent.id, status: sent.status, sentAt: sent.sentAt } });
});
