// Competitor alerts (brief §9): after an AI check, a competitor named for a customer question where it was NOT
// named in the previous check → one email per check ("Upwork is now named for 'best freelance platform in India'").
// Dedupe: SentMessage kind competitor_alert, key = visibilityRunId.
import { db } from "@/lib/db";
import { appLink, competitorAlertTemplate } from "@/lib/email/templates";
import { readNotificationPrefs } from "@/lib/dashboard/project-schema";
import { alreadySent, markHandled } from "./once";
import { emailOnce, verifiedRecipients } from "./deliver";
import { projectPaths } from "./paths";

export const COMPETITOR_ALERT_KIND = "competitor_alert";
const VIS_DONE = ["succeeded", "succeeded_with_warnings"];
const LOOKBACK_MS = 24 * 60 * 60 * 1000;
const MAX_RUNS_PER_TICK = 25;

export interface ObservationLite {
  promptId: string;
  competitorMentions: unknown;
}

export interface NewlyNamed {
  promptId: string;
  competitor: string;
}

/** promptId → competitor names (case-insensitive key → display name) named at least once in that run. */
export function namedByPrompt(obs: ObservationLite[], brandNames: string[] = []): Map<string, Map<string, string>> {
  const brand = new Set(brandNames.map((b) => b.trim().toLowerCase()).filter(Boolean));
  const out = new Map<string, Map<string, string>>();
  for (const o of obs) {
    const cm = o.competitorMentions;
    if (!cm || typeof cm !== "object" || Array.isArray(cm)) continue;
    for (const [name, count] of Object.entries(cm as Record<string, unknown>)) {
      const key = name.trim().toLowerCase();
      if (!key || brand.has(key) || typeof count !== "number" || count <= 0) continue;
      let m = out.get(o.promptId);
      if (!m) out.set(o.promptId, (m = new Map()));
      if (!m.has(key)) m.set(key, name.trim());
    }
  }
  return out;
}

/**
 * Competitors named for a question now that weren't named for it last time. Only questions asked in BOTH checks
 * count (a brand-new question would make every name look "new").
 */
export function newlyNamedCompetitors(prev: ObservationLite[], curr: ObservationLite[], brandNames: string[] = []): NewlyNamed[] {
  const before = namedByPrompt(prev, brandNames);
  const askedBefore = new Set(prev.map((o) => o.promptId));
  const now = namedByPrompt(curr, brandNames);
  const out: NewlyNamed[] = [];
  for (const [promptId, names] of now) {
    if (!askedBefore.has(promptId)) continue;
    const old = before.get(promptId);
    for (const [key, display] of names) if (!old?.has(key)) out.push({ promptId, competitor: display });
  }
  return out;
}

export async function runCompetitorAlerts(now = new Date()): Promise<number> {
  const runs = await db.visibilityRun.findMany({
    where: { status: { in: VIS_DONE }, finishedAt: { gte: new Date(now.getTime() - LOOKBACK_MS), lte: now } },
    orderBy: { finishedAt: "asc" },
    select: { id: true, organizationId: true, projectId: true, finishedAt: true },
    take: 200,
  });
  const done = await alreadySent(COMPETITOR_ALERT_KIND, runs.map((r) => r.id));
  let sent = 0;
  for (const run of runs.filter((r) => !done.has(r.id)).slice(0, MAX_RUNS_PER_TICK)) {
    try {
      const prevRun = await db.visibilityRun.findFirst({
        where: { projectId: run.projectId, organizationId: run.organizationId, status: { in: VIS_DONE }, finishedAt: { lt: run.finishedAt! } },
        orderBy: { finishedAt: "desc" },
        select: { id: true },
      });
      const skip = () => markHandled({ kind: COMPETITOR_ALERT_KIND, key: run.id, organizationId: run.organizationId, channel: "email" });
      if (!prevRun) {
        await skip(); // first check: nothing to compare with
        continue;
      }
      const project = await db.project.findFirst({
        where: { id: run.projectId, organizationId: run.organizationId },
        select: { name: true, brandNames: true, settings: true },
      });
      if (!project || !readNotificationPrefs(project.settings).email) continue;
      const [prevObs, currObs] = await Promise.all(
        [prevRun.id, run.id].map((visibilityRunId) =>
          db.observation.findMany({ where: { organizationId: run.organizationId, visibilityRunId, simulated: false }, select: { promptId: true, competitorMentions: true } }),
        ),
      );
      const brandNames = Array.isArray(project.brandNames) ? (project.brandNames as unknown[]).filter((b): b is string => typeof b === "string") : [];
      const fresh = newlyNamedCompetitors(prevObs, currObs, [project.name, ...brandNames]);
      if (fresh.length === 0) {
        await skip();
        continue;
      }
      const prompts = await db.trackedPrompt.findMany({ where: { id: { in: [...new Set(fresh.map((f) => f.promptId))] } }, select: { id: true, text: true } });
      const text = new Map(prompts.map((p) => [p.id, p.text]));
      const items = fresh.filter((f) => text.has(f.promptId)).map((f) => ({ competitor: f.competitor, question: text.get(f.promptId)! }));
      if (items.length === 0) continue;
      const content = competitorAlertTemplate({ projectName: project.name, items, link: appLink(projectPaths(run.projectId).answers) });
      const to = await verifiedRecipients(run.organizationId, ["owner", "admin"]);
      if (await emailOnce({ kind: COMPETITOR_ALERT_KIND, key: run.id, organizationId: run.organizationId, to, content })) sent++;
    } catch (e) {
      console.error(`[growth] competitor alert failed for run ${run.id}:`, e instanceof Error ? e.message : e);
    }
  }
  return sent;
}
