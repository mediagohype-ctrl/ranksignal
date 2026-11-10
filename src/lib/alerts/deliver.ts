// Alert delivery through the existing channels: in-app Notification rows, email (src/lib/email) and WhatsApp
// (growth/deliver whatsappOnce — only when the organization opted in). Every alert is recorded as an AlertEvent,
// which is also the de-duplication log (same rule + key not sent again inside the rule's cooldown) and the queue
// for the daily digest.
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { log } from "@/lib/log";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { renderEmail } from "@/lib/email/layout";
import { appLink } from "@/lib/email/templates";
import { claimOnce, releaseClaim } from "@/lib/growth/once";
import { canWhatsApp, whatsappOnce } from "@/lib/growth/deliver";
import { isWhatsAppConfigured } from "@/lib/whatsapp/send";
import { RULE_COOLDOWN_MS, alertLimitsFor, readAlertConfig, type AlertChannel, type AlertConfig } from "./config";
import type { AlertCandidate } from "./rules";

export const ALERT_NOTIFICATION_TYPE = "alert";
export const DIGEST_KIND = "alert_digest";
export const ALERT_WA_KIND = "alert_wa";
/** Daily digest goes out from 09:00 India time (03:30 UTC). */
export const DIGEST_MINUTE_UTC = 3 * 60 + 30;
const MAX_DIGEST_PROJECTS_PER_TICK = 50;

export interface Recipient {
  userId: string;
  email: string;
}

/** Active members of the org; the chosen ones, or every owner and admin when none were chosen. Tenant-scoped. */
export async function resolveRecipients(organizationId: string, chosen: string[]): Promise<Recipient[]> {
  const members = await db.membership.findMany({
    where: {
      organizationId,
      status: "active",
      ...(chosen.length ? { userId: { in: chosen } } : { role: { in: ["owner", "admin"] } }),
    },
    select: { userId: true, user: { select: { email: true } } },
  });
  const seen = new Set<string>();
  return members
    .filter((m) => m.user.email && !seen.has(m.userId) && (seen.add(m.userId), true))
    .map((m) => ({ userId: m.userId, email: m.user.email }));
}

/** Pure: which channels go out now, and whether email/WhatsApp wait for the digest. */
export function planDelivery(config: AlertConfig, severity: AlertCandidate["severity"], o: { whatsappAllowed: boolean }): {
  inApp: boolean;
  external: AlertChannel[];
  deferToDigest: boolean;
} {
  const external: AlertChannel[] = [];
  if (config.channels.email) external.push("email");
  if (config.channels.whatsapp && o.whatsappAllowed) external.push("whatsapp");
  const deferToDigest = external.length > 0 && config.digest === "daily" && severity !== "urgent";
  return { inApp: config.channels.inApp, external, deferToDigest };
}

/** Pure: is this alert inside its cooldown? */
export function isDuplicate(last: Date | null | undefined, rule: AlertCandidate["rule"], now: Date): boolean {
  return !!last && now.getTime() - last.getTime() < RULE_COOLDOWN_MS[rule];
}

function emailFor(a: { title: string; body: string; link: string }, projectName: string, footerExtra?: string) {
  const paragraphs = a.body.split(/\n{2,}/);
  return renderEmail({
    title: a.title,
    preheader: paragraphs[0]?.slice(0, 140),
    paragraphs,
    cta: { label: `Open ${BRAND.name}`, url: appLink(a.link) },
    footer: `You're getting this alert for ${projectName}${footerExtra ?? ""}. Change which alerts you get in the project's Alerts settings.`,
  });
}

async function emailAll(to: Recipient[], subject: string, content: { html: string; text: string }): Promise<boolean> {
  if (!isEmailConfigured() || to.length === 0) return false;
  let ok = false;
  for (const r of to) {
    try {
      ok = (await sendEmail({ to: r.email, subject, html: content.html, text: content.text })).ok || ok;
    } catch (e) {
      log.warn("alerts.email_failed", { err: e instanceof Error ? e.message : String(e) });
    }
  }
  return ok;
}

