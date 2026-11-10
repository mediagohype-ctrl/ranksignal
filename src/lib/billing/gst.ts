// GST on our prices — ONE pure helper used by the website, the app, checkout, invoices and the admin check. No DB.
//
// We charge GST on top of the list price (src/lib/billing/plans.ts `priceInrMonthly` = price BEFORE GST).
// GST applies only when we are GST-registered, i.e. when GSTIN is set. Without GSTIN: rate 0, split "none", and
// every page shows the plain price (saying "+ GST" would be wrong).
//
// Env (all optional, read at call time):
//   GSTIN              our GST number (unset = not registered)
//   GST_RATE_PERCENT   default 18
//   GST_LEGAL_NAME     legal name as on the GST certificate (default: LEGAL_ENTITY from src/lib/site.ts via caller)
//   GST_STATE_CODE     our state's 2-digit GST code (default: first 2 digits of GSTIN, else "07" Delhi)
//   GST_SAC_CODE       default "998314" (IT design/development/support services) — the owner's CA must confirm
//   GST_INVOICE_PREFIX default "MWR"
//
// Money is integer paise. gst = round(base × rate / 100); total = base + gst.
// Place of supply: customer state == our state → CGST + SGST (half each); different state → IGST.
// Customer state unknown (no billing details yet) → treated as OUR state (CGST + SGST). Most of our customers are
// small businesses near us and B2C supplies default to the supplier's location when the address is unknown.
import { PLANS, isPlanId } from "./plans";

export const DEFAULT_GST_RATE_PERCENT = 18;
export const DEFAULT_GST_STATE_CODE = "07";
/** PLACEHOLDER — the owner's CA must confirm the SAC code for a SaaS subscription. */
export const DEFAULT_GST_SAC_CODE = "998314";
export const DEFAULT_GST_INVOICE_PREFIX = "MWR";

export type GstSplit = "cgst_sgst" | "igst" | "none";

export interface GstConfig {
  registered: boolean;
  ratePercent: number;
  gstin: string | null;
  legalName: string | null;
  stateCode: string;
  sacCode: string;
  prefix: string;
}

