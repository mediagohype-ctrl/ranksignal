// Plan limits for AI bot visit analytics (proposed; the lead wires them into the plan tables). Pure.
import type { PlanId } from "@/lib/types";

export interface AiBotPlanLimits {
  /** Log uploads per project per UTC day. */
  uploadsPerDay: number;
  /** The token-authenticated ingest endpoint (Cloudflare Worker / edge function). */
  ingest: boolean;
  /** Days of daily aggregates kept. */
  historyDays: number;
}

export const AI_BOT_LIMITS: Record<PlanId, AiBotPlanLimits> = {
  trial: { uploadsPerDay: 3, ingest: false, historyDays: 30 },
  starter: { uploadsPerDay: 10, ingest: true, historyDays: 90 },
  growth: { uploadsPerDay: 20, ingest: true, historyDays: 180 },
  agency: { uploadsPerDay: 50, ingest: true, historyDays: 400 },
};

export function aiBotLimitsFor(planId: string | null | undefined): AiBotPlanLimits {
  return AI_BOT_LIMITS[(planId ?? "trial") as PlanId] ?? AI_BOT_LIMITS.trial;
}

/** Ingest endpoint limits (per project). */
export const INGEST_LIMITS = {
  maxBodyBytes: 1024 * 1024,
  maxEventsPerBatch: 1000,
  // The Worker sends one small request per crawler hit, so this is per-hit headroom, not batches.
  requestsPerMinute: 300,
} as const;
