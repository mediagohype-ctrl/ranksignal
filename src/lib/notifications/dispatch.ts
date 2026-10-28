// Turns finished WorkflowRuns into in-app Notifications + emails. Called from the scheduler tick with a time
// window (in-memory cursor + lookback); existing Notification rows (org + type + link) make it idempotent.
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { renderEmail } from "@/lib/email/layout";
import { readNotificationPrefs } from "@/lib/dashboard/project-schema";
import {
  approvalsNotice, filterUnsent, jobFailedNotice, reportReadyNotice, visibilityReadyNotice, type RunNotice,
} from "./templates";

const SUCCESS = ["succeeded", "succeeded_with_warnings"];
const WATCHED_STATES = [...SUCCESS, "failed"];
const MAX_RUNS_PER_TICK = 200;

interface FinishedRun {
  id: string;
  kind: string;
  state: string;
  organizationId: string;
  projectId: string | null;
  input: unknown;
  output: unknown;
  error: string | null;
  errorClass: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const str = (v: unknown) => (typeof v === "string" ? v : null);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

async function noticeFor(run: FinishedRun, projectName: string): Promise<RunNotice | null> {
  const projectId = run.projectId!;
  const base = { organizationId: run.organizationId, projectId, projectName };
  const input = obj(run.input);

  if (run.kind === "crawl") {
    const crawlRunId = str(input.crawlRunId);
    if (!crawlRunId) return null;
    if (run.state === "failed") {
      const cr = await db.crawlRun.findFirst({ where: { id: crawlRunId, organizationId: run.organizationId }, select: { error: true } });
      return jobFailedNotice({ ...base, kind: "crawl", runId: crawlRunId, error: run.error ?? cr?.error ?? null, errorClass: run.errorClass });
    }
    const cr = await db.crawlRun.findFirst({
      where: { id: crawlRunId, organizationId: run.organizationId },
      select: { status: true, pagesCrawled: true },
    });
    if (!cr || cr.status !== "succeeded") return null;
    const groups = await db.auditFinding.groupBy({
      by: ["severity"],
      where: { organizationId: run.organizationId, projectId, status: "open" },
      _count: { _all: true },
    });
    const openBySeverity = Object.fromEntries(groups.map((g) => [g.severity, g._count._all]));
    return reportReadyNotice({ ...base, crawlRunId, pagesCrawled: cr.pagesCrawled, openBySeverity });
  }

  if (run.kind === "visibility") {
    const visibilityRunId = str(input.visibilityRunId);
    if (!visibilityRunId) return null;
    if (run.state === "failed") {
      return jobFailedNotice({ ...base, kind: "visibility", runId: visibilityRunId, error: run.error, errorClass: run.errorClass });
    }
    const vr = await db.visibilityRun.findFirst({
      where: { id: visibilityRunId, organizationId: run.organizationId },
      select: { status: true, metrics: true },
    });
    if (!vr || !SUCCESS.includes(vr.status)) return null;
    return visibilityReadyNotice({
      ...base, visibilityRunId, metrics: obj(vr.metrics), partial: vr.status === "succeeded_with_warnings",
    });
  }

  if (run.kind === "analyze" && SUCCESS.includes(run.state)) {
    const count = await db.action.count({
      where: {
        organizationId: run.organizationId, projectId, status: "awaiting_approval",
        createdAt: { gte: run.createdAt, lte: run.updatedAt },
      },
    });
    return count > 0 ? approvalsNotice({ ...base, workflowRunId: run.id, count }) : null;
  }
  return null;
}

async function adminRecipients(organizationId: string): Promise<string[]> {
  const members = await db.membership.findMany({
    where: { organizationId, status: "active", role: { in: ["owner", "admin"] } },
    select: { user: { select: { email: true } } },
  });
  return [...new Set(members.map((m) => m.user.email).filter(Boolean))];
}

async function emailNotice(n: RunNotice, recipients: string[]) {
  const { html, text } = renderEmail({
    title: n.email.subject,
    preheader: n.email.preheader,
    paragraphs: n.email.paragraphs,
    cta: { label: n.email.ctaLabel, url: new URL(n.link, BRAND.appUrl).toString() },
    footer: `You're getting this because you're an owner or admin on ${BRAND.name}. To stop these emails for this project, open Project settings → Notifications.`,
  });
  for (const to of recipients) {
    try {
      await sendEmail({ to, subject: n.email.subject, html, text });
    } catch (e) {
      console.error("[notifications] email send failed:", e instanceof Error ? e.message : e);
    }
  }
}

/** Notify about runs that finished in [since, now]. Returns the number of new notifications. */
export async function dispatchRunNotifications(o: { since: Date; now?: Date }): Promise<number> {
  const now = o.now ?? new Date();
  const runs = await db.workflowRun.findMany({
    where: {
      kind: { in: ["crawl", "visibility", "analyze"] },
      state: { in: WATCHED_STATES },
      projectId: { not: null },
      updatedAt: { gte: o.since, lte: now },
    },
    orderBy: { updatedAt: "asc" },
    take: MAX_RUNS_PER_TICK,
    select: {
      id: true, kind: true, state: true, organizationId: true, projectId: true, input: true, output: true,
      error: true, errorClass: true, createdAt: true, updatedAt: true,
    },
  });
  if (runs.length === 0) return 0;

  const projectIds = [...new Set(runs.map((r) => r.projectId!))];
  const projects = await db.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true, settings: true } });
  const byId = new Map(projects.map((p) => [p.id, p]));

  const notices: RunNotice[] = [];
  for (const run of runs) {
    const p = byId.get(run.projectId!);
    if (!p) continue; // project deleted since
    try {
      const n = await noticeFor(run, p.name);
      if (n) notices.push(n);
    } catch (e) {
      console.error(`[notifications] could not build notice for run ${run.id}:`, e instanceof Error ? e.message : e);
    }
  }
  if (notices.length === 0) return 0;

  const existing = await db.notification.findMany({
    where: { organizationId: { in: [...new Set(notices.map((n) => n.organizationId))] }, link: { in: notices.map((n) => n.link) } },
    select: { organizationId: true, type: true, link: true },
  });
  const fresh = filterUnsent(notices, existing);

  const emailOn = isEmailConfigured();
  const recipientCache = new Map<string, string[]>();
  let created = 0;
  for (const n of fresh) {
    await db.notification.create({
      data: { organizationId: n.organizationId, type: n.type, title: n.title, body: n.body, link: n.link },
    });
    created++;
    if (!emailOn || !readNotificationPrefs(byId.get(n.projectId)?.settings).email) continue;
    if (!recipientCache.has(n.organizationId)) recipientCache.set(n.organizationId, await adminRecipients(n.organizationId));
    await emailNotice(n, recipientCache.get(n.organizationId)!);
  }
  return created;
}
