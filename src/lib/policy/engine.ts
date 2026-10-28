// Deterministic, versioned risk policy engine (blueprint §6.1). Pure function: no I/O, no LLM.
// The risk class is ALWAYS decided here from structured inputs — never by a model.
import type {
  ActionTarget, ConnectorCapabilities, PolicyDecision, ProposedChange, RiskClass,
} from "@/lib/types";

export const POLICY_VERSION = "2026-10-1";

/** Class A: observe / prepare only — no customer-site write. */
export const CLASS_A_TYPES = [
  "content_brief", "comparison_page_brief", "faq_brief", "internal_task", "monitor_prompt",
] as const;
/** Class B candidates: low-risk metadata edits with rollback support. */
export const CLASS_B_TYPES = ["update_meta_description", "update_title", "update_image_alt", "update_og_tags"] as const;
/** Class C: material content / structured data / publishing. */
export const CLASS_C_TYPES = [
  "add_faq_schema", "update_schema", "update_content", "update_product_copy", "update_excerpt",
  "publish_post", "create_draft_post",
] as const;
/** Class D: never automated. */
export const CLASS_D_TYPES = [
  "delete_page", "delete_resource", "update_url", "update_slug", "create_redirect", "update_redirects",
  "robots_review", "update_robots", "update_checkout", "update_payment", "update_access_control",
  "update_user_roles", "sitewide_change", "update_legal_page",
] as const;

/** Capability a connector must expose to execute each writable type. */
export const REQUIRED_CAPABILITY: Record<string, keyof ConnectorCapabilities> = {
  update_meta_description: "updateMetadata",
  update_title: "updateMetadata",
  update_image_alt: "updateMetadata",
  update_og_tags: "updateMetadata",
  add_faq_schema: "updateSchema",
  update_schema: "updateSchema",
  update_content: "updateContent",
  update_product_copy: "updateContent",
  update_excerpt: "updateContent",
  publish_post: "publish",
  create_draft_post: "createDraft",
};

/**
 * Regulated / high-liability claim patterns (legal, medical, financial, guarantees).
 * Over-matching is intentional: false positives only route to "blocked → manual review".
 */
