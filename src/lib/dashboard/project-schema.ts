// Validation for project settings shared by POST /api/projects and PATCH /api/projects/[id].
// Pure (zod only) so client components and the job scheduler can import it too.
import { z } from "zod";
import { projectInputSchema } from "@/lib/types";

export const SCHEDULE_FREQUENCIES = ["off", "weekly", "monthly"] as const;
export type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];
export interface ProjectSchedule {
  crawl: ScheduleFrequency;
  visibility: ScheduleFrequency;
}
/** Applied whenever settings.schedule (or one of its keys) is absent — e.g. every new project. */
export const DEFAULT_SCHEDULE: ProjectSchedule = { crawl: "weekly", visibility: "monthly" };

/** Days between automatic runs for a frequency; null when off. */
export function frequencyDays(f: ScheduleFrequency): number | null {
  return f === "weekly" ? 7 : f === "monthly" ? 30 : null;
}

/** Settings keys owned by dedicated endpoints (e.g. share links: POST /api/projects/[id]/share, admin-only). */
export const SERVER_OWNED_SETTINGS = ["share"] as const;

export function omitServerOwned<T extends Record<string, unknown>>(v: T): T {
  const out = { ...v };
  for (const k of SERVER_OWNED_SETTINGS) delete (out as Record<string, unknown>)[k];
  return out;
}

const frequency = z.enum(SCHEDULE_FREQUENCIES);
export const scheduleSchema = z.object({ crawl: frequency.optional(), visibility: frequency.optional() }).strict();
/**
 * Email switches. `email` is the old project-wide switch (kept: off = no emails at all); the three named switches
 * (brief 5.8 "Emails") are each on unless set to false.
 */
export const EMAIL_KINDS = ["monthlyReport", "fixesWaiting", "checkFailed"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];
export const notificationPrefsSchema = z
  .object({
    email: z.boolean().optional(),
    monthlyReport: z.boolean().optional(),
    fixesWaiting: z.boolean().optional(),
    checkFailed: z.boolean().optional(),
  })
  .strict();

/** Business facts the owner confirmed (Project.facts). Every field optional; empty strings clear a field. */
const factText = (max: number) => z.string().trim().max(max);
export const projectFactsSchema = z
  .object({
    name: factText(120).optional(),
    sells: factText(300).optional(),
    customers: factText(300).optional(),
    city: factText(120).optional(),
    country: factText(80).optional(),
    language: factText(40).optional(),
  })
  .strict();
export type ProjectFacts = z.infer<typeof projectFactsSchema>;

export function readFacts(v: unknown): ProjectFacts {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: ProjectFacts = {};
  for (const k of ["name", "sells", "customers", "city", "country", "language"] as const) {
    const x = (v as Record<string, unknown>)[k];
    if (typeof x === "string") out[k] = x;
  }
  return out;
}

export const projectSettingsSchema = z
  .object({
    maxPagesPerCrawl: z.number().int().min(1).max(10_000).optional(),
    automation: z.object({ allowClassB: z.array(z.string().min(1).max(64)).max(50).default([]) }).optional(),
    schedule: scheduleSchema.optional(),
    notifications: notificationPrefsSchema.optional(),
    /** Customer's "Pause all changes" switch: nothing is published to the website while true. */
    paused: z.boolean().optional(),
  })
  .passthrough()
  // Server-owned keys can never be written through project create/PATCH bodies.
  .transform((v) => omitServerOwned(v));

export type ProjectSettingsInput = z.infer<typeof projectSettingsSchema>;

/**
 * Create: only known keys are accepted (.strict()), so a body can't smuggle in settings that other modules read
 * (keyPages, highTrafficUrls, businessFacts, …). `share` is tolerated but always stripped (server-owned).
 */
