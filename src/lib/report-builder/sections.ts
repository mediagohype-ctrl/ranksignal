// Client report builder: section catalogue, template shape, date ranges and plan limits. Pure — no DB, safe to
// import from client components (types and constants only are used there).
import { z } from "zod";
import type { PlanId } from "@/lib/types";

export const SECTION_IDS = [
  "executive_summary",
  "scores",
  "score_history",
  "fixes_done",
  "open_problems",
  "ai_visibility",
  "competitors",
  "search_console",
  "core_web_vitals",
  "agency_notes",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export interface SectionMeta {
  id: SectionId;
  label: string;
  help: string;
  /** Shown only when data exists (otherwise silently skipped in the report). */
  optionalData?: boolean;
}

export const SECTIONS: SectionMeta[] = [
  { id: "executive_summary", label: "Executive summary", help: "A few plain sentences on where the website stands." },
  { id: "scores", label: "Scores", help: "Overall score and the SEO, AEO, GEO and Brand scores, with change over the period." },
  { id: "score_history", label: "Score history chart", help: "How the scores moved over the chosen dates." },
  { id: "fixes_done", label: "Fixes done", help: "Work completed in the period, and problems that went away." },
  { id: "open_problems", label: "Open problems", help: "What still needs fixing, most important first." },
  { id: "ai_visibility", label: "AI visibility", help: "How often AI assistants name, recommend and link to the business." },
  { id: "competitors", label: "Competitors", help: "Which competitors AI assistants name, and how often." },
  { id: "search_console", label: "Google Search performance", help: "Clicks, impressions and top searches from Search Console.", optionalData: true },
  { id: "core_web_vitals", label: "Core Web Vitals", help: "Page speed results from Google PageSpeed, when measured.", optionalData: true },
  { id: "agency_notes", label: "Notes from the agency", help: "Your own notes: what you did, what's next, anything to discuss." },
];

export const SECTION_META: Record<SectionId, SectionMeta> = Object.fromEntries(SECTIONS.map((s) => [s.id, s])) as Record<SectionId, SectionMeta>;

export interface SectionChoice {
  id: SectionId;
  enabled: boolean;
}

export const DEFAULT_SECTIONS: SectionChoice[] = SECTION_IDS.map((id) => ({ id, enabled: true }));

const isSectionId = (v: unknown): v is SectionId => typeof v === "string" && (SECTION_IDS as readonly string[]).includes(v);

/** Every known section exactly once, in the given order; unknown dropped; missing ones appended switched off. */
export function normalizeSections(raw: unknown): SectionChoice[] {
  const out: SectionChoice[] = [];
  const seen = new Set<SectionId>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const id = item && typeof item === "object" ? (item as { id?: unknown }).id : undefined;
      if (!isSectionId(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, enabled: (item as { enabled?: unknown }).enabled !== false });
    }
  } else {
    return DEFAULT_SECTIONS.map((s) => ({ ...s }));
  }
  for (const id of SECTION_IDS) if (!seen.has(id)) out.push({ id, enabled: false });
  return out;
}

/** Sections that will actually render (enabled, and with data for the optional ones). Used for numbering. */
export function visibleSections(
  sections: SectionChoice[],
  data: { search: unknown; vitals: unknown[] | null },
  notes: string,
): SectionId[] {
  return sections
    .filter((s) => s.enabled)
    .map((s) => s.id)
    .filter((id) => (id === "search_console" ? !!data.search : id === "core_web_vitals" ? !!data.vitals?.length : id === "agency_notes" ? !!notes.trim() : true));
}

// ------------------------------------------------------------------------------------------------ date range

export const RANGE_PRESETS = ["last_30_days", "last_month", "this_month", "last_90_days", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export const RANGE_LABEL: Record<RangePreset, string> = {
  last_30_days: "Last 30 days",
  last_month: "Last calendar month",
  this_month: "This month so far",
  last_90_days: "Last 90 days",
  custom: "Custom dates",
};

export interface RangeSpec {
  preset: RangePreset;
  from?: string; // YYYY-MM-DD (custom only)
  to?: string; // YYYY-MM-DD inclusive (custom only)
}

export const DEFAULT_RANGE: RangeSpec = { preset: "last_month" };
export const MAX_RANGE_DAYS = 366;
const DAY = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const validDate = (s: unknown): s is string => typeof s === "string" && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && ymd(new Date(`${s}T00:00:00Z`)) === s;

export function readRange(raw: unknown): RangeSpec {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_RANGE };
  const r = raw as Record<string, unknown>;
  const preset = (RANGE_PRESETS as readonly string[]).includes(r.preset as string) ? (r.preset as RangePreset) : DEFAULT_RANGE.preset;
  if (preset !== "custom") return { preset };
  if (!validDate(r.from) || !validDate(r.to) || r.from > r.to) return { ...DEFAULT_RANGE };
  return { preset, from: r.from, to: r.to };
}

export interface ResolvedRange {
  /** Inclusive start (00:00 UTC). */
  from: Date;
  /** Exclusive end (00:00 UTC of the day after the last day). */
  to: Date;
  /** Last day included, YYYY-MM-DD. */
  lastDay: string;
  firstDay: string;
  label: string;
}