export const REGULATED_PATTERNS: RegExp[] = [
  /\bcures?\b|\bcured\b|\bheals?\b/i,
  /\b(treats?|treatment for|diagnos(e|is|es))\b/i,
  /\b(fda|cdsco|sebi|rbi)[- ]?(approved|registered|certified)\b/i,
  /\bclinically (proven|tested)\b/i,
  /\bno side[- ]effects\b/i,
  /\b(medical|legal|financial|investment|tax) advice\b/i,
  /\bguarantee(d|s)?\b/i,
  /\brisk[- ]free\b/i,
  /\b\d+(\.\d+)?\s?% (returns?|interest|profit)\b/i,
  /\b(get rich|double your money|assured returns?)\b/i,
  /\b(prescription|dosage|weight loss in \d+)\b/i,
  /\b(loan approval|instant loan|insurance claim|tax[- ]free)\b/i,
  /\b(#1|number one|best) (ranked|rated) (in|on) (google|chatgpt|ai)\b/i,
];

const CRITICAL_URL = /\/(checkout|cart|basket|payment|pay|billing|account|login|signin|sign-in|register|admin|wp-admin|privacy|terms|legal|refund)(\/|$|\?|#)/i;
const ACCESS_CONTROL_TYPE = /(access|permission|role|auth|password|user)/i;

export interface PageSignals {
  isHomepage?: boolean;
  isHighTraffic?: boolean;
  isKeyLandingPage?: boolean;
}

export interface PolicyInput {
  type: string;
  target: ActionTarget | null | undefined;
  proposedChange: ProposedChange | null | undefined;
  /** project.settings.automation */
  automation?: { allowClassB?: string[] } | null;
  page?: PageSignals | null;
  /**
   * Connector capabilities. `undefined` = classify without a connector (recommendation-time);
   * `null` = explicitly no connector able to write (execution-time) — writable classes are blocked.
   */
  connector?: ConnectorCapabilities | null;
}

export interface PolicyResult {
  riskClass: RiskClass;
  decision: PolicyDecision;
  reason: string;
  policyVersion: string;
}

const result = (riskClass: RiskClass, decision: PolicyDecision, reason: string): PolicyResult => ({
  riskClass, decision, reason, policyVersion: POLICY_VERSION,
});

const has = (list: readonly string[], v: string) => list.includes(v);

export function detectRegulatedClaims(text: string | null | undefined): string[] {
  if (!text) return [];
  const hits: string[] = [];
  for (const re of REGULATED_PATTERNS) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  return hits;
}

export function classifyAction(input: PolicyInput): PolicyResult {
  const { type, target, proposedChange, automation, page, connector } = input;
  const url = target?.url ?? "";

  // ---- Class D: hard blocks (checked first; nothing overrides them) ----
  if (has(CLASS_D_TYPES, type) || type.startsWith("delete_") || type.startsWith("sitewide_")) {
    return result("D", "blocked", `Action type "${type}" is class D (destructive, URL/redirect, robots, checkout, access or site-wide) and is never automated; handle manually.`);
  }
  if (target?.resourceType === "site" || target?.resourceType === "sitewide") {
    return result("D", "blocked", "Site-wide changes are class D and are never automated.");
  }
  if (ACCESS_CONTROL_TYPE.test(type) && !has(CLASS_A_TYPES, type)) {
    return result("D", "blocked", "Access-control related changes are class D.");
  }
  if (proposedChange && (proposedChange.field === "slug" || proposedChange.field === "url" || proposedChange.field === "status_delete")) {
    return result("D", "blocked", `Changing "${proposedChange.field}" alters URLs/availability and is class D.`);
  }
  const isWrite = !has(CLASS_A_TYPES, type);
  if (isWrite && url && CRITICAL_URL.test(safePath(url))) {
    return result("D", "blocked", "Target is a checkout/payment/account/legal page; changes are class D.");
  }
  // Claim screening applies to text that would be written to the customer's site. Class A briefs
  // are internal documents (and carry their own "no guaranteed outcome" disclaimers).
  const claims = isWrite ? detectRegulatedClaims(proposedChange?.after) : [];
  if (claims.length) {
    return result("D", "blocked", `Proposed text contains regulated or guarantee-style claims (${claims.slice(0, 3).join(", ")}); requires manual legal/compliance review.`);
  }

  // ---- Class A: observe / prepare ----
  if (has(CLASS_A_TYPES, type)) {
    return result("A", "auto_execute", "Class A: prepares a brief or internal task; no change to the customer site.");
  }

  // Unknown types fail closed.
  if (!has(CLASS_B_TYPES, type) && !has(CLASS_C_TYPES, type)) {
    return result("D", "blocked", `Unknown action type "${type}" — blocked by default (fail closed).`);
  }

  // ---- Capability check (when a connector is known) ----
  const cap = REQUIRED_CAPABILITY[type];
  if (connector === null) {
    return result(has(CLASS_B_TYPES, type) ? "B" : "C", "blocked", "No connected integration can write this change; use the manual export instructions.");
  }
  if (connector && cap && !connector[cap]) {
    const rc: RiskClass = has(CLASS_B_TYPES, type) && !isCriticalPage(page) ? "B" : "C";
    return result(rc, "blocked", `Connector lacks the "${cap}" capability; use the manual export instructions.`);
  }

  // ---- Class C: material content, or metadata on critical pages ----
  if (has(CLASS_C_TYPES, type)) {
    return result("C", "approval_required", "Class C: material content, structured data or publishing change requires approval of the exact draft.");
  }
  if (isCriticalPage(page)) {
    return result("C", "approval_required", "Metadata change on the homepage, a key landing page or a high-traffic page is class C and requires approval.");
  }

  // ---- Class B: allowed metadata on non-critical pages ----
  if (connector && !connector.rollback) {
    return result("B", "blocked", "Class B changes require connector rollback support, which this connector lacks.");
  }
  const allowed = automation?.allowClassB ?? [];
  if (!allowed.includes(type)) {
    return result("B", "approval_required", `Class B: "${type}" is not in this project's automation allow-list; approval required.`);
  }
  if (!connector) {
    return result("B", "approval_required", "Class B allow-listed, but no connector with rollback is attached yet; approval required.");
  }
  return result("B", "auto_execute", `Class B: "${type}" is allow-listed for this project on a non-critical page with rollback support.`);
}

function isCriticalPage(page: PageSignals | null | undefined) {
  return Boolean(page?.isHomepage || page?.isHighTraffic || page?.isKeyLandingPage);
}

function safePath(url: string) {
  try {
    return new URL(url).pathname + new URL(url).search;
  } catch {
    return url;
  }
}

/** Derive page signals from a target URL and project settings (keyPages / highTrafficUrls lists). */
export function pageSignalsFor(
  targetUrl: string | undefined,
  websiteUrl: string,
  settings: { keyPages?: string[]; highTrafficUrls?: string[] } | null | undefined,
): PageSignals {
  if (!targetUrl) return {};
  const norm = (u: string) => {
    try {
      const x = new URL(u);
      return (x.host.replace(/^www\./, "") + x.pathname.replace(/\/+$/, "")).toLowerCase();
    } catch {
      return u.toLowerCase().replace(/\/+$/, "");
    }
  };
  const t = norm(targetUrl);
  let isHomepage = false;
  try {
    const p = new URL(targetUrl).pathname;
    isHomepage = p === "/" || p === "" || norm(websiteUrl) === t;
  } catch {
    isHomepage = false;
  }
  return {
    isHomepage,
    isKeyLandingPage: (settings?.keyPages ?? []).some((u) => norm(u) === t),
    isHighTraffic: (settings?.highTrafficUrls ?? []).some((u) => norm(u) === t),
  };
}
