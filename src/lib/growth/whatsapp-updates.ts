// WhatsApp updates for owners who opted in (brief §9):
//   - "Your score went up 4 points" after a check that raised the overall score (kind wa_score_up, key snapshotId)
//   - weekly "3 fixes waiting" (kind wa_fixes_waiting, key "<orgId>:<ISO week>")
// Only when Organization.whatsappOptIn && whatsappNumber.
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { getStoredReport } from "@/lib/report/stored";
import { appLink } from "@/lib/email/templates";
import { alreadySent, markHandled } from "./once";
import { whatsappOnce } from "./deliver";
import { isoWeekKey } from "./periods";
import { projectPaths } from "./paths";

export const WA_SCORE_UP_KIND = "wa_score_up";
export const WA_FIXES_WAITING_KIND = "wa_fixes_waiting";
const LOOKBACK_MS = 24 * 60 * 60 * 1000;
const OPTED_IN = { whatsappOptIn: true, whatsappNumber: { not: null } } as const;

/** Points gained, or null when the score didn't go up (or either side wasn't measured). */
export function scoreGain(prev: number | null | undefined, curr: number | null | undefined): number | null {
  if (typeof prev !== "number" || typeof curr !== "number") return null;
  const d = Math.round(curr) - Math.round(prev);
  return d > 0 ? d : null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function scoreUpText(o: { projectName: string; gain: number; score: number; link: string }): string {
  return `${BRAND.name}: good news! ${o.projectName}'s score went up ${plural(o.gain, "point", "points")} to ${Math.round(o.score)}. See what changed: ${o.link}`;
}

export function fixesWaitingText(o: { projectName: string; count: number; link: string }): string {
  return `${BRAND.name}: ${plural(o.count, "fix is", "fixes are")} waiting for ${o.projectName}. Each one helps Google and AI find you. Start here: ${o.link}`;
}

export async function runScoreUpWhatsApp(now = new Date()): Promise<number> {
  const snaps = await db.reportSnapshot.findMany({
    where: {
      createdAt: { gte: new Date(now.getTime() - LOOKBACK_MS), lte: now },
      overallScore: { not: null },
      project: { organization: OPTED_IN },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationId: true, projectId: true, overallScore: true, createdAt: true, project: { select: { name: true } } },
    take: 200,
  });
  const done = await alreadySent(WA_SCORE_UP_KIND, snaps.map((s) => s.id));
  let sent = 0;
  for (const s of snaps.filter((x) => !done.has(x.id))) {
    try {
      const prev = await db.reportSnapshot.findFirst({
        where: { projectId: s.projectId, organizationId: s.organizationId, createdAt: { lt: s.createdAt }, overallScore: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { overallScore: true },
      });
      const gain = scoreGain(prev?.overallScore, s.overallScore);
      if (gain === null) continue;
      const org = await db.organization.findUnique({ where: { id: s.organizationId }, select: { whatsappOptIn: true, whatsappNumber: true } });
      const text = scoreUpText({ projectName: s.project.name, gain, score: s.overallScore!, link: appLink(projectPaths(s.projectId).progress) });
      if (await whatsappOnce({ kind: WA_SCORE_UP_KIND, key: s.id, organizationId: s.organizationId, org, text })) sent++;
    } catch (e) {
      console.error(`[growth] score-up whatsapp failed for snapshot ${s.id}:`, e instanceof Error ? e.message : e);
    }
  }
  return sent;
}

export async function runFixesWaitingWhatsApp(now = new Date()): Promise<number> {
  const orgs = await db.organization.findMany({
    where: { ...OPTED_IN, status: { in: ["active", "past_due"] }, projects: { some: {} } },
    select: { id: true, whatsappOptIn: true, whatsappNumber: true, projects: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true, name: true } } },
  });
  const key = (orgId: string) => `${orgId}:${isoWeekKey(now)}`;
  const done = await alreadySent(WA_FIXES_WAITING_KIND, orgs.map((o) => key(o.id)));
  let sent = 0;
  for (const org of orgs.filter((o) => !done.has(key(o.id))).slice(0, 25)) {
    try {
      const p = org.projects[0]!;
      const report = await getStoredReport(p.id, org.id).catch(() => null);
      const count = report?.issues.length ?? 0;
      if (count === 0) {
        await markHandled({ kind: WA_FIXES_WAITING_KIND, key: key(org.id), organizationId: org.id, channel: "whatsapp" });
        continue;
      }
      const text = fixesWaitingText({ projectName: p.name, count, link: appLink(projectPaths(p.id).todo) });
      if (await whatsappOnce({ kind: WA_FIXES_WAITING_KIND, key: key(org.id), organizationId: org.id, org, text })) sent++;
    } catch (e) {
      console.error(`[growth] fixes-waiting whatsapp failed for org ${org.id}:`, e instanceof Error ? e.message : e);
    }
  }
  return sent;
}