export const projectCreateSettingsSchema = z
  .object({
    maxPagesPerCrawl: z.number().int().min(1).max(10_000).optional(),
    automation: z.object({ allowClassB: z.array(z.string().min(1).max(64)).max(50).default([]) }).strict().optional(),
    schedule: scheduleSchema.optional(),
    notifications: notificationPrefsSchema.optional(),
    paused: z.boolean().optional(),
    share: z.unknown().optional(),
  })
  .strict()
  .transform((v) => omitServerOwned(v) as Omit<typeof v, "share">);

export const projectCreateSchema = projectInputSchema.extend({ settings: projectCreateSettingsSchema.optional() });

/** Which keys in a create body need admin+: a non-empty class-B allow-list, or any schedule. */
export function createNeedsAdmin(settings: z.infer<typeof projectCreateSettingsSchema> | undefined): boolean {
  return Boolean(settings && ((settings.automation?.allowClassB?.length ?? 0) > 0 || settings.schedule !== undefined));
}

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const uniq = (xs: string[]) => xs.length === new Set(xs.map((x) => x.toLowerCase())).size;

export const competitorSchema = z.object({
  name: trimmed(120),
  domain: z
    .string()
    .trim()
    .max(253)
    .regex(/^(?:https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i, "Enter a domain like example.com")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  aliases: z.array(trimmed(120)).max(20).default([]),
});

// PATCH: every field optional, no defaults injected (so omitted fields are left untouched).
export const projectPatchSchema = z.object({
  name: trimmed(120).optional(),
  websiteUrl: z.string().url().optional(),
  brandNames: z.array(trimmed(120)).min(1).max(20).refine(uniq, "Brand names must be unique").optional(),
  categories: z.array(z.string()).max(20).optional(),
  audience: z.string().max(500).nullable().optional(),
  countries: z
    .array(z.string().trim().regex(/^[A-Za-z]{2}$/, "Use 2-letter country codes, e.g. IN").transform((c) => c.toUpperCase()))
    .max(20)
    .optional(),
  languages: z
    .array(z.string().trim().regex(/^[A-Za-z]{2,3}(?:-[A-Za-z]{2})?$/, "Use language codes, e.g. en or hi").transform((l) => l.toLowerCase()))
    .min(1)
    .max(10)
    .optional(),
  competitors: z.array(competitorSchema).max(20).optional(),
  keywords: z.array(z.string()).max(100).optional(),
  facts: projectFactsSchema.optional(),
  settings: projectSettingsSchema.optional(),
});
export type ProjectPatch = z.infer<typeof projectPatchSchema>;

export interface ProjectSettings {
  maxPagesPerCrawl?: number;
  automation?: { allowClassB?: string[] };
  schedule?: Partial<ProjectSchedule>;
  notifications?: { email?: boolean } & Partial<Record<EmailKind, boolean>>;
  paused?: boolean;
  [k: string]: unknown;
}

export function readSettings(v: unknown): ProjectSettings {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as ProjectSettings) : {};
}

const isFrequency = (v: unknown): v is ScheduleFrequency => typeof v === "string" && (SCHEDULE_FREQUENCIES as readonly string[]).includes(v);

/** Effective schedule: absent/invalid keys fall back to DEFAULT_SCHEDULE. */
export function readSchedule(settings: unknown): ProjectSchedule {
  const raw = readSettings(settings).schedule;
  const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    crawl: isFrequency(s.crawl) ? s.crawl : DEFAULT_SCHEDULE.crawl,
    visibility: isFrequency(s.visibility) ? s.visibility : DEFAULT_SCHEDULE.visibility,
  };
}

export type NotificationPrefs = { email: boolean } & Record<EmailKind, boolean>;

/** Email notifications default to on (every switch). */
export function readNotificationPrefs(settings: unknown): NotificationPrefs {
  const raw = readSettings(settings).notifications;
  const n = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    email: n.email !== false,
    monthlyReport: n.monthlyReport !== false,
    fixesWaiting: n.fixesWaiting !== false,
    checkFailed: n.checkFailed !== false,
  };
}

