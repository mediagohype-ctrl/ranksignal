// Customer alert rules (per project): catalogue, defaults, stored-config parsing and plan limits. Pure — no DB.
// Stored in AlertSettings.config; a project without a row gets DEFAULT_ALERT_CONFIG (every rule on).
import { z } from "zod";
import type { PlanId } from "@/lib/types";

export const ALERT_RULE_IDS = [
  "score_drop",
  "new_urgent_problem",
  "site_down",
  "ai_mention_drop",
  "ai_question_change",
  "indexing_blocked",
  "search_clicks_drop",
] as const;
export type AlertRuleId = (typeof ALERT_RULE_IDS)[number];

export type AlertSeverity = "urgent" | "warning" | "info";
export type AlertChannel = "in_app" | "email" | "whatsapp";
export type AlertDigest = "instant" | "daily";

export interface RuleMeta {
  id: AlertRuleId;
  label: string;
  help: string;
  /** When the rule is checked (shown on the settings page). */
  checkedAfter: string;
  threshold?: { label: string; unit: string; min: number; max: number; default: number };
}

export const ALERT_RULES: RuleMeta[] = [
  {
    id: "score_drop",
    label: "Overall score drops",
    help: "Your overall score fell by at least this many points since the last check.",
    checkedAfter: "website check or AI check",
    threshold: { label: "Points", unit: "points", min: 1, max: 50, default: 5 },
  },
  {
    id: "new_urgent_problem",
    label: "A new urgent problem appears",
    help: "The latest website check found an urgent (high-impact) problem that wasn't there last time.",
    checkedAfter: "website check",
  },
  {
    id: "site_down",
    label: "Website can't be reached",
    help: "We couldn't read your website in this many website checks in a row.",
    checkedAfter: "website check",
    threshold: { label: "Checks in a row", unit: "checks", min: 1, max: 5, default: 2 },
  },
  {
    id: "ai_mention_drop",
    label: "AI mentions drop",
    help: "AI assistants named you in a smaller share of answers — down by at least this many percentage points.",
    checkedAfter: "AI check",
    threshold: { label: "Percentage points", unit: "points", min: 1, max: 50, default: 10 },
  },
  {
    id: "ai_question_change",
    label: "Named / not named for a tracked question",
    help: "A customer question where AI assistants started — or stopped — naming you.",
    checkedAfter: "AI check",
  },
  {
    id: "indexing_blocked",
    label: "A page gets hidden from Google",
    help: "A page now tells Google not to show it (noindex), or your robots.txt file now blocks it.",
    checkedAfter: "website check",
  },
  {
    id: "search_clicks_drop",
    label: "Google clicks drop",
    help: "Clicks from Google Search fell by at least this much compared with the week before (needs Search Console).",
    checkedAfter: "Search Console sync",
    threshold: { label: "Drop", unit: "%", min: 10, max: 90, default: 30 },
  },
];

export const RULE_META: Record<AlertRuleId, RuleMeta> = Object.fromEntries(ALERT_RULES.map((r) => [r.id, r])) as Record<AlertRuleId, RuleMeta>;

/** De-duplication window per rule: the same alert (rule + key) is not sent again inside it. */
const DAY_MS = 86_400_000;
export const RULE_COOLDOWN_MS: Record<AlertRuleId, number> = {
  score_drop: DAY_MS,
  new_urgent_problem: DAY_MS,
  site_down: DAY_MS,
  ai_mention_drop: DAY_MS,
  ai_question_change: DAY_MS,
  indexing_blocked: DAY_MS,
  // Search Console syncs daily; a week-over-week drop stays true for days, so one alert per week is enough.
  search_clicks_drop: 7 * DAY_MS,
};

export interface RuleConfig {
  enabled: boolean;
  threshold?: number;
}

export interface AlertConfig {
  rules: Record<AlertRuleId, RuleConfig>;
  channels: { inApp: boolean; email: boolean; whatsapp: boolean };
  /** userIds of organization members; empty = every owner and admin. */
  recipients: string[];
  /** daily = email/WhatsApp bundled into one message a day (urgent alerts still go out at once). */
  digest: AlertDigest;
}

