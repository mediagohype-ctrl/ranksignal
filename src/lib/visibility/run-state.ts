// What the customer should be told about the latest AI check: not started, running (with progress), waiting
// until tomorrow because an AI spend limit was reached, done or failed. One helper for every screen (Home,
// AI answers, Full report, setup, listings) so none of them shows an endless "Collecting AI answers… 1 of 75".
//
// Where "waiting until tomorrow" comes from (no schema change): when a limit stops a check, the visibility job
// (deferToTomorrow in ./job.ts) puts a NEW WorkflowRun in the queue with `runAfter` = just after 00:00 UTC and
// `input.deferrals` / `input.deferReason` set, and points VisibilityRun.workflowRunId at it. So a run is
// "waiting" exactly while its workflow row is still queued with deferrals ≥ 1 and a runAfter in the future —
// read straight from the queue row, so it can never go stale (once the worker claims it, it is "running" again).
// Pure and client-safe; the database read lives in ./run-state-server.ts (getAiCheckState).

export type AiCheckState = "none" | "running" | "waiting_tomorrow" | "done" | "failed";
export type AiPauseReason = "daily" | "monthly";

export interface AiCheckStatus {
  state: AiCheckState;
  runId: string | null;
  /** Answers in so far (running / waiting) or collected by the finished check. */
  collected: number;
  /** Answers the check set out to collect (0 until the check has been sized). */
  expected: number;
  /** When a waiting check continues (ISO). */
  resumeAt: string | null;
  /** Which limit paused it. */
  reason: AiPauseReason | null;
  /** How many times this check has been put off to the next day. */
  deferrals: number;
  /** True when no earlier AI check of this website ever finished (this is the first one). */
  first: boolean;
}

export const AI_CHECK_NONE: AiCheckStatus = {
  state: "none", runId: null, collected: 0, expected: 0, resumeAt: null, reason: null, deferrals: 0, first: true,
};

export const AI_RUN_IN_FLIGHT = ["queued", "running"];
export const AI_RUN_DONE = ["succeeded", "succeeded_with_warnings"];
const IN_FLIGHT = AI_RUN_IN_FLIGHT;
const DONE = AI_RUN_DONE;
const WF_WAITING = ["queued", "retry_scheduled"];

export interface RunLite {
  id: string;
  status: string;
  collected: number;
  sampleSize: number;
}
export interface WorkflowLite {
  state: string;
  runAfter: Date | string;
  input: unknown;
}

/** Deferral marker written by the job on the resume workflow's input. */
export function readDeferral(input: unknown): { deferrals: number; reason: AiPauseReason } {
  const o = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const n = Number(o.deferrals);
  return {
    deferrals: Number.isFinite(n) && n > 0 ? Math.floor(n) : 0,
    reason: o.deferReason === "monthly" ? "monthly" : "daily",
  };
}

/** Pure: the customer-facing state of one AI check. `wf` is the WorkflowRun the run currently points at. */
export function aiCheckStateOf(run: RunLite | null, wf: WorkflowLite | null, o: { now?: Date; hasEarlierDone?: boolean } = {}): AiCheckStatus {
  if (!run) return { ...AI_CHECK_NONE, first: !o.hasEarlierDone };
  const now = o.now ?? new Date();
  const base = {
    runId: run.id,
    collected: Math.max(0, run.collected),
    expected: Math.max(0, run.sampleSize),
    first: !o.hasEarlierDone,
  };
  const idle = { resumeAt: null, reason: null, deferrals: 0 };
  if (DONE.includes(run.status)) return { state: "done", ...base, ...idle };
  if (!IN_FLIGHT.includes(run.status)) return { state: "failed", ...base, ...idle };
  if (wf && WF_WAITING.includes(wf.state)) {
    const d = readDeferral(wf.input);
    const at = new Date(wf.runAfter);
    if (d.deferrals > 0 && Number.isFinite(at.getTime()) && at.getTime() > now.getTime()) {
      return { state: "waiting_tomorrow", ...base, resumeAt: at.toISOString(), reason: d.reason, deferrals: d.deferrals };
    }
  }
  return { state: "running", ...base, ...idle };
}

const n = (x: number) => x.toLocaleString("en-IN");

/** "12 of 75 answers in" (or "Getting started…" before the check has been sized). */
export function aiProgressLabel(s: Pick<AiCheckStatus, "collected" | "expected">): string {
  return s.expected > 0 ? `${n(Math.min(s.collected, s.expected))} of ${n(s.expected)} answers in` : "Getting started…";
}

export interface AiCheckCopy {
  /** Short heading, e.g. "Your AI check is running". */
  title: string;
  /** One or two plain sentences. */
  detail: string;
  /** Very short label for a chip / step line. */
  short: string;
}

/**
 * Plain words for a check that is in flight (running or waiting). Null for none / done / failed — those screens
 * keep their own copy. `willEmail`: only promise the "we'll email you" line when emails can really be sent.
 */
export function aiCheckCopy(s: AiCheckStatus, o: { willEmail?: boolean } = {}): AiCheckCopy | null {
  const email = o.willEmail ? " We'll email you when it's done." : "";
  if (s.state === "running") {
    return {
      title: "Your AI check is running",
      detail: `${aiProgressLabel(s)}. This usually takes about 8 minutes, and this page updates by itself.${email}`,
      short: s.expected > 0 ? aiProgressLabel(s) : "Asking AI tools…",
    };
  }
  if (s.state === "waiting_tomorrow") {
    const got = s.expected > 0 ? `We collected ${n(Math.min(s.collected, s.expected))} of ${n(s.expected)} answers so far. ` : "";
    const why = s.reason === "monthly" ? "This month's AI limit is reached" : "Today's AI limit is reached";
    return {
      title: "Your AI check will finish tomorrow",
      detail: `${got}${why}, so we'll collect the rest automatically tomorrow. Nothing you need to do.${email}`,
      short: s.expected > 0 ? `${aiProgressLabel(s)} — the rest tomorrow` : "Continues tomorrow",
    };
  }
  return null;
}

/** True while a check is queued, running or waiting for tomorrow — never show "not asked yet" then. */
export function aiCheckInFlight(s: Pick<AiCheckStatus, "state">): boolean {
  return s.state === "running" || s.state === "waiting_tomorrow";
}

/**
 * Stored report summaries were written when the WEBSITE check finished, so they can say "We haven't asked real AI
 * assistants about you yet…" while an AI check is already running. Swap that sentence for the live status. Pure.
 */
export function withLiveAiSentence(text: string, copy: Pick<AiCheckCopy, "title" | "short"> | null): string {
  if (!copy) return text;
  return text.replace(/We haven't asked (?:real )?AI assistants about you yet[^.]*\./g, `${copy.title} (${copy.short}).`);
}
