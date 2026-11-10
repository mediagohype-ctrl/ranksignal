// Shared DataForSEO client for the paid-data features (rank tracker, keyword research, SERP checker, backlinks,
// competitor traffic, gaps, domain comparison). One place for: credentials, timeouts, the owner's daily cost cap
// (reserveAiSpend — the same daily budget the AI checks use), task status handling and the usage ledger.
//
// Usage:
//   const { result, costMicros } = await dfsPost("/v3/serp/google/organic/live/advanced", [task], {
//     feature: "rank_tracker", organizationId, projectId, estimateMicros: 3_000 });
// Every call is recorded in DataForSeoUsage (feature + cost), which src/lib/dataforseo/usage.ts reads for plan allowances.
import { JobError } from "@/lib/types";
import { reserveAiSpend } from "@/lib/billing/ai-budget";
import { db } from "@/lib/db";
import { log } from "@/lib/log";

export const DFS_BASE = "https://api.dataforseo.com";
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

export type DfsFeature =
  | "rank_tracker"
  | "keyword_research"
  | "serp_checker"
  | "backlinks"
  | "competitor_traffic"
  | "keyword_gap"
  | "link_gap"
  | "domain_compare";

type Json = Record<string, unknown>;
export const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** True when DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD are set. Pages show a setup note otherwise. */
export { dfsConfigured } from "./status";

/** Plain-English reason shown when a paid-data feature can't run because DataForSEO isn't connected. */
export const DFS_NOT_CONFIGURED =
  "This feature uses live Google data from our data partner (DataForSEO), which isn't switched on yet. Please check back soon.";

export class DfsError extends JobError {
  constructor(
    message: string,
    kind: "transient" | "permanent",
    readonly statusCode?: number,
  ) {
    super(message, kind);
    this.name = "DfsError";
  }
}

export interface DfsCallOptions {
  feature: DfsFeature;
  organizationId: string;
  projectId?: string | null;
  /** High estimate of the call's cost in micro-USD, reserved against the owner's daily budget before calling. */
  estimateMicros: number;
  /**
   * Units counted against the plan allowance (e.g. keywords checked). Default 1. Pass 0 for follow-up calls that belong
   * to one user action (e.g. calls 2–5 of a backlink refresh): the cost is still recorded, the allowance isn't charged twice.
   */
  units?: number;
  timeoutMs?: number;
}

export interface DfsResponse {
  /** tasks[0].result (DataForSEO wraps every answer in tasks[].result[]). */
  result: unknown[];
  /** All tasks, for batch calls. */
  tasks: Json[];
  costMicros: number;
}

/** Extract tasks + cost from a DataForSEO envelope and throw on task-level errors. Exported for tests. */
export function parseEnvelope(payload: unknown): DfsResponse {
  const root = isObj(payload) ? payload : {};
  const rootStatus = num(root.status_code);
  if (rootStatus !== null && rootStatus !== 20000) {
    throw new DfsError(`DataForSEO error ${rootStatus}: ${str(root.status_message) ?? "unknown"}`, rootStatus >= 50000 ? "transient" : "permanent", rootStatus);
  }
  const tasks = arr(root.tasks).filter(isObj);
  const first = tasks[0];
  const taskStatus = first ? num(first.status_code) : null;
  // 20000 = ok. 40102 = "no search results" (a valid, empty answer).
  if (taskStatus !== null && taskStatus !== 20000 && taskStatus !== 40102) {
    throw new DfsError(
      `DataForSEO task error ${taskStatus}: ${str(first?.status_message) ?? "unknown"}`,
      taskStatus >= 50000 ? "transient" : "permanent",
      taskStatus,
    );
  }
  const costUsd = num(root.cost) ?? tasks.reduce((s, t) => s + (num(t.cost) ?? 0), 0);
  return { result: first ? arr(first.result) : [], tasks, costMicros: Math.round(costUsd * 1_000_000) };
}

/** POST one or more tasks to a DataForSEO endpoint (live mode), with budget hold, timeout and usage recording. */
export async function dfsPost(path: string, tasks: Json[], opts: DfsCallOptions): Promise<DfsResponse> {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new DfsError("DataForSEO is not configured", "permanent");
  if (!path.startsWith("/v3/")) throw new DfsError("bad DataForSEO path", "permanent");

  const hold = await reserveAiSpend(opts.estimateMicros);
  let parsed: DfsResponse;
  try {
    const res = await fetch(`${DFS_BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify(tasks),
      signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new DfsError(`DataForSEO HTTP ${res.status}`, res.status >= 500 || res.status === 429 ? "transient" : "permanent", res.status);
    }
    const text = await res.text();
    if (text.length > MAX_RESPONSE_BYTES) throw new DfsError("DataForSEO response too large", "permanent");
    parsed = parseEnvelope(JSON.parse(text));
  } catch (err) {
    hold.release();
    if (err instanceof DfsError) throw err;
    const name = (err as Error)?.name;
    throw new DfsError(`DataForSEO request failed (${name ?? "error"})`, "transient");
  }
  hold.settle(parsed.costMicros);
  await recordUsage(opts, parsed.costMicros);
  return parsed;
}

async function recordUsage(opts: DfsCallOptions, costMicros: number) {
  try {
    await db.dataForSeoUsage.create({
      data: {
        organizationId: opts.organizationId,
        projectId: opts.projectId ?? null,
        feature: opts.feature,
        units: Math.max(0, Math.round(opts.units ?? 1)),
        costMicros,
      },
    });
  } catch (err) {
    // Never fail a paid call that already succeeded because the ledger write failed.
    log.warn("dataforseo.usage_record_failed", { feature: opts.feature, error: (err as Error)?.message });
  }
}