/** Whether to email about this kind of event: the project-wide switch AND the event's own switch (if any). */
export function wantsEmail(settings: unknown, kind: EmailKind | null): boolean {
  const p = readNotificationPrefs(settings);
  return p.email && (kind === null || p[kind]);
}

/** Customer's "Pause all changes" switch (default off). Publishing checks this alongside Organization.publishingEnabled. */
export function isPaused(settings: unknown): boolean {
  return readSettings(settings).paused === true;
}

/**
 * The single "Make small safe fixes without asking" switch. On = every safe type (policy class B) is allowed to
 * go live without approval; off = none. Any non-empty stored list counts as on.
 */
export function isAutoFixOn(settings: unknown): boolean {
  const allow = readSettings(settings).automation?.allowClassB;
  return Array.isArray(allow) && allow.length > 0;
}

/** Which keys in a PATCH need admin+ (they change spend or what gets auto-published). */
export function patchNeedsAdmin(body: ProjectPatch): boolean {
  return Boolean(
    body.settings &&
      (body.settings.automation !== undefined || body.settings.schedule !== undefined || body.settings.paused !== undefined),
  );
}

export class SettingsPatchError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/**
 * Pure merge of a validated PATCH `settings` object onto the stored settings. Only known keys are applied;
 * every other stored key (notably server-owned `share`) is carried over untouched, whatever the body says.
 */
export function mergeSettingsPatch(
  stored: unknown,
  inc: ProjectSettingsInput,
  plan: { name: string; maxPagesPerCrawl: number; minScanIntervalDays: number },
): { next: ProjectSettings; automationChanged: boolean; scheduleChanged: boolean; changed: string[] } {
  const before = readSettings(stored);
  const next: ProjectSettings = { ...before };
  const changed: string[] = [];
  let automationChanged = false;
  let scheduleChanged = false;
  if (inc.maxPagesPerCrawl !== undefined) {
    next.maxPagesPerCrawl = Math.min(inc.maxPagesPerCrawl, plan.maxPagesPerCrawl);
    changed.push("settings.maxPagesPerCrawl");
  }
  if (inc.automation) {
    next.automation = { allowClassB: inc.automation.allowClassB ?? [] };
    const sorted = (xs: string[] = []) => JSON.stringify([...xs].sort());
    automationChanged = sorted(before.automation?.allowClassB) !== sorted(next.automation.allowClassB);
  }
  if (inc.schedule) {
    const schedule = { ...readSchedule(before), ...inc.schedule };
    for (const [kind, freq] of Object.entries(schedule) as [keyof ProjectSchedule, ScheduleFrequency][]) {
      const days = frequencyDays(freq);
      if (days !== null && days < plan.minScanIntervalDays) {
        throw new SettingsPatchError(
          "schedule_too_frequent",
          `Your ${plan.name} plan allows automatic ${kind === "crawl" ? "website scans" : "AI checks"} at most every ${plan.minScanIntervalDays} days`,
        );
      }
    }
    next.schedule = schedule;
    scheduleChanged = JSON.stringify(readSchedule(before)) !== JSON.stringify(schedule);
  }
  if (inc.notifications) {
    const prev = readSettings(before).notifications;
    const merged = { ...(prev && typeof prev === "object" ? prev : {}) } as Record<string, boolean>;
    for (const [k, v] of Object.entries(inc.notifications)) if (typeof v === "boolean") merged[k] = v;
    next.notifications = merged;
    if (JSON.stringify(readNotificationPrefs(before)) !== JSON.stringify(readNotificationPrefs(next))) changed.push("settings.notifications");
  }
  if (inc.paused !== undefined) {
    next.paused = inc.paused;
    if (isPaused(before) !== inc.paused) changed.push("settings.paused");
  }
  // Defence in depth: server-owned keys always come from the stored value.
  for (const k of SERVER_OWNED_SETTINGS) {
    if (k in before) next[k] = before[k];
    else delete next[k];
  }
  return { next, automationChanged, scheduleChanged, changed };
}
