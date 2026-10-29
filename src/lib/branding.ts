// White-label branding (Organization.branding). Agency plan and done-for-you (serviceTier) orgs only.
// Stored shape: { displayName, logoUrl, accentColor, replyTo, footerText, hidePoweredBy }. Every value is validated on
// write AND re-sanitised on read, so a bad row can never reach a page or an email. Logos must be https:// images
// (no data:, javascript:, http:). Accent colours must be readable as text/button colour on white (WCAG AA, 4.5:1).
import { z } from "zod";
import { db } from "@/lib/db";
import { BRAND } from "@/lib/brand";

export interface Branding {
  /** Name shown on reports and emails (org's white-label name, or BRAND.name). */
  displayName: string;
  logoUrl: string | null;
  /** #rrggbb, contrast-checked against white. null = product default. */
  accentColor: string | null;
  replyTo: string | null;
  footerText: string | null;
  /** Only honoured on the agency plan. */
  hidePoweredBy: boolean;
  /** true when the org is eligible and has saved any branding. */
  custom: boolean;
}

/** The subset safe to show publicly (no reply-to address). */
export type PublicBranding = Omit<Branding, "replyTo">;

export const DEFAULT_BRANDING: Branding = {
  displayName: BRAND.name,
  logoUrl: null,
  accentColor: null,
  replyTo: null,
  footerText: null,
  hidePoweredBy: false,
  custom: false,
};

export const FOOTER_MAX = 200;
export const DISPLAY_NAME_MAX = 80;
export const MIN_ACCENT_CONTRAST = 4.5;

// ------------------------------------------------------------------------------------------------ eligibility

export function isBrandingEligible(org: { planId: string; serviceTier?: string | null }): boolean {
  return org.planId === "agency" || !!org.serviceTier;
}
export function canHidePoweredBy(org: { planId: string }): boolean {
  return org.planId === "agency";
}

// ------------------------------------------------------------------------------------------------ pure validators

/** https:// URL with a hostname, no credentials, ≤ 2000 chars. Returns the normalised URL or null. */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.length > 2000) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:" || !u.hostname || u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** "#abc" / "#AABBCC" → "#aabbcc"; anything else → null. */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  const h = m[1]!.toLowerCase();
  return `#${h.length === 3 ? h.split("").map((c) => c + c).join("") : h}`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

/** WCAG contrast ratio between two #rrggbb colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** Accent is used as white-text button fill and as text on white, so it must reach 4.5:1 against white. */
export function isReadableAccent(hex: string): boolean {
  const h = normalizeHex(hex);
  return !!h && contrastRatio(h, "#ffffff") >= MIN_ACCENT_CONTRAST;
}

// Strip control characters (incl. newlines in single-line fields) so values can't break headers or layouts.
const CONTROL = /[\u0000-\u001f\u007f]/g;
const oneLine = (s: string) => s.replace(CONTROL, " ").replace(/\s+/g, " ").trim();

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

export const brandingInputSchema = z
  .object({
    displayName: z.preprocess(emptyToNull, z.string().transform(oneLine).pipe(z.string().min(1).max(DISPLAY_NAME_MAX)).nullable().optional()),
    logoUrl: z.preprocess(
      emptyToNull,
      z
        .string()
        .max(2000)
        .refine((v) => safeHttpsUrl(v) !== null, "Logo must be an https:// image link (no data: or http: links)")
        .transform((v) => safeHttpsUrl(v)!)
        .nullable()
        .optional(),
    ),
    accentColor: z.preprocess(
      emptyToNull,
      z
        .string()
        .refine((v) => normalizeHex(v) !== null, "Use a hex colour like #1f6feb")
        .transform((v) => normalizeHex(v)!)
        .refine(isReadableAccent, `This colour is too light to read on white; pick a darker shade (needs ${MIN_ACCENT_CONTRAST}:1 contrast)`)
        .nullable()
        .optional(),
    ),
    replyTo: z.preprocess(emptyToNull, z.string().trim().max(254).email("Enter a valid email address").nullable().optional()),
    footerText: z.preprocess(emptyToNull, z.string().transform(oneLine).pipe(z.string().max(FOOTER_MAX)).nullable().optional()),
    hidePoweredBy: z.boolean().optional(),
  })
  .strict();

export type BrandingInput = z.infer<typeof brandingInputSchema>;

/** What gets stored in Organization.branding (all keys present; nulls for unset). */
export interface StoredBranding {
  displayName: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  replyTo: string | null;
  footerText: string | null;
  hidePoweredBy: boolean;
}

export function toStoredBranding(input: BrandingInput, org: { planId: string }): StoredBranding {
  return {
    displayName: input.displayName ?? null,
    logoUrl: input.logoUrl ?? null,
    accentColor: input.accentColor ?? null,
    replyTo: input.replyTo ?? null,
    footerText: input.footerText ?? null,
    hidePoweredBy: canHidePoweredBy(org) ? !!input.hidePoweredBy : false,
  };
}

/** Defensive read of the JSON column: every field re-validated; unknown/invalid values dropped. */
export function readStoredBranding(raw: unknown): StoredBranding | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" && oneLine(v) ? oneLine(v).slice(0, max) : null);
  const reply = typeof r.replyTo === "string" && z.string().email().max(254).safeParse(r.replyTo.trim()).success ? r.replyTo.trim() : null;
  const accent = normalizeHex(r.accentColor);
  return {
    displayName: str(r.displayName, DISPLAY_NAME_MAX),
    logoUrl: safeHttpsUrl(r.logoUrl),
    accentColor: accent && isReadableAccent(accent) ? accent : null,
    replyTo: reply,
    footerText: str(r.footerText, FOOTER_MAX),
    hidePoweredBy: r.hidePoweredBy === true,
  };
}

/** Resolve effective branding for an org row (pure; used by getBranding and tests). */
export function resolveBranding(org: { name?: string; planId: string; serviceTier?: string | null; branding?: unknown } | null): Branding {
  if (!org || !isBrandingEligible(org)) return { ...DEFAULT_BRANDING };
  const s = readStoredBranding(org.branding);
  if (!s) return { ...DEFAULT_BRANDING };
  const any = !!(s.displayName || s.logoUrl || s.accentColor || s.replyTo || s.footerText || s.hidePoweredBy);
  return {
    displayName: s.displayName ?? BRAND.name,
    logoUrl: s.logoUrl,
    accentColor: s.accentColor,
    replyTo: s.replyTo,
    footerText: s.footerText,
    hidePoweredBy: canHidePoweredBy(org) && s.hidePoweredBy,
    custom: any,
  };
}

export function toPublicBranding(b: Branding): PublicBranding {
  const { replyTo: _omit, ...rest } = b;
  void _omit;
  return rest;
}

/** Shape renderEmail() accepts (src/lib/email/layout.ts). Undefined when the org has no custom branding. */
export function emailBranding(b: Branding) {
  if (!b.custom) return undefined;
  return {
    displayName: b.displayName,
    logoUrl: b.logoUrl ?? undefined,
    accentColor: b.accentColor ?? undefined,
    footerText: b.footerText ?? undefined,
    hidePoweredBy: b.hidePoweredBy,
  };
}

// ------------------------------------------------------------------------------------------------ DB

/** Effective branding for an organization; falls back to BRAND (never throws). */
export async function getBranding(organizationId: string): Promise<Branding> {
  try {
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, planId: true, serviceTier: true, branding: true },
    });
    return resolveBranding(org);
  } catch (e) {
    console.error("[branding] load failed:", e instanceof Error ? e.message : e);
    return { ...DEFAULT_BRANDING };
  }
}
