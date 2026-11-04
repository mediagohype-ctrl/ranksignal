// Staff "Send follow-up" email for a free-check lead: their score, the top fix, and a sign-up link (pure, unit-tested).
import { BRAND } from "@/lib/brand";
import { renderEmail } from "@/lib/email/layout";

/** SentMessage kind for the one-time lead follow-up (key = lead id). */
export const LEAD_FOLLOWUP_KIND = "lead_followup";

/** Free-check leads store their top fix as "Top fix: <title>" in Lead.message (see /api/public/free-check). */
export const TOP_FIX_PREFIX = "Top fix: ";

export function topFixMessage(title: string | null | undefined): string | null {
  return title ? `${TOP_FIX_PREFIX}${title}`.slice(0, 500) : null;
}

export function topFixFromMessage(message: string | null | undefined): string | null {
  if (!message?.startsWith(TOP_FIX_PREFIX)) return null;
  return message.slice(TOP_FIX_PREFIX.length).trim() || null;
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function band(score: number): string {
  return score >= 75 ? "Good" : score >= 50 ? "Needs work" : "Poor";
}

export function leadFollowupEmail(lead: { url: string | null; score: number | null; message: string | null }, appUrl = BRAND.appUrl) {
  const host = hostOf(lead.url);
  const topFix = topFixFromMessage(lead.message);
  const base = appUrl.replace(/\/$/, "");
  const signup = `${base}/signup${lead.url ? `?website=${encodeURIComponent(lead.url)}` : ""}`;
  const subject = (host ? `Your website check for ${host}` : "Your free website check").slice(0, 150);
  const paragraphs = [
    "Hi,",
    `Thanks for running the free website check${host ? ` on ${host}` : ""} with ${BRAND.name}.`,
    ...(lead.score != null ? [`Your score was ${lead.score} / 100 (${band(lead.score)}).`] : []),
    ...(topFix ? [`The most useful fix we found: ${topFix}.`] : []),
    "The free check only reads your website. The full check also asks ChatGPT and Gemini the questions your customers ask, and gives you every fix in plain words.",
    "You can try it free for 7 days. If you have any questions, just reply to this email.",
  ];
  const { html, text } = renderEmail({
    title: host ? `Your result for ${host}` : "Your free check result",
    preheader: lead.score != null ? `Your score: ${lead.score} / 100` : "Your free website check",
    paragraphs,
    cta: { label: "See all fixes free for 7 days", url: signup },
  });
  return { subject, html, text };
}