export interface GstBreakdown {
  basePaise: number;
  gstPaise: number;
  totalPaise: number;
  ratePercent: number;
  split: GstSplit;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

type Env = Record<string, string | undefined>;

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Format + checksum check of a 15-character GSTIN (upper-case it first). */
export function isValidGstin(value: string): boolean {
  const v = value.trim().toUpperCase();
  if (!GSTIN_RE.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GSTIN_CHARS.indexOf(v[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36] === v[14];
}

function normStateCode(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!/^\d{1,2}$/.test(s)) return null;
  return s.padStart(2, "0");
}

export function gstConfig(env: Env = process.env): GstConfig {
  const gstin = env.GSTIN?.trim().toUpperCase() || null;
  const registered = !!gstin;
  const rateRaw = Number(env.GST_RATE_PERCENT);
  const rate = env.GST_RATE_PERCENT?.trim() && Number.isFinite(rateRaw) && rateRaw >= 0 && rateRaw <= 100 ? rateRaw : DEFAULT_GST_RATE_PERCENT;
  return {
    registered,
    ratePercent: registered ? rate : 0,
    gstin,
    legalName: env.GST_LEGAL_NAME?.trim() || null,
    stateCode: normStateCode(env.GST_STATE_CODE) ?? (gstin ? gstin.slice(0, 2) : DEFAULT_GST_STATE_CODE),
    sacCode: env.GST_SAC_CODE?.trim() || DEFAULT_GST_SAC_CODE,
    prefix: env.GST_INVOICE_PREFIX?.trim() || DEFAULT_GST_INVOICE_PREFIX,
  };
}

/** Which tax applies for this customer state (unknown state → our state → CGST + SGST). */
export function gstSplitFor(customerStateCode: string | null | undefined, cfg: GstConfig = gstConfig()): GstSplit {
  if (!cfg.registered || cfg.ratePercent <= 0) return "none";
  const c = normStateCode(customerStateCode);
  return c && c !== cfg.stateCode ? "igst" : "cgst_sgst";
}

/** Splits a GST amount into CGST/SGST (CGST gets the odd paisa's floor half) or IGST. */
export function splitGst(gstPaise: number, split: GstSplit): Pick<GstBreakdown, "cgstPaise" | "sgstPaise" | "igstPaise"> {
  if (split === "igst") return { cgstPaise: 0, sgstPaise: 0, igstPaise: gstPaise };
  if (split === "cgst_sgst") {
    const cgst = Math.floor(gstPaise / 2);
    return { cgstPaise: cgst, sgstPaise: gstPaise - cgst, igstPaise: 0 };
  }
  return { cgstPaise: 0, sgstPaise: 0, igstPaise: 0 };
}

/** Price before GST (paise) → GST, total and the CGST/SGST or IGST split. */
export function priceWithGst(
  basePaise: number,
  opts: { customerStateCode?: string | null; config?: GstConfig } = {},
): GstBreakdown {
  const cfg = opts.config ?? gstConfig();
  const base = Math.max(0, Math.round(basePaise));
  const split = gstSplitFor(opts.customerStateCode, cfg);
  const ratePercent = split === "none" ? 0 : cfg.ratePercent;
  const gst = Math.round((base * ratePercent) / 100);
  return { basePaise: base, gstPaise: gst, totalPaise: base + gst, ratePercent, split, ...splitGst(gst, split) };
}

/**
 * A GST-inclusive amount (e.g. what Razorpay charged on a subscription) → base + GST that add up to it exactly.
 * base = round(total ÷ (1 + rate/100)); gst = total − base.
 */
export function gstFromTotal(
  totalPaise: number,
  opts: { customerStateCode?: string | null; config?: GstConfig } = {},
): GstBreakdown {
  const cfg = opts.config ?? gstConfig();
  const total = Math.max(0, Math.round(totalPaise));
  const split = gstSplitFor(opts.customerStateCode, cfg);
  const ratePercent = split === "none" ? 0 : cfg.ratePercent;
  const base = Math.round((total * 100) / (100 + ratePercent));
  const gst = total - base;
  return { basePaise: base, gstPaise: gst, totalPaise: total, ratePercent, split, ...splitGst(gst, split) };
}

/** "₹1,999" for whole rupees, "₹2,358.82" otherwise (Indian digit grouping). */
export function formatInr(paise: number): string {
  const p = Math.round(paise);
  const neg = p < 0;
  const abs = Math.abs(p);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  const s = `₹${rupees.toLocaleString("en-IN")}${rest ? `.${String(rest).padStart(2, "0")}` : ""}`;
  return neg ? `-${s}` : s;
}

/** Whole rupees → paise. */
export const rupeesToPaise = (inr: number) => Math.round(inr * 100);

/** " + GST" after a price when GST applies, "" when we are not GST-registered. */
export function gstSuffix(cfg: GstConfig = gstConfig()): string {
  return cfg.registered && cfg.ratePercent > 0 ? " + GST" : "";
}

/** "₹1,999 + GST" (or "₹1,999" when not registered) for a whole-rupee list price. */
export function inrPlusGst(inr: number, cfg: GstConfig = gstConfig()): string {
  return `${formatInr(rupeesToPaise(inr))}${gstSuffix(cfg)}`;
}

/** Monthly price + GST of a paid plan (null for the free trial / unknown ids). */
export function planPriceWithGst(planId: string, customerStateCode?: string | null, cfg: GstConfig = gstConfig()): GstBreakdown | null {
  if (!isPlanId(planId)) return null;
  const price = PLANS[planId].priceInrMonthly;
  if (price === null) return null;
  return priceWithGst(rupeesToPaise(price), { customerStateCode, config: cfg });
}
