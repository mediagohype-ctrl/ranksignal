// Shape + copy for the run-finished toasts (GET /api/projects/[id]/runs/status, src/components/app/run-watcher.tsx).
// Pure: safe for server and client.
import { isActiveStatus } from "@/lib/dashboard/format";

export interface RunStatusItem {
  id: string;
  status: string;
  finishedAt: string | null;
  active: boolean;
  /** Finished successfully (incl. with warnings). */
  done: boolean;
}

export interface RunStatusPayload {
  crawl: (RunStatusItem & { score: number | null; scoreReady: boolean }) | null;
  visibility: (RunStatusItem & { mentioned: number; collected: number }) | null;
}

const OK = ["succeeded", "succeeded_with_warnings"];
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

export function runStatusPayload(
  crawl: { id: string; status: string; finishedAt: Date | null } | null,
  snap: { overallScore: number | null } | null,
  vis: { id: string; status: string; finishedAt: Date | null; collected: number; metrics: unknown } | null,
): RunStatusPayload {
  const m = vis?.metrics && typeof vis.metrics === "object" ? (vis.metrics as { mentionRate?: unknown; collected?: unknown }) : {};
  const collected = typeof m.collected === "number" ? m.collected : (vis?.collected ?? 0);
  const rate = typeof m.mentionRate === "number" ? m.mentionRate : 0;
  return {
    crawl: crawl
      ? {
          id: crawl.id,
          status: crawl.status,
          finishedAt: iso(crawl.finishedAt),
          active: isActiveStatus(crawl.status),
          done: OK.includes(crawl.status),
          score: snap?.overallScore ?? null,
          scoreReady: !!snap,
        }
      : null,
    visibility: vis
      ? {
          id: vis.id,
          status: vis.status,
          finishedAt: iso(vis.finishedAt),
          active: isActiveStatus(vis.status),
          done: OK.includes(vis.status),
          mentioned: Math.round(rate * collected),
          collected,
        }
      : null,
  };
}

/** "Website check done. Score 51." */
export function crawlDoneMessage(c: NonNullable<RunStatusPayload["crawl"]>): { message: string; tone: "success" | "error" } {
  if (!c.done) return { message: "Website check didn't finish. Try again in a few minutes, or contact us.", tone: "error" };
  return { message: c.score !== null ? `Website check done. Score ${c.score}.` : "Website check done.", tone: "success" };
}

/** "AI check done. AI named you in 3 of 30 answers." */
export function aiDoneMessage(v: NonNullable<RunStatusPayload["visibility"]>): { message: string; tone: "success" | "error" } {
  if (!v.done) return { message: "AI check didn't finish. Try again in a few minutes, or contact us.", tone: "error" };
  if (!v.collected) return { message: "AI check done.", tone: "success" };
  return { message: `AI check done. AI named you in ${v.mentioned} of ${v.collected} answer${v.collected === 1 ? "" : "s"}.`, tone: "success" };
}

/** How long a finished website check waits for its score snapshot before the toast goes out without a score. */
export const SCORE_WAIT_MS = 60_000;

/**
 * Should the watcher toast this run now? `prev` is the last item it saw for the same kind, `since` when it started
 * watching (runs that finished before the page opened are not announced).
 */
export function toastDecision(
  prev: RunStatusItem | null | undefined,
  cur: (RunStatusItem & { scoreReady?: boolean }) | null | undefined,
  since: number,
  now: number = Date.now(),
): "toast" | "wait" | null {
  if (!cur || cur.active) return null;
  const finished = cur.finishedAt ? Date.parse(cur.finishedAt) : NaN;
  const sawItRun = !!prev && prev.id === cur.id && prev.active;
  const newSinceOpen = (!prev || prev.id !== cur.id) && Number.isFinite(finished) && finished >= since;
  if (!sawItRun && !newSinceOpen) return null;
  if (cur.done && cur.scoreReady === false && (!Number.isFinite(finished) || now - finished < SCORE_WAIT_MS)) return "wait";
  return "toast";
}
