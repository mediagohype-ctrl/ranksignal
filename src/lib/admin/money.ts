// Revenue + cost maths for the admin back-office (pure, unit-tested).
import { PLANS, isPlanId } from "@/lib/billing/plans";

/** Done-for-you service tiers (Organization.serviceTier), INR per month, excluding setup fees. */
export const SERVICE_TIER_PRICES_INR = { fix: 19_999, grow: 49_999, authority: 119_999 } as const;
export type ServiceTier = keyof typeof SERVICE_TIER_PRICES_INR;
export const SERVICE_TIERS = Object.keys(SERVICE_TIER_PRICES_INR) as ServiceTier[];

export function isServiceTier(t: unknown): t is ServiceTier {
  return typeof t === "string" && Object.prototype.hasOwnProperty.call(SERVICE_TIER_PRICES_INR, t);
}

/** Default USD→INR conversion used for cost display. Override with ADMIN_USD_INR_RATE. */
export const DEFAULT_USD_INR_RATE = 95;
export function usdInrRate(): number {
  const n = Number(process.env.ADMIN_USD_INR_RATE);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USD_INR_RATE;
}

export const microsToUsd = (micros: number) => micros / 1_000_000;
export const microsToInr = (micros: number, rate = usdInrRate()) => (micros / 1_000_000) * rate;

/** Organization statuses that count toward MRR (past_due is still billed until it lapses). */
export const BILLED_STATUSES = ["active", "past_due"] as const;
export const isBilledStatus = (status: string) => (BILLED_STATUSES as readonly string[]).includes(status);

export interface MrrOrgInput {
  planId: string;
  status: string;
  serviceTier: string | null;
}

export interface MrrLine {
  kind: "plan" | "service";
  id: string;
  label: string;
  count: number;
  unitInr: number;
  totalInr: number;
}

export interface MrrEstimate {
  totalInr: number;
  planInr: number;
  serviceInr: number;
  lines: MrrLine[];
}

/**
 * Estimated MRR in INR = list price of each billed org's self-serve plan + its service-tier price.
 * Trial and unknown plans count 0. Only orgs whose status is active/past_due count. This is an ESTIMATE:
 * it ignores discounts, GST, setup fees, annual billing and proration.
 * Accepts grouped rows (`count`, e.g. from groupBy) or single orgs (count defaults to 1).
 */
export function estimateMrr(orgs: Iterable<MrrOrgInput & { count?: number }>): MrrEstimate {
  const planCounts = new Map<string, number>();
  const tierCounts = new Map<ServiceTier, number>();
  for (const o of orgs) {
    const n = o.count ?? 1;
    if (n <= 0 || !isBilledStatus(o.status)) continue;
    if (isPlanId(o.planId) && (PLANS[o.planId].priceInrMonthly ?? 0) > 0) {
      planCounts.set(o.planId, (planCounts.get(o.planId) ?? 0) + n);
    }
    if (isServiceTier(o.serviceTier)) tierCounts.set(o.serviceTier, (tierCounts.get(o.serviceTier) ?? 0) + n);
  }
  const lines: MrrLine[] = [];
  for (const [id, count] of planCounts) {
    const plan = PLANS[id as keyof typeof PLANS];
    const unit = plan.priceInrMonthly ?? 0;
    lines.push({ kind: "plan", id, label: `${plan.name} plan`, count, unitInr: unit, totalInr: unit * count });
  }
  for (const [id, count] of tierCounts) {
    const unit = SERVICE_TIER_PRICES_INR[id];
    const label = `${id.charAt(0).toUpperCase()}${id.slice(1)} service`;
    lines.push({ kind: "service", id, label, count, unitInr: unit, totalInr: unit * count });
  }
  lines.sort((a, b) => b.totalInr - a.totalInr);
  const planInr = lines.filter((l) => l.kind === "plan").reduce((a, l) => a + l.totalInr, 0);
  const serviceInr = lines.filter((l) => l.kind === "service").reduce((a, l) => a + l.totalInr, 0);
  return { totalInr: planInr + serviceInr, planInr, serviceInr, lines };
}

export function formatInr(n: number, opts: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: opts.compact ? 1 : 0,
    notation: opts.compact ? "compact" : "standard",
  }).format(n);
}

export function formatUsd(n: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}
