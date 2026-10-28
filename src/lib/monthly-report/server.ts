// Tenant-scoped reads for client pages and APIs. Clients only ever see sent reports; staff in support mode
// (session.staffMode) also see drafts.
import type { MonthlyReport } from "@prisma/client";
import { db } from "@/lib/db";
import type { SessionContext } from "@/lib/types";
import type { MonthlyReportListItem, MonthlyReportPayload, MonthlyReportStatus } from "./types";

export const canSeeDrafts = (s: Pick<SessionContext, "staffMode">) => s.staffMode === true;

export function toListItem(r: Pick<MonthlyReport, "id" | "projectId" | "period" | "status" | "sentAt" | "createdAt">): MonthlyReportListItem {
  return {
    id: r.id,
    projectId: r.projectId,
    period: r.period,
    status: r.status as MonthlyReportStatus,
    sentAt: r.sentAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listProjectReports(s: SessionContext, projectId: string) {
  return db.monthlyReport.findMany({
    where: { organizationId: s.organizationId, projectId, ...(canSeeDrafts(s) ? {} : { status: "sent" }) },
    orderBy: { period: "desc" },
    take: 120,
  });
}

export async function getProjectReport(s: SessionContext, projectId: string, period: string) {
  const r = await db.monthlyReport.findFirst({ where: { organizationId: s.organizationId, projectId, period } });
  if (!r || (r.status !== "sent" && !canSeeDrafts(s))) return null;
  return r;
}

export const payloadOf = (r: Pick<MonthlyReport, "payload">) => (r.payload as MonthlyReportPayload | null) ?? null;

export function markdownFilename(p: MonthlyReportPayload) {
  const slug = (p.project.name || "website").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "website";
  return `${slug}-impact-report-${p.period}.md`;
}
