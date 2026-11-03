// Plain-English labels for action types, policy decisions and lifecycle events.

const TYPE: Record<string, { title: string; summary: string }> = {
  update_meta_description: { title: "Rewrite the Google summary", summary: "The short text shown under your link on Google." },
  update_title: { title: "Rewrite the Google headline", summary: "The clickable headline shown on Google and in browser tabs." },
  add_faq_schema: { title: "Add questions and answers for Google and AI", summary: "Hidden info that helps Google and AI tools pick up your questions and answers." },
  content_brief: { title: "Plan a page", summary: "A plan for a new or improved page. Nothing on your site changes." },
  comparison_page_brief: { title: "Plan a comparison page", summary: "A plan for a page comparing you with others. Nothing on your site changes." },
  internal_task: { title: "Team to-do", summary: "A task for your team. Nothing on your site changes." },
  robots_review: { title: "Review your site's robot rules file", summary: "Check which Google and AI robots are allowed to read your site." },
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
    if (r.includes("no connected integration") || r.includes("in a way that can make")) return "Your website isn't connected, so this change is made by hand. Follow the steps below, or connect your website.";
    if (r.includes("lacks") || r.includes("can't make this kind") || r.includes("can't undo")) return "Your connected website can't make this kind of change for you. Follow the steps below to do it by hand.";
    if (r.includes("regulated") || r.includes("guarantee")) return "The text makes claims that need a legal check, so we won't put it live for you. Check it, then make the change by hand.";
    if (r.includes("checkout") || r.includes("payment") || r.includes("legal page")) return "This page handles payments, accounts or legal terms. We never change those for you — follow the steps to do it by hand.";
    if (r.includes("unknown action") || r.includes("don't recognise")) return "We don't recognise this kind of change, so we've stopped it to be safe. Contact us if you need it.";
    return "This is too sensitive to do for you. Check it and make the change by hand.";
  }
  if (decision === "auto_execute") {
    if (riskClass === "A") return "Safe: this only prepares a plan or task — nothing on your website changes.";
    return "You said this kind of small change can go live without asking. It can be undone with one click.";
  }
  // approval_required
  if (riskClass === "B") {
    if (r.includes("no connector") || r.includes("in a way we can undo")) return "A small change, but your website isn't connected in a way we can undo, so it needs your OK.";
    return "A small change. It needs your OK first, because you haven't let this kind of change go live without asking.";
  }
  if (r.includes("homepage") || r.includes("high-traffic") || r.includes("landing") || r.includes("busiest")) {
    return "This is one of your most important pages, so it needs your OK on the exact text first.";
  }
  return "This changes what visitors and Google read, so it needs your OK on the exact text first.";
}

const PRIORITY_LABEL: Record<string, string> = { critical: "Urgent", high: "Urgent", medium: "Important", low: "Nice to have" };
/** Plain words for an action's priority. */
export function priorityLabel(p: string): string {
  return PRIORITY_LABEL[p] ?? "Nice to have";
}

export const PRIORITY_TONE: Record<string, "danger" | "warning" | "primary" | "neutral"> = {
  critical: "danger",
  high: "warning",
  medium: "primary",
  low: "neutral",
};

const EXEC_RESULT: Record<string, string> = {
  pending: "Making the change",
  success: "Change made",
  partial: "Change partly made",
  failure: "Change could not be made",
};
const VALIDATION: Record<string, string> = {
  passed: "we checked the page again and the new text is live",
  warning: "made, but our second check found something to look at",
  failed: "our second check couldn't find the new text — check the page yourself",
};
const ROLLBACK: Record<string, string> = {
  not_needed: "",
  pending: "Undo in progress",
  rolled_back: "Undone — the previous version was restored",
  failed: "Undo failed — contact us",
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
  pending: "Waiting for OK",
  approved: "Approved",
  rejected: "Turned down",
  expired: "OK request expired",
  invalidated: "OK cancelled because the text was edited",
};
export function approvalLabel(decision: string): string {
  return APPROVAL[decision] ?? decision.replace(/_/g, " ");
}
