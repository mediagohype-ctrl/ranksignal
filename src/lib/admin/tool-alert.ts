// Team alert email for a free check / free tool run (src/lib/admin/tool-usage.ts). Goes to the support inbox
// (TOOL_ALERT_TO overrides); EMAIL_BCC copies the rest of the team. Built with renderEmail, which escapes every value.
import type { ToolUse } from "@prisma/client";
import { BRAND } from "@/lib/brand";
import { renderEmail } from "@/lib/email/layout";
import { sendEmail } from "@/lib/email/send";
import { appLink } from "@/lib/email/templates";
import { usdInrRate } from "@/lib/admin/money";
import { toolLabel } from "./tool-usage";

type Row = Pick<
  ToolUse,
  | "id" | "tool" | "url" | "input" | "score" | "aiCostMicros" | "aiModel" | "durationMs" | "userEmail" | "email" | "leadId"
  | "device" | "browser" | "country" | "language" | "referrer" | "createdAt"
>;

/** "₹0.42 ($0.0044)" — AI spend of one run. */
export function aiCostLabel(costMicros: number, rate = usdInrRate()): string {
  if (!costMicros) return "₹0 (no AI used)";
  const usd = costMicros / 1_000_000;
  return `₹${(usd * rate).toFixed(2)} ($${usd.toFixed(4)})`;
}

const host = (url: string | null) => (url ? url.replace(/^https?:\/\//, "").replace(/\/$/, "") : null);

export function toolAlertEmail(row: Row, opts: { emailLeft?: boolean } = {}) {
  const site = host(row.url) ?? row.input ?? "no website";
  const who = row.email ?? row.userEmail;
  const subject = (
    opts.emailLeft
      ? `🔥 Hot lead: ${row.email} left their email (${site})`
      : `New ${toolLabel(row.tool)}: ${site}${row.score != null ? ` · score ${row.score}` : ""}${who ? ` · ${who}` : ""}`
  ).slice(0, 150);
  const when = row.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  const lines = [
    `Tool: ${toolLabel(row.tool)}`,
    `Website: ${row.url ?? "—"}`,
    row.input ? `What they typed: ${row.input}` : null,
    row.score != null ? `Score: ${row.score}/100` : null,
    `Visitor email: ${row.email ?? "not given yet"}`,
    row.userEmail ? `Signed in as: ${row.userEmail} (existing ${BRAND.name} user)` : "Signed in: no (anonymous visitor)",
    `Device: ${[row.device, row.browser].filter(Boolean).join(" · ") || "unknown"}`,
    `Country / language: ${[row.country, row.language].filter(Boolean).join(" · ") || "unknown"}`,
    `Came from: ${row.referrer ?? "direct / unknown"}`,
    `AI cost: ${aiCostLabel(row.aiCostMicros)}${row.aiModel ? ` · ${row.aiModel}` : ""}`,
    `Time: ${when} IST · took ${(row.durationMs / 1000).toFixed(1)}s`,
  ].filter((l): l is string => Boolean(l));

  const intro = opts.emailLeft
    ? `Someone who ran the free check just left their email for the full result. This is a warm lead: follow up today.`
    : `Someone just used the ${toolLabel(row.tool)} on ${BRAND.domain}.`;

  const { html, text } = renderEmail({
    title: opts.emailLeft ? "A visitor left their email" : `New ${toolLabel(row.tool).toLowerCase()} run`,
    preheader: `${site}${who ? ` · ${who}` : ""}`,
    paragraphs: [intro, ...lines],
    cta: { label: row.leadId ? "Open the lead" : "See all tool usage", url: appLink(row.leadId ? `/admin/leads/${row.leadId}` : "/admin/tools") },
    footer: "Team alert from the free tools. Turn off with TOOL_ALERT_EMAILS=off, or free checks only with TOOL_ALERT_EMAILS=free_check.",
  });
  return { subject, html, text };
}

export async function sendToolAlert(row: Row, opts: { emailLeft?: boolean } = {}): Promise<void> {
  const { subject, html, text } = toolAlertEmail(row, opts);
  const to = process.env.TOOL_ALERT_TO?.trim() || BRAND.supportEmail;
  const res = await sendEmail({ to, subject, html, text, ...(row.email ? { replyTo: row.email } : {}) });
  if (!res.ok) console.warn(`[tool-usage] alert not sent (${res.skipped ? "email not configured" : "send failed"})`);
}