export function defaultRules(): Record<AlertRuleId, RuleConfig> {
  return Object.fromEntries(
    ALERT_RULES.map((r) => [r.id, r.threshold ? { enabled: true, threshold: r.threshold.default } : { enabled: true }]),
  ) as Record<AlertRuleId, RuleConfig>;
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  rules: defaultRules(),
  channels: { inApp: true, email: true, whatsapp: true },
  recipients: [],
  digest: "instant",
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function clampThreshold(rule: AlertRuleId, v: unknown): number | undefined {
  const t = RULE_META[rule].threshold;
  if (!t) return undefined;
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : t.default;
  return Math.min(t.max, Math.max(t.min, n));
}

/** Defensive read of AlertSettings.config: unknown keys dropped, missing values filled from defaults. */
export function readAlertConfig(raw: unknown): AlertConfig {
  const r = isObj(raw) ? raw : {};
  const rulesIn = isObj(r.rules) ? r.rules : {};
  const rules = defaultRules();
  for (const id of ALERT_RULE_IDS) {
    const v = rulesIn[id];
    if (!isObj(v)) continue;
    rules[id] = {
      enabled: typeof v.enabled === "boolean" ? v.enabled : true,
      ...(RULE_META[id].threshold ? { threshold: clampThreshold(id, v.threshold) } : {}),
    };
  }
  const ch = isObj(r.channels) ? r.channels : {};
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  return {
    rules,
    channels: { inApp: bool(ch.inApp, true), email: bool(ch.email, true), whatsapp: bool(ch.whatsapp, true) },
    recipients: Array.isArray(r.recipients) ? [...new Set(r.recipients.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 64))].slice(0, 100) : [],
    digest: r.digest === "daily" ? "daily" : "instant",
  };
}

export function threshold(config: AlertConfig, rule: AlertRuleId): number {
  return config.rules[rule]?.threshold ?? RULE_META[rule].threshold?.default ?? 0;
}

export function isRuleOn(config: AlertConfig, rule: AlertRuleId): boolean {
  return config.rules[rule]?.enabled !== false;
}

// ------------------------------------------------------------------------------------------------ input (API)

const ruleInput = z.object({ enabled: z.boolean(), threshold: z.number().finite().optional() }).strict();

export const alertConfigInputSchema = z
  .object({
    rules: z.object(Object.fromEntries(ALERT_RULE_IDS.map((id) => [id, ruleInput.optional()])) as Record<AlertRuleId, z.ZodOptional<typeof ruleInput>>).strict(),
    channels: z.object({ inApp: z.boolean(), email: z.boolean(), whatsapp: z.boolean() }).strict(),
    recipients: z.array(z.string().min(1).max(64)).max(100),
    digest: z.enum(["instant", "daily"]),
  })
  .strict();
export type AlertConfigInput = z.infer<typeof alertConfigInputSchema>;

/** Validated input → stored config (thresholds clamped, duplicates removed). */
export function toStoredConfig(input: AlertConfigInput): AlertConfig {
  return readAlertConfig(input);
}

// ------------------------------------------------------------------------------------------------ plan limits

export interface AlertPlanLimits {
  /** Named recipients a project's alerts can go to (owners + admins by default). */
  maxRecipients: number;
  whatsapp: boolean;
  digest: boolean;
}

/** Proposed plan limits for alerts (the lead wires these into the pricing tables). */
export const ALERT_PLAN_LIMITS: Record<PlanId, AlertPlanLimits> = {
  trial: { maxRecipients: 3, whatsapp: true, digest: true },
  starter: { maxRecipients: 3, whatsapp: true, digest: true },
  growth: { maxRecipients: 10, whatsapp: true, digest: true },
  agency: { maxRecipients: 50, whatsapp: true, digest: true },
};

export function alertLimitsFor(planId: string): AlertPlanLimits {
  return (ALERT_PLAN_LIMITS as Record<string, AlertPlanLimits>)[planId] ?? ALERT_PLAN_LIMITS.trial;
}
