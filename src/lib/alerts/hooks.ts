// Entry points called (one line each) where runs finish: crawl job, visibility job, Google sync. They never
// throw and never fail the run that called them — an alert problem is logged and dropped.
import { log } from "@/lib/log";
import { deliverAlerts } from "./deliver";
import { evaluateAfterCrawl, evaluateAfterSearchSync, evaluateAfterVisibility } from "./evaluate";
import type { AlertCandidate } from "./rules";
import type { AlertConfig } from "./config";

type Evaluated = { config: AlertConfig; project: { id: string; name: string } | null; candidates: AlertCandidate[] };

async function run(name: string, o: { organizationId: string; projectId: string }, evaluate: () => Promise<Evaluated>): Promise<number> {
  if (process.env.ALERTS_DISABLED === "true") return 0;
  try {
    const { config, project, candidates } = await evaluate();
    if (!project || candidates.length === 0) return 0;
    return await deliverAlerts({ organizationId: o.organizationId, projectId: project.id, projectName: project.name, config }, candidates);
  } catch (err) {
    log.error("alerts.evaluate_failed", { trigger: name, projectId: o.projectId, orgId: o.organizationId, err });
    return 0;
  }
}

/** After a website check finished — succeeded or failed for good (site-down rule counts failures). */
export function alertsAfterCrawl(o: { organizationId: string; projectId: string; crawlRunId: string }): Promise<number> {
  return run("crawl", o, () => evaluateAfterCrawl(o));
}

/** After an AI check finished. */
export function alertsAfterVisibility(o: { organizationId: string; projectId: string; visibilityRunId: string }): Promise<number> {
  return run("visibility", o, () => evaluateAfterVisibility(o));
}

/** After a successful Search Console sync. Other Google sources are ignored. */
export function alertsAfterGoogleSync(o: { organizationId: string; projectId: string | null; source: string }): Promise<number> {
  if (o.source !== "gsc" || !o.projectId) return Promise.resolve(0);
  const p = { organizationId: o.organizationId, projectId: o.projectId };
  return run("google_sync", p, () => evaluateAfterSearchSync(p));
}
