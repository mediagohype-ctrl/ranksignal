// Marks a report as sent, adds an in-app notification and emails org owners/admins (respecting the project's
// settings.notifications.email). Idempotent: an already-sent report is returned untouched.
import type { MonthlyReport } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { readNotificationPrefs } from "@/lib/dashboard/project-schema";
import { monthlyReportEmail, monthlyReportNotice } from "./email";
import type { MonthlyReportPayload } from "./types";

export async function deliverMonthlyReport(
  reportId: string,
  o: { reviewedById?: string; summary?: string } = {},
): Promise<MonthlyReport> {
  const report = await db.monthlyReport.findUnique({ where: { id: reportId } });
  if (!report) throw new HttpError(404, "not_found", "Report not found");
  if (report.status === "sent") return report;
  const payload = report.payload as MonthlyReportPayload | null;
  if (!payload) throw new HttpError(409, "no_payload", "This report has no content yet; regenerate it first.");

  const now = new Date();
  // Conditional update so two concurrent approvals can't both send.
  const claimed = await db.monthlyReport.updateMany({
    where: { id: report.id, status: { not: "sent" } },
    data: {
      status: "sent",
      sentAt: now,
      ...(o.summary !== undefined ? { summary: o.summary } : {}),
      ...(o.reviewedById ? { reviewedById: o.reviewedById, reviewedAt: now } : {}),
    },
  });
  const sent = (await db.monthlyReport.findUnique({ where: { id: report.id } }))!;
  if (claimed.count === 0) return sent;

  const notice = monthlyReportNotice(payload);
  try {
    const dupe = await db.notification.findFirst({
      where: { organizationId: report.organizationId, type: notice.type, link: notice.link },
      select: { id: true },
    });
    if (!dupe) await db.notification.create({ data: { organizationId: report.organizationId, ...notice } });
  } catch (e) {
    console.error("[monthly-report] notification failed:", e instanceof Error ? e.message : e);
  }

  try {
    const project = await db.project.findFirst({
      where: { id: report.projectId, organizationId: report.organizationId },
      select: { settings: true },
    });
    if (project && isEmailConfigured() && readNotificationPrefs(project.settings).email) {
      const members = await db.membership.findMany({
        where: { organizationId: report.organizationId, status: "active", role: { in: ["owner", "admin"] } },
        select: { user: { select: { email: true } } },
      });
      const recipients = [...new Set(members.map((m) => m.user.email).filter(Boolean))];
      const mail = monthlyReportEmail(payload, sent.summary ?? "");
      for (const to of recipients) {
        try {
          await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text });
        } catch (e) {
          console.error("[monthly-report] email send failed:", e instanceof Error ? e.message : e);
        }
      }
    }
  } catch (e) {
    console.error("[monthly-report] email step failed:", e instanceof Error ? e.message : e);
  }
  return sent;
}
