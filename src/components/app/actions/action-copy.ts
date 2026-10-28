// Plain-English labels for action types, policy decisions and lifecycle events.

const TYPE: Record<string, { title: string; summary: string }> = {
  update_meta_description: { title: "Rewrite meta description", summary: "The short summary shown under your link in search results." },
  update_title: { title: "Rewrite page title", summary: "The clickable headline shown in search results and browser tabs." },
  add_faq_schema: { title: "Add FAQ structured data", summary: "Machine-readable questions and answers that search engines and AI can pick up." },
  content_brief: { title: "Write a content brief", summary: "A plan for a new or improved page. Nothing on your site changes." },
  comparison_page_brief: { title: "Plan a comparison page", summary: "A brief for a page comparing you with alternatives. Nothing on your site changes." },
  internal_task: { title: "Team to-do", summary: "A task for your team. Nothing on your site changes." },
  robots_review: { title: "Review robots.txt", summary: "Check which crawlers (including AI assistants) may read your site." },
};

export function actionTitle(type: string): string {
  return TYPE[type]?.title ?? type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
export function actionSummary(type: string): string | null {
  return TYPE[type]?.summary ?? null;
}

/** Turn the policy engine's decision + technical reason into one plain sentence. */
export function policyInPlainWords(decision: string, riskClass: string, reason: string | null): string {
  const r = (reason ?? "").toLowerCase();
  if (decision === "blocked") {
    if (r.includes("no connected integration")) return "No connected website can make this change, so a person applies it by hand using the steps provided.";
    if (r.includes("lacks")) return "Your connected website can't make this kind of change automatically, so it has to be done by hand.";
    if (r.includes("regulated") || r.includes("guarantee")) return "The text makes claims that need a legal or compliance check, so we won't publish it automatically.";
    if (r.includes("checkout") || r.includes("payment") || r.includes("legal page")) return "This page handles payments, accounts or legal terms. We never change those automatically.";
    if (r.includes("unknown action")) return "We don't recognise this kind of change, so it's blocked to be safe.";
    return "This is too risky to automate. A person needs to review it and make the change by hand.";
  }
  if (decision === "auto_execute") {
    if (riskClass === "A") return "Safe to run: this only prepares a document or task — nothing on your website changes.";
    return "You allowed this kind of small change to apply automatically. It can be undone with one click.";
  }
  // approval_required
  if (riskClass === "B") {
    if (r.includes("no connector")) return "A small change, but no connected website with undo support is attached yet, so it needs approval.";
    return "A small change, but you haven't turned on auto-apply for this type, so someone needs to approve it first.";
  }
  if (r.includes("homepage") || r.includes("high-traffic") || r.includes("landing")) {
    return "This is one of your most important pages, so someone needs to approve the exact text first.";
  }
  return "This changes what visitors and search engines read, so someone needs to approve the exact text first.";
}

export const PRIORITY_TONE: Record<string, "danger" | "warning" | "primary" | "neutral"> = {
  critical: "danger",
  high: "warning",
  medium: "primary",
  low: "neutral",
};

const EXEC_RESULT: Record<string, string> = {
  pending: "Applying the change",
  success: "Change applied",
  partial: "Change partly applied",
  failure: "Change could not be applied",
};
const VALIDATION: Record<string, string> = {
  passed: "we re-checked the page and the new text is live",
  warning: "applied, but our re-check found something to look at",
  failed: "our re-check couldn't confirm the new text",
};
const ROLLBACK: Record<string, string> = {
  not_needed: "",
  pending: "Undo in progress",
  rolled_back: "Undone — the previous version was restored",
  failed: "Undo failed",
  manual_required: "Undo needs to be done by hand",
};

export function executionLabel(result: string): string {
  return EXEC_RESULT[result] ?? result.replace(/_/g, " ");
}
export function validationLabel(v: string | null): string | null {
  return v ? (VALIDATION[v] ?? v) : null;
}
export function rollbackLabel(v: string | null): string | null {
  return v ? ROLLBACK[v] || null : null;
}

const APPROVAL: Record<string, string> = {
  pending: "Approval requested",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Approval request expired",
  invalidated: "Approval cancelled because the draft was edited",
};
export function approvalLabel(decision: string): string {
  return APPROVAL[decision] ?? decision.replace(/_/g, " ");
}
