// Staff review queue helpers (cross-org; callers must have passed requireStaff()).
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit-log";
import { FORBIDDEN_CLAIMS } from "@/lib/report/summary";
import { isValidPeriod } from "./period";
import type { MonthlyReportPayload } from "./types";
import { clientIpFromHeaders } from "@/lib/auth/rate-limit";

export const QUEUE_STATUSES = ["draft", "reviewed", "sent"] as const;

export const queueFilterSchema = z.object({
  period: z.string().refine(isValidPeriod, "Period must look like YYYY-MM").optional(),
  status: z.enum(QUEUE_STATUSES).optional(),
});

const bullets = z.array(z.string().trim().min(1).max(300)).max(3);
export const reviewEditSchema = z
  .object({
    summary: z.string().trim().min(20).max(3000).optional(),
    headline: z.object({ gains: bullets, risks: bullets, nextActions: bullets }).optional(),
  })
  .refine((v) => v.summary !== undefined || v.headline !== undefined, "Nothing to update");

export const generateSchema = z.object({
  projectId: z.string().min(1).max(64),
  period: z.string().refine(isValidPeriod, "Period must look like YYYY-MM"),
});

/** Rejects wording that promises outcomes (same rule as the site report). */
export function assertNoGuarantees(texts: string[]) {
  const bad = texts.find((t) => FORBIDDEN_CLAIMS.test(t));
  if (bad) throw new HttpError(400, "guarantee_language", `Please remove promise/guarantee wording: "${bad.slice(0, 80)}"`);
}

export interface QueueRow {
  id: string;
  period: string;
  status: string;
  organizationId: string;
  orgName: string;
  serviceTier: string | null;
  projectId: string;
  projectName: string;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  sentAt: Date | null;
}

export async function listQueue(f: z.infer<typeof queueFilterSchema>, take = 200): Promise<QueueRow[]> {
  const rows = await db.monthlyReport.findMany({
    where: { ...(f.period ? { period: f.period } : {}), status: f.status ?? { in: ["draft", "reviewed"] } },
    orderBy: [{ period: "desc" }, { createdAt: "asc" }],
    take,
    select: { id: true, period: true, status: true, organizationId: true, projectId: true, createdAt: true, updatedAt: true, reviewedAt: true, sentAt: true },
  });
  const [projects, orgs] = await Promise.all([
    db.project.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.projectId))] } }, select: { id: true, name: true } }),
    db.organization.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.organizationId))] } }, select: { id: true, name: true, serviceTier: true } }),
  ]);
  const pName = new Map(projects.map((p) => [p.id, p.name]));
  const org = new Map(orgs.map((o) => [o.id, o]));
  return rows.map((r) => ({
    ...r,
    projectName: pName.get(r.projectId) ?? "(deleted project)",
    orgName: org.get(r.organizationId)?.name ?? "(deleted organization)",
    serviceTier: org.get(r.organizationId)?.serviceTier ?? null,
  }));
}

export async function getReportForStaff(reportId: string) {
  const r = await db.monthlyReport.findUnique({ where: { id: reportId } });
  if (!r) throw new HttpError(404, "not_found", "Report not found");
  return r;
}

/** Apply staff edits (summary and/or headline bullets) to a report that hasn't been sent yet. */
export async function applyReviewEdits(reportId: string, edit: z.infer<typeof reviewEditSchema>) {
  const r = await getReportForStaff(reportId);
  if (r.status === "sent") throw new HttpError(409, "already_sent", "This report has already been sent and can't be edited.");
  const payload = (r.payload as MonthlyReportPayload | null) ?? null;
  if (edit.headline && !payload) throw new HttpError(409, "no_payload", "Regenerate the report before editing its headline.");
  assertNoGuarantees([
    ...(edit.summary ? [edit.summary] : []),
    ...(edit.headline ? [...edit.headline.gains, ...edit.headline.risks, ...edit.headline.nextActions] : []),
  ]);
  const nextPayload = edit.headline && payload ? { ...payload, headline: edit.headline } : null;
  const updated = await db.monthlyReport.update({
    where: { id: r.id },
    data: {
      ...(edit.summary !== undefined ? { summary: edit.summary } : {}),
      ...(nextPayload ? { payload: nextPayload as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  return { before: r, after: updated };
}

export async function staffAuditLog(o: {
  staffUserId: string;
  organizationId: string;
  action: string;
  reportId: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}) {
  await writeAuditLog({
    organizationId: o.organizationId,
    actorId: o.staffUserId,
    actorType: "staff",
    action: o.action,
    resourceType: "monthly_report",
    resourceId: o.reportId,
    before: o.before,
    after: o.after,
    ip: o.ip,
  });
}

export const clientIp = (req: Request) => clientIpFromHeaders(req.headers) || undefined;