const fmt = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Turn a range spec into concrete UTC dates (custom ranges are clamped to MAX_RANGE_DAYS and to today). */
export function resolveRange(spec: RangeSpec, now: Date = new Date()): ResolvedRange {
  const today = dayStart(now);
  const tomorrow = new Date(today.getTime() + DAY);
  let from: Date;
  let to: Date;
  switch (spec.preset) {
    case "last_30_days":
      to = tomorrow;
      from = new Date(to.getTime() - 30 * DAY);
      break;
    case "last_90_days":
      to = tomorrow;
      from = new Date(to.getTime() - 90 * DAY);
      break;
    case "this_month":
      from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      to = tomorrow;
      break;
    case "custom": {
      if (validDate(spec.from) && validDate(spec.to) && spec.from <= spec.to) {
        from = new Date(`${spec.from}T00:00:00Z`);
        to = new Date(Date.parse(`${spec.to}T00:00:00Z`) + DAY);
        if (to > tomorrow) to = tomorrow;
        if (from >= to) from = new Date(to.getTime() - DAY);
        if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY) from = new Date(to.getTime() - MAX_RANGE_DAYS * DAY);
        break;
      }
      return resolveRange(DEFAULT_RANGE, now);
    }
    case "last_month":
    default:
      from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      to = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  }
  const firstDay = ymd(from);
  const lastDay = ymd(new Date(to.getTime() - DAY));
  const label =
    spec.preset === "last_month"
      ? from.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })
      : `${fmt(firstDay)} – ${fmt(lastDay)}`;
  return { from, to, firstDay, lastDay, label };
}

// ------------------------------------------------------------------------------------------------ template input

export const INTRO_MAX = 4000;
export const NOTES_MAX = 8000;
export const NAME_MAX = 80;

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g; // keep \t \n \r for multi-line notes
const cleanText = (max: number) => z.string().max(max).transform((s) => s.replace(CONTROL, "").trim());

const templateFields = z
  .object({
    name: z.string().transform((s) => s.replace(CONTROL, " ").replace(/\s+/g, " ").trim()).pipe(z.string().min(1, "Give the template a name").max(NAME_MAX)),
    sections: z.array(z.object({ id: z.enum(SECTION_IDS), enabled: z.boolean() }).strict()).max(SECTION_IDS.length * 2),
    intro: cleanText(INTRO_MAX).optional().default(""),
    notes: cleanText(NOTES_MAX).optional().default(""),
    range: z
      .object({
        preset: z.enum(RANGE_PRESETS),
        from: z.string().regex(DATE_RE).optional(),
        to: z.string().regex(DATE_RE).optional(),
      })
      .strict()
      .refine((r) => r.preset !== "custom" || (validDate(r.from) && validDate(r.to) && r.from! <= r.to!), "Pick a start date on or before the end date"),
    shareEnabled: z.boolean().optional(),
  });

export const templateInputSchema = templateFields.strict();
export type TemplateInput = z.infer<typeof templateInputSchema>;

/** POST body: a template plus where to save it (this website, or the organization default). */
export const templateCreateSchema = templateFields.extend({ scope: z.enum(["project", "org_default"]).optional() }).strict();

export const templatePatchSchema = templateFields.partial().strict();
export type TemplatePatch = z.infer<typeof templatePatchSchema>;

export interface TemplateView {
  id: string;
  name: string;
  sections: SectionChoice[];
  intro: string;
  notes: string;
  range: RangeSpec;
  isOrgDefault: boolean;
  shareEnabled: boolean;
  updatedAt: string;
}

export function toTemplateView(row: {
  id: string; name: string; sections: unknown; intro: string | null; notes: string | null; range: unknown;
  isOrgDefault: boolean; shareEnabled: boolean; updatedAt: Date;
}): TemplateView {
  return {
    id: row.id,
    name: row.name,
    sections: normalizeSections(row.sections),
    intro: row.intro ?? "",
    notes: row.notes ?? "",
    range: readRange(row.range),
    isOrgDefault: row.isOrgDefault,
    shareEnabled: row.shareEnabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ------------------------------------------------------------------------------------------------ plan limits

export interface ReportBuilderLimits {
  maxTemplatesPerProject: number;
  /** May save an organization-wide default template. */
  orgDefault: boolean;
}

/** Proposed plan limits for the report builder (the lead wires these into the pricing tables). White-label is branding.ts's call. */
export const REPORT_BUILDER_PLAN_LIMITS: Record<PlanId, ReportBuilderLimits> = {
  trial: { maxTemplatesPerProject: 1, orgDefault: false },
  starter: { maxTemplatesPerProject: 2, orgDefault: false },
  growth: { maxTemplatesPerProject: 5, orgDefault: true },
  agency: { maxTemplatesPerProject: 20, orgDefault: true },
};

export function builderLimitsFor(planId: string): ReportBuilderLimits {
  return (REPORT_BUILDER_PLAN_LIMITS as Record<string, ReportBuilderLimits>)[planId] ?? REPORT_BUILDER_PLAN_LIMITS.trial;
}
