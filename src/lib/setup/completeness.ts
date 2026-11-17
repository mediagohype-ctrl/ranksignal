// Is this website's setup finished? Old accounts were created before setup read the site, so their business name
// is a guess from the web address and "what you sell" / "customers" are empty — which makes AI checks ask about
// the wrong business. Pure (no I/O): Home shows "Finish setting up: 3 details missing" from this.
import { isDomainDerivedName } from "./brand-names";

export type SetupGapKey = "name" | "sells" | "customers" | "competitors" | "facts";

export interface SetupGap {
  key: SetupGapKey;
  /** Short plain label, e.g. "what you sell". */
  label: string;
}

export interface SetupProjectInput {
  name: string;
  websiteUrl: string;
  brandNames?: unknown;
  categories?: unknown;
  audience?: string | null;
  competitors?: unknown;
  /** Project.facts — what the owner confirmed. */
  facts?: unknown;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Facts beyond the name that make AI answers checkable: where you are, how to reach you, who runs it. */
export const EXTRA_FACT_KEYS = ["city", "address", "phone", "founder", "services"] as const;

export function setupGaps(p: SetupProjectInput): SetupGap[] {
  const facts = obj(p.facts);
  const gaps: SetupGap[] = [];
  const firstBrand = str(list(p.brandNames)[0]) || p.name;
  // Confirmed = the owner saved it in setup or Settings (Project.facts.name). A guess from the address isn't.
  if (!str(facts.name) && isDomainDerivedName(firstBrand, p.websiteUrl)) gaps.push({ key: "name", label: "your business name" });
  if (!str(facts.sells) && !list(p.categories).some((c) => str(c))) gaps.push({ key: "sells", label: "what you sell" });
  if (!str(facts.customers) && !str(p.audience)) gaps.push({ key: "customers", label: "who your customers are" });
  if (!list(p.competitors).some((c) => str(obj(c).name))) gaps.push({ key: "competitors", label: "your competitors" });
  if (!EXTRA_FACT_KEYS.some((k) => str(facts[k]))) gaps.push({ key: "facts", label: "your city, address or phone" });
  return gaps;
}

/** The banner shows only when something that changes results is missing (competitors / contact facts alone don't nag). */
export function setupIncomplete(gaps: SetupGap[]): boolean {
  return gaps.some((g) => g.key === "name" || g.key === "sells" || g.key === "customers");
}

/** "Finish setting up: 3 details missing" / "…: 1 detail missing". */
export function setupBannerTitle(gaps: SetupGap[]): string {
  return `Finish setting up: ${gaps.length} ${gaps.length === 1 ? "detail" : "details"} missing`;
}

/** "your business name, what you sell and who your customers are". */
export function setupGapList(gaps: SetupGap[]): string {
  const labels = gaps.map((g) => g.label);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/** Where the banner sends people: the Business tab of the website's Settings. */
export function businessSettingsHref(projectId: string): string {
  return `/app/projects/${projectId}/settings?tab=business#business`;
}
