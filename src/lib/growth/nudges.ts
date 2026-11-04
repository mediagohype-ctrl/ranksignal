// Trial-to-paid nudges (brief §9): day 1 "Your first fix", day 3 "AI answers are in", day 6 "Trial ends tomorrow".
// One of each per organization (SentMessage kind trial_day1/3/6, key = orgId), trial plan only, to owners with a
// confirmed email (+ WhatsApp when opted in). Staff get "trial ends in 2 days" (kind staff_trial_ending, key orgId).
import { db } from "@/lib/db";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { getStoredReport } from "@/lib/report/stored";
import type { SiteReport } from "@/lib/report/types";
import { appLink, trialDay1Template, trialDay3Template, trialDay6Template, type EmailContent } from "@/lib/email/templates";
import { sendStaffAlert } from "@/lib/alerts/staff";
import { BRAND } from "@/lib/brand";
import { alreadySent } from "./once";
import { emailOnce, verifiedRecipients, whatsappOnce } from "./deliver";
import { aiNamedCounts, projectPaths } from "./paths";

const DAY_MS = 24 * 60 * 60 * 1000;
export const TRIAL_NUDGE_KINDS = ["trial_day1", "trial_day3", "trial_day6"] as const;
export type TrialNudgeKind = (typeof TRIAL_NUDGE_KINDS)[number];
export const STAFF_TRIAL_ENDING_KIND = "staff_trial_ending";
const MAX_ORGS_PER_TICK = 50;

/**
 * The one nudge due right now, or null. Each nudge has a window so a late tick still sends it, but an organization
 * that is already past a window doesn't get stale mail (no "your first fix" on day 5):
 *   day1: 1 ≤ days < 3 · day3: 3 ≤ days < 6 · day6 ("ends tomorrow"): the last 36 hours before trialEndsAt.
 * day6 is timed from the end, not the start, so a trial extended by a referral still gets it the day before it ends.
 */
export function dueTrialNudge(o: { trialStart: Date; trialEndsAt: Date; now: Date }): TrialNudgeKind | null {
  const now = o.now.getTime();
  if (now >= o.trialEndsAt.getTime() || now < o.trialStart.getTime()) return null;
  const days = (now - o.trialStart.getTime()) / DAY_MS;
  if (o.trialEndsAt.getTime() - now <= 1.5 * DAY_MS) return "trial_day6";
  if (days >= 3 && days < 6) return "trial_day3";
  if (days >= 1 && days < 3) return "trial_day1";
  return null;
}

/** Staff heads-up window: the trial ends within the next 2 days (and hasn't ended). */
export function trialEndingSoon(o: { trialEndsAt: Date; now: Date }): boolean {
  const left = o.trialEndsAt.getTime() - o.now.getTime();
  return left > 0 && left <= 2 * DAY_MS;
}

/** SentMessage dedupe key for a trial nudge: one per organization, ever. */
export function trialNudgeKey(organizationId: string): string {
  return organizationId;
}

function whatsappText(kind: TrialNudgeKind, o: { report: SiteReport | null; link: string }): string {
  if (kind === "trial_day1") {
    const fix = o.report?.issues[0]?.title;
    return fix ? `${BRAND.name}: your first fix is ready — ${fix}. Start here: ${o.link}` : `${BRAND.name}: your first fixes are ready. Start here: ${o.link}`;
  }
  if (kind === "trial_day3") {
    const c = o.report ? aiNamedCounts(o.report) : null;
    return c
      ? `${BRAND.name}: AI answers are in. AI named you in ${c.named} of ${c.total} answers. See what AI says: ${o.link}`
      : `${BRAND.name}: see what ChatGPT and other AI tools say about your business: ${o.link}`;
  }
  return `${BRAND.name}: your free trial ends tomorrow. Choose a plan to keep your weekly checks: ${o.link}`;
}

