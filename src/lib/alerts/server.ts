// Alert settings + history for the settings page and API. Every query is scoped by organizationId.
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { isEmailConfigured } from "@/lib/email/send";
import { isWhatsAppConfigured } from "@/lib/whatsapp/send";
import { alertLimitsFor, readAlertConfig, toStoredConfig, type AlertConfig, type AlertConfigInput, type AlertPlanLimits } from "./config";

export const HISTORY_LIMIT = 50;

export interface AlertHistoryItem {
  id: string;
  rule: string;
  severity: string;
  title: string;
  body: string;
  link: string | null;
  status: string;
  channels: string[];
  createdAt: string;
}

export interface AlertMember {
  userId: string;
  name: string | null;
  email: string;
  role: string;
}

export interface AlertsView {
  config: AlertConfig;
  limits: AlertPlanLimits;
  members: AlertMember[];
  history: AlertHistoryItem[];
  delivery: { emailConfigured: boolean; whatsappConfigured: boolean; whatsappOptIn: boolean };
  updatedAt: string | null;
}

export async function listAlertHistory(organizationId: string, projectId: string, take = HISTORY_LIMIT): Promise<AlertHistoryItem[]> {
  const rows = await db.alertEvent.findMany({
    where: { organizationId, projectId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, rule: true, severity: true, title: true, body: true, link: true, status: true, channels: true, createdAt: true },
  });
  return rows.map((r) => ({
    ...r,
    channels: Array.isArray(r.channels) ? r.channels.filter((c): c is string => typeof c === "string") : [],
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listActiveMembers(organizationId: string): Promise<AlertMember[]> {
  const rows = await db.membership.findMany({
    where: { organizationId, status: "active" },
    orderBy: { createdAt: "asc" },
    select: { userId: true, role: true, user: { select: { name: true, email: true } } },
    take: 500,
  });
  return rows.map((m) => ({ userId: m.userId, role: m.role, name: m.user.name, email: m.user.email }));
}

export async function getAlertsView(organizationId: string, projectId: string, o: { includeMembers: boolean }): Promise<AlertsView> {
  const [settings, org, history, members] = await Promise.all([
    db.alertSettings.findFirst({ where: { organizationId, projectId }, select: { config: true, updatedAt: true } }),
    db.organization.findUnique({ where: { id: organizationId }, select: { planId: true, whatsappOptIn: true, whatsappNumber: true } }),
    listAlertHistory(organizationId, projectId),
    o.includeMembers ? listActiveMembers(organizationId) : Promise.resolve([]),
  ]);
  return {
    config: readAlertConfig(settings?.config),
    limits: alertLimitsFor(org?.planId ?? "trial"),
    members,
    history,
    delivery: {
      emailConfigured: isEmailConfigured(),
      whatsappConfigured: isWhatsAppConfigured(),
      whatsappOptIn: !!org?.whatsappOptIn && !!org.whatsappNumber,
    },
    updatedAt: settings?.updatedAt.toISOString() ?? null,
  };
}

/** Validate recipients against the org's active members + plan limits, then upsert. Returns the stored config. */
export async function saveAlertConfig(o: {
  organizationId: string;
  projectId: string;
  userId: string;
  input: AlertConfigInput;
}): Promise<{ before: AlertConfig; after: AlertConfig }> {
  const org = await db.organization.findUnique({ where: { id: o.organizationId }, select: { planId: true } });
  const limits = alertLimitsFor(org?.planId ?? "trial");
  const next = toStoredConfig(o.input);
  if (next.recipients.length > limits.maxRecipients) {
    throw new HttpError(400, "too_many_recipients", `Your plan allows up to ${limits.maxRecipients} people per project's alerts.`);
  }
  if (next.recipients.length) {
    // Never trust ids from the client: every recipient must be an active member of THIS organization.
    const valid = await db.membership.findMany({
      where: { organizationId: o.organizationId, status: "active", userId: { in: next.recipients } },
      select: { userId: true },
    });
    const ok = new Set(valid.map((m) => m.userId));
    if (next.recipients.some((id) => !ok.has(id))) throw new HttpError(400, "invalid_recipient", "Pick recipients from your team members.");
  }
  if (next.digest === "daily" && !limits.digest) next.digest = "instant";
  if (!limits.whatsapp) next.channels.whatsapp = false;

  const existing = await db.alertSettings.findFirst({ where: { organizationId: o.organizationId, projectId: o.projectId }, select: { id: true, config: true } });
  const before = readAlertConfig(existing?.config);
  const config = next as unknown as Prisma.InputJsonValue;
  if (existing) {
    await db.alertSettings.update({ where: { id: existing.id }, data: { config, updatedById: o.userId } });
  } else {
    await db.alertSettings.create({ data: { organizationId: o.organizationId, projectId: o.projectId, config, updatedById: o.userId } });
  }
  return { before, after: next };
}