const waText = (title: string, body: string, link: string) =>
  `${BRAND.name} alert: ${title}\n\n${body.slice(0, 700)}\n\n${appLink(link)}`.slice(0, 1000);

export interface DeliverContext {
  organizationId: string;
  projectId: string;
  projectName: string;
  config: AlertConfig;
  now?: Date;
}

/**
 * Record + send each new candidate. Returns how many alerts fired (duplicates skipped). Never throws for one
 * candidate failing; the caller (hooks.ts) wraps everything anyway.
 */
export async function deliverAlerts(ctx: DeliverContext, candidates: AlertCandidate[]): Promise<number> {
  if (candidates.length === 0) return 0;
  const now = ctx.now ?? new Date();
  const org = await db.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { planId: true, whatsappOptIn: true, whatsappNumber: true },
  });
  if (!org) return 0;
  const limits = alertLimitsFor(org.planId);
  const whatsappAllowed = limits.whatsapp && org.whatsappOptIn && !!org.whatsappNumber;
  let recipients: Recipient[] | null = null;
  let fired = 0;

  for (const c of candidates) {
    try {
      const last = await db.alertEvent.findFirst({
        where: { organizationId: ctx.organizationId, projectId: ctx.projectId, rule: c.rule, dedupeKey: c.dedupeKey },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (isDuplicate(last?.createdAt, c.rule, now)) continue;

      const plan = planDelivery(ctx.config, c.severity, { whatsappAllowed });
      const deferred = plan.deferToDigest && limits.digest;
      const event = await db.alertEvent.create({
        data: {
          organizationId: ctx.organizationId,
          projectId: ctx.projectId,
          rule: c.rule,
          dedupeKey: c.dedupeKey.slice(0, 200),
          severity: c.severity,
          title: c.title.slice(0, 300),
          body: c.body.slice(0, 4000),
          link: c.link,
          data: (c.data ?? {}) as Prisma.InputJsonValue,
          status: deferred ? "pending_digest" : "sent",
          createdAt: now,
        },
      });
      fired++;
      recipients ??= await resolveRecipients(ctx.organizationId, ctx.config.recipients.slice(0, limits.maxRecipients));

      const used: AlertChannel[] = [];
      if (plan.inApp) {
        // Chosen recipients each get their own row; the default (owners + admins) is one org-wide row, like other notices.
        const rows = ctx.config.recipients.length
          ? recipients.map((r) => ({ userId: r.userId }))
          : [{ userId: null as string | null }];
        await db.notification.createMany({
          data: rows.map((r) => ({
            organizationId: ctx.organizationId,
            userId: r.userId,
            type: ALERT_NOTIFICATION_TYPE,
            title: c.title.slice(0, 300),
            body: c.body.replace(/\n+/g, " ").slice(0, 1000),
            link: c.link,
          })),
        });
        used.push("in_app");
      }
      if (!deferred) {
        if (plan.external.includes("email")) {
          const content = emailFor(c, ctx.projectName);
          if (await emailAll(recipients, c.title, content)) used.push("email");
        }
        if (plan.external.includes("whatsapp")) {
          const sent = await whatsappOnce({
            kind: ALERT_WA_KIND, key: event.id, organizationId: ctx.organizationId, org, text: waText(c.title, c.body, c.link),
          });
          if (sent) used.push("whatsapp");
        }
      }
      await db.alertEvent.update({
        where: { id: event.id },
        data: { channels: used as Prisma.InputJsonValue, deliveredAt: used.length ? now : null },
      });
    } catch (e) {
      log.error("alerts.deliver_failed", { projectId: ctx.projectId, rule: c.rule, err: e });
    }
  }
  return fired;
}

// ------------------------------------------------------------------------------------------------ daily digest

export function isDigestTime(now: Date): boolean {
  return now.getUTCHours() * 60 + now.getUTCMinutes() >= DIGEST_MINUTE_UTC;
}

/** Pure digest copy. */
export function digestContent(projectName: string, events: { title: string; body: string }[]) {
  const n = events.length;
  const title = `${n} ${n === 1 ? "alert" : "alerts"} for ${projectName} today`;
  const paragraphs = events.slice(0, 20).map((e) => `${e.title}\n${e.body}`);
  if (n > 20) paragraphs.push(`…and ${n - 20} more in the app.`);
  return { title, paragraphs };
}

/**
 * Scheduler step: once a day per project (from 09:00 IST), bundle the alerts waiting for the digest into one email
 * and one WhatsApp message. Idempotent per project + UTC day (SentMessage). Never throws.
 */
export async function sendAlertDigests(now = new Date()): Promise<number> {
  if (!isDigestTime(now)) return 0;
  let sent = 0;
  try {
    const pending = await db.alertEvent.findMany({
      where: { status: "pending_digest" },
      orderBy: { createdAt: "asc" },
      select: { id: true, organizationId: true, projectId: true, title: true, body: true, link: true },
      take: 1000,
    });
    const byProject = new Map<string, typeof pending>();
    for (const e of pending) byProject.set(e.projectId, [...(byProject.get(e.projectId) ?? []), e]);
    const day = now.toISOString().slice(0, 10);

    for (const [projectId, events] of [...byProject].slice(0, MAX_DIGEST_PROJECTS_PER_TICK)) {
      const organizationId = events[0]!.organizationId;
      const key = `${projectId}:${day}`;
      try {
        if (!(await claimOnce({ kind: DIGEST_KIND, key, organizationId, channel: "email" }))) continue;
        const [project, settings, org] = await Promise.all([
          db.project.findFirst({ where: { id: projectId, organizationId }, select: { name: true } }),
          db.alertSettings.findFirst({ where: { projectId, organizationId }, select: { config: true } }),
          db.organization.findUnique({ where: { id: organizationId }, select: { planId: true, whatsappOptIn: true, whatsappNumber: true } }),
        ]);
        if (!project || !org) continue;
        const config = readAlertConfig(settings?.config);
        const recipients = await resolveRecipients(organizationId, config.recipients.slice(0, alertLimitsFor(org.planId).maxRecipients));
        const d = digestContent(project.name, events);
        const used: AlertChannel[] = [];
        if (config.channels.email) {
          const content = renderEmail({
            title: d.title,
            preheader: events[0]!.title,
            paragraphs: d.paragraphs,
            cta: { label: "See alerts", url: appLink(`/app/projects/${projectId}/alerts`) },
            footer: `Your daily alert summary for ${project.name}. Change it in the project's Alerts settings.`,
          });
          if (await emailAll(recipients, d.title, content)) used.push("email");
        }
        if (config.channels.whatsapp && alertLimitsFor(org.planId).whatsapp) {
          const text = waText(d.title, events.slice(0, 8).map((e) => `• ${e.title}`).join("\n"), `/app/projects/${projectId}/alerts`);
          if (await whatsappOnce({ kind: ALERT_WA_KIND, key: `digest:${key}`, organizationId, org, text })) used.push("whatsapp");
        }
        const couldSend =
          (config.channels.email && isEmailConfigured() && recipients.length > 0) ||
          (config.channels.whatsapp && alertLimitsFor(org.planId).whatsapp && canWhatsApp(org) && isWhatsAppConfigured());
        if (used.length === 0 && couldSend) {
          // Nothing went out although a channel is on: free today's claim so a later tick retries.
          await releaseClaim(DIGEST_KIND, key);
          continue;
        }
        await db.alertEvent.updateMany({
          where: { id: { in: events.map((e) => e.id) }, organizationId, status: "pending_digest" },
          data: { status: "sent", deliveredAt: now, channels: [...(config.channels.inApp ? ["in_app"] : []), ...used] as Prisma.InputJsonValue },
        });
        sent++;
      } catch (e) {
        log.error("alerts.digest_failed", { projectId, err: e });
      }
    }
  } catch (e) {
    log.error("alerts.digest_tick_failed", { err: e });
  }
  return sent;
}