function emailFor(kind: TrialNudgeKind, o: { report: SiteReport | null; projectId: string | null; orgName: string }): { content: EmailContent; link: string } {
  const paths = o.projectId ? projectPaths(o.projectId) : null;
  if (kind === "trial_day1") {
    const link = appLink(paths?.todo ?? "/app");
    const top = o.report?.issues[0] ?? null;
    return { link, content: trialDay1Template({ orgName: o.orgName, fixTitle: top?.title ?? null, fixWhy: top?.whyItMatters ?? null, link }) };
  }
  if (kind === "trial_day3") {
    const link = appLink(paths?.answers ?? "/app");
    const c = o.report ? aiNamedCounts(o.report) : null;
    return { link, content: trialDay3Template({ orgName: o.orgName, named: c?.named ?? null, total: c?.total ?? null, link }) };
  }
  const link = appLink("/app/settings/billing");
  return { link, content: trialDay6Template({ orgName: o.orgName, score: o.report?.overall.score ?? null, link }) };
}

/** Send due trial nudges + staff "ending soon" alerts. Returns the number of nudges sent. */
export async function runTrialNudges(now = new Date()): Promise<number> {
  const orgs = await db.organization.findMany({
    where: { planId: "trial", status: "active", createdAt: { gte: new Date(now.getTime() - (TRIAL_DAYS + 120) * DAY_MS) } },
    select: {
      id: true, name: true, createdAt: true, whatsappOptIn: true, whatsappNumber: true,
      subscriptions: { where: { status: "trialing" }, orderBy: { createdAt: "desc" }, take: 1, select: { trialEndsAt: true, currentPeriodStart: true } },
      projects: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const candidates = orgs.map((org) => {
    const sub = org.subscriptions[0];
    const trialStart = sub?.currentPeriodStart ?? org.createdAt;
    const trialEndsAt = sub?.trialEndsAt ?? new Date(org.createdAt.getTime() + TRIAL_DAYS * DAY_MS);
    return { org, trialEndsAt, kind: dueTrialNudge({ trialStart, trialEndsAt, now }) };
  });

  // Staff alerts are cheap; sendStaffAlert does its own once-per-(kind,key) dedupe.
  for (const c of candidates) {
    if (!trialEndingSoon({ trialEndsAt: c.trialEndsAt, now })) continue;
    await sendStaffAlert({
      kind: STAFF_TRIAL_ENDING_KIND,
      key: c.org.id,
      organizationId: c.org.id,
      subject: `Trial ends in 2 days: ${c.org.name}`,
      text: `${c.org.name} (${c.org.id}) is on the free trial, which ends ${c.trialEndsAt.toISOString().slice(0, 16).replace("T", " ")} UTC. A short call now is the best chance to convert.`,
    }).catch((e: unknown) => console.error("[growth] staff alert failed:", e instanceof Error ? e.message : e));
  }

  let sent = 0;
  for (const kind of TRIAL_NUDGE_KINDS) {
    const due = candidates.filter((c) => c.kind === kind);
    const done = await alreadySent(kind, due.map((c) => trialNudgeKey(c.org.id)));
    for (const c of due.filter((x) => !done.has(trialNudgeKey(x.org.id))).slice(0, MAX_ORGS_PER_TICK)) {
      try {
        const projectId = c.org.projects[0]?.id ?? null;
        const report = projectId ? await getStoredReport(projectId, c.org.id).catch(() => null) : null;
        const { content, link } = emailFor(kind, { report, projectId, orgName: c.org.name });
        const to = await verifiedRecipients(c.org.id, ["owner"]);
        if (await emailOnce({ kind, key: trialNudgeKey(c.org.id), organizationId: c.org.id, to, content })) sent++;
        await whatsappOnce({ kind: `wa_${kind}`, key: c.org.id, organizationId: c.org.id, org: c.org, text: whatsappText(kind, { report, link }) });
      } catch (e) {
        console.error(`[growth] ${kind} failed for org ${c.org.id}:`, e instanceof Error ? e.message : e);
      }
    }
  }
  return sent;
}
