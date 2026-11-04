// "Fix of the week" (brief §9): every Monday one easy fix per organization — the stored-report issue with the most
// points per unit of effort — with one button. Dedupe: SentMessage kind fix_of_week, key "<orgId>:<ISO week>".
import { db } from "@/lib/db";
import { getStoredReport } from "@/lib/report/stored";
import type { IssueEffort, IssueImpact, ReportIssue } from "@/lib/report/types";
import { appLink, fixOfWeekTemplate } from "@/lib/email/templates";
import { readNotificationPrefs } from "@/lib/dashboard/project-schema";
import { getOrgAccess } from "@/lib/billing/access";
import { alreadySent, markHandled } from "./once";
import { emailOnce, verifiedRecipients } from "./deliver";
import { isoWeekKey } from "./periods";
import { projectPaths } from "./paths";

export const FIX_OF_WEEK_KIND = "fix_of_week";
const MAX_ORGS_PER_TICK = 25;

/** Score points an issue is worth: its own `points` when the report has them, else by impact. */
const IMPACT_POINTS: Record<IssueImpact, number> = { high: 10, medium: 5, low: 2 };
/** Relative effort (quick = a few minutes in a website editor). */
const EFFORT_COST: Record<IssueEffort, number> = { quick: 1, moderate: 2, involved: 4 };

export function issuePoints(i: ReportIssue): number {
  const own = (i as ReportIssue & { points?: unknown }).points;
  return typeof own === "number" && Number.isFinite(own) && own > 0 ? own : IMPACT_POINTS[i.impact] ?? 1;
}

/** Highest points ÷ effort; ties keep report order (already impact desc, effort asc). null when nothing to fix. */
export function pickFixOfWeek(issues: ReportIssue[]): ReportIssue | null {
  let best: ReportIssue | null = null;
  let bestRatio = -Infinity;
  for (const i of issues) {
    const ratio = issuePoints(i) / (EFFORT_COST[i.effort] ?? 2);
    if (ratio > bestRatio) {
      best = i;
      bestRatio = ratio;
    }
  }
  return best;
}

export function fixOfWeekKey(organizationId: string, now: Date): string {
  return `${organizationId}:${isoWeekKey(now)}`;
}

/** Send this week's fix to paying (non-trial) organizations; trials get the trial nudges instead. */
export async function runFixOfWeek(now = new Date()): Promise<number> {
  const orgs = await db.organization.findMany({
    where: { planId: { not: "trial" }, status: { in: ["active", "past_due"] }, projects: { some: {} } },
    select: { id: true, name: true, projects: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, settings: true } } },
    orderBy: { createdAt: "asc" },
  });
  const done = await alreadySent(FIX_OF_WEEK_KIND, orgs.map((o) => fixOfWeekKey(o.id, now)));
  let sent = 0;
  for (const org of orgs.filter((o) => !done.has(fixOfWeekKey(o.id, now))).slice(0, MAX_ORGS_PER_TICK)) {
    try {
      const skip = () => markHandled({ kind: FIX_OF_WEEK_KIND, key: fixOfWeekKey(org.id, now), organizationId: org.id, channel: "email" });
      if (!(await getOrgAccess(org.id, now)).active) {
        await skip();
        continue;
      }
      let pick: { issue: ReportIssue; projectId: string; projectName: string } | null = null;
      let pickRatio = -Infinity;
      for (const p of org.projects) {
        if (!readNotificationPrefs(p.settings).email) continue;
        const report = await getStoredReport(p.id, org.id).catch(() => null);
        const issue = report ? pickFixOfWeek(report.issues) : null;
        if (!issue) continue;
        const ratio = issuePoints(issue) / (EFFORT_COST[issue.effort] ?? 2);
        if (ratio > pickRatio) {
          pick = { issue, projectId: p.id, projectName: p.name };
          pickRatio = ratio;
        }
      }
      if (!pick) {
        await skip(); // nothing to fix (or emails off) this week
        continue;
      }
      const content = fixOfWeekTemplate({
        projectName: pick.projectName,
        fixTitle: pick.issue.title,
        whyItMatters: pick.issue.whyItMatters,
        firstStep: pick.issue.howToFix[0] ?? null,
        link: appLink(projectPaths(pick.projectId).todo),
      });
      const to = await verifiedRecipients(org.id, ["owner", "admin"]);
      if (await emailOnce({ kind: FIX_OF_WEEK_KIND, key: fixOfWeekKey(org.id, now), organizationId: org.id, to, content })) sent++;
    } catch (e) {
      console.error(`[growth] fix of the week failed for org ${org.id}:`, e instanceof Error ? e.message : e);
    }
  }
  return sent;
}
