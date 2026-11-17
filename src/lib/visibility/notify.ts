// What the owner is told about an AI check outside the page: the "paused until tomorrow" notification + email,
// and the "named for the first time" celebration. Builders are pure (tested); senders never throw — a notification
// problem must never fail or stall the check itself.
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { log } from "@/lib/log";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import { renderEmail } from "@/lib/email/layout";
import { wantsEmail } from "@/lib/dashboard/project-schema";
import { productNames } from "@/lib/report/checks/geo";
import type { AiPauseReason } from "./run-state";

export const DEFERRED_NOTIFICATION_TYPE = "visibility_deferred";
export const FIRST_MENTION_NOTIFICATION_TYPE = "first_ai_mention";

const n = (x: number) => x.toLocaleString("en-IN");

export interface PausedNotice {
  title: string;
  body: string;
  email: { subject: string; preheader: string; paragraphs: string[]; ctaLabel: string };
}

/** Plain words for "your AI check is paused until tomorrow" (in-app + email). Pure. */
export function pausedNotice(o: { projectName: string; collected: number; expected: number; reason: AiPauseReason }): PausedNotice {
  const why = o.reason === "monthly" ? "This month's AI limit is reached" : "Today's AI limit is reached";
  const got = `We collected ${n(o.collected)} of ${n(o.expected)} AI answers so far.`;
  const rest = `${why}, so we'll collect the rest automatically tomorrow. There's nothing you need to do.`;
  return {
    title: "We'll finish the rest of your AI check tomorrow",
    body: `${got} ${rest}`,
    email: {
      subject: `Your AI check for ${o.projectName} will finish tomorrow`,
      preheader: `${got} The rest comes in automatically tomorrow.`,
      paragraphs: [
        `Your AI check for ${o.projectName} is paused until tomorrow.`,
        got,
        rest,
        "The answers we already have are safe, and the answers still to come stay set aside for this check. We'll tell you when your AI results are ready.",
      ],
      ctaLabel: "See the answers so far",
    },
  };
}

/** Owners and admins of a workspace (the same people every run email goes to). */
export async function ownerEmails(organizationId: string): Promise<string[]> {
  const members = await db.membership.findMany({
    where: { organizationId, status: "active", role: { in: ["owner", "admin"] } },
    select: { user: { select: { email: true } } },
  });
  return [...new Set(members.map((m) => m.user.email).filter(Boolean))];
}

/**
 * In-app notification every time a check is put off to the next day (one per run + day), and ONE email per check
 * (on its first pause — not one every day). Never throws.
 */
export async function notifyCheckPaused(o: {
  organizationId: string;
  projectId: string;
  runId: string;
  collected: number;
  expected: number;
  reason: AiPauseReason;
  /** 1 = the first time this check is paused. */
  deferrals: number;
  /** UTC day (YYYY-MM-DD) the check continues — part of the dedupe link. */
  day: string;
}): Promise<void> {
  try {
    const project = await db.project.findFirst({ where: { id: o.projectId, organizationId: o.organizationId }, select: { name: true, settings: true } });
    const notice = pausedNotice({ projectName: project?.name ?? "your website", collected: o.collected, expected: o.expected, reason: o.reason });
    const link = `/app/projects/${o.projectId}/visibility?run=${o.runId}&waiting=${o.day}`;
    const already = await db.notification.findFirst({ where: { organizationId: o.organizationId, type: DEFERRED_NOTIFICATION_TYPE, link }, select: { id: true } });
    if (!already) {
      await db.notification.create({ data: { organizationId: o.organizationId, type: DEFERRED_NOTIFICATION_TYPE, title: notice.title, body: notice.body, link } });
    }
    if (already || o.deferrals > 1 || !isEmailConfigured() || !wantsEmail(project?.settings, null)) return;
    const { html, text } = renderEmail({
      title: notice.email.subject,
      preheader: notice.email.preheader,
      paragraphs: notice.email.paragraphs,
      cta: { label: notice.email.ctaLabel, url: new URL(link, BRAND.appUrl).toString() },
      footer: `You're getting this because you're an owner or admin on ${BRAND.name}. To stop these emails for this website, open Settings → Emails.`,
    });
    for (const to of await ownerEmails(o.organizationId)) {
      try {
        await sendEmail({ to, subject: notice.email.subject, html, text });
      } catch (e) {
        log.warn("visibility.paused_email_failed", { runId: o.runId, err: e });
      }
    }
  } catch (err) {
    log.warn("visibility.paused_notify_failed", { runId: o.runId, err });
  }
}

// ---------------------------------------------------------------------------------------------- first mention

export interface MentionRow {
  provider: string;
  brandMentioned: boolean;
  simulated: boolean;
}

/** AI tools (product names, most answers first) that named the business in REAL answers of this check. Pure. */
export function mentioningTools(rows: MentionRow[]): string[] {
  const tally = new Map<string, number>();
  for (const r of rows) {
    if (!r.brandMentioned || r.simulated || /simulat/i.test(r.provider)) continue;
    const name = productNames([r.provider]);
    tally.set(name, (tally.get(name) ?? 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

const joinAnd = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * The celebration for the first time any AI tool names the business — null unless this check has a real mention
 * and no earlier check of this website ever had one. Pure.
 */
export function firstMentionNotice(o: { rows: MentionRow[]; mentionedBefore: boolean }): { tools: string[]; title: string; body: string } | null {
  if (o.mentionedBefore) return null;
  const tools = mentioningTools(o.rows);
  if (tools.length === 0) return null;
  const who = joinAnd(tools);
  return {
    tools,
    title: `${who} named you for the first time!`,
    body: `In your latest AI check, ${who} named your business in an answer — the first time we've seen that. Open your AI answers to read what ${tools.length === 1 ? "it" : "they"} said.`,
  };
}

/**
 * Called when a check finishes with answers: if the business was named for the first time ever (no earlier check
 * of this website has a real answer naming it), create the in-app notification. Returns the tools for the banner
 * on the AI answers page (stored on the run's metrics), or null. Never throws.
 */
export async function celebrateFirstMention(o: { organizationId: string; projectId: string; runId: string; rows: MentionRow[] }): Promise<string[] | null> {
  try {
    if (mentioningTools(o.rows).length === 0) return null;
    const earlier = await db.observation.findFirst({
      where: {
        organizationId: o.organizationId,
        brandMentioned: true,
        simulated: false,
        visibilityRunId: { not: o.runId },
        visibilityRun: { projectId: o.projectId },
      },
      select: { id: true },
    });
    const notice = firstMentionNotice({ rows: o.rows, mentionedBefore: !!earlier });
    if (!notice) return null;
    const link = `/app/projects/${o.projectId}/visibility?run=${o.runId}&first=1`;
    const already = await db.notification.findFirst({ where: { organizationId: o.organizationId, type: FIRST_MENTION_NOTIFICATION_TYPE, link }, select: { id: true } });
    if (!already) {
      await db.notification.create({ data: { organizationId: o.organizationId, type: FIRST_MENTION_NOTIFICATION_TYPE, title: notice.title, body: notice.body, link } });
    }
    return notice.tools;
  } catch (err) {
    log.warn("visibility.first_mention_failed", { runId: o.runId, err });
    return null;
  }
}
