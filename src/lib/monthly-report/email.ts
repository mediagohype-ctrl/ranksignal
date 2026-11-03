// Email + in-app notification copy for a delivered monthly report (pure).
import { BRAND } from "@/lib/brand";
import { renderEmail } from "@/lib/email/layout";
import { emailBranding, type Branding } from "@/lib/branding";
import type { MonthlyReportPayload } from "./types";

export function monthlyReportLink(projectId: string, period: string): string {
  return `/app/projects/${projectId}/monthly/${period}`;
}

const pct = (n: number | null | undefined) => (typeof n === "number" ? `${Math.round(n * 100)}%` : "—");

/**
 * `branding` (optional, from getBranding(orgId)) white-labels the email; pass the returned `replyTo` to sendEmail.
 * Without it the email is unchanged.
 */
export function monthlyReportEmail(p: MonthlyReportPayload, summary: string, appUrl: string = BRAND.appUrl, branding?: Branding) {
  const eb = branding ? emailBranding(branding) : undefined;
  const sender = eb?.displayName ?? BRAND.name;
  const subject = `Your ${p.periodLabel} impact report — ${p.project.name}`;
  const facts: string[] = [];
  if (p.scores.end.overall !== null) {
    facts.push(
      p.scores.start.overall !== null
        ? `Website score: ${p.scores.start.overall} → ${p.scores.end.overall} out of 100.`
        : `Website score: ${p.scores.end.overall} out of 100.`,
    );
  }
  if (p.aiVisibility.end) {
    const s = p.aiVisibility.likeForLike?.start ?? p.aiVisibility.start;
    const e = p.aiVisibility.likeForLike?.end ?? p.aiVisibility.end;
    facts.push(s ? `Named in AI answers: ${pct(s.mentionRate)} → ${pct(e.mentionRate)}.` : `Named in ${pct(e.mentionRate)} of AI answers.`);
  }
  facts.push(`Work done: ${p.work.shipped.length}. Problems fixed: ${p.issues.fixed.total}.`);
  const { html, text } = renderEmail({
    title: `${p.periodLabel} impact report for ${p.project.name}`,
    preheader: facts[0] ?? `Your ${p.periodLabel} report is ready.`,
    paragraphs: [summary, ...facts, "We measure changes but can't promise them, and AI answers vary from one check to the next — the report explains what we can and can't tell."],
    cta: { label: "Open the full report", url: new URL(monthlyReportLink(p.project.id, p.period), appUrl).toString() },
    footer: `You're getting this because you're an Owner or Admin on ${sender}. To stop these emails for this website, open Settings → Notifications.`,
    branding: eb,
  });
  return { subject, html, text, replyTo: (eb && branding?.replyTo) || undefined };
}

export function monthlyReportNotice(p: MonthlyReportPayload) {
  return {
    type: "monthly_report" as const,
    title: `${p.periodLabel} impact report is ready — ${p.project.name}`,
    body: `${p.work.shipped.length} ${p.work.shipped.length === 1 ? "item" : "items"} done, ${p.issues.fixed.total} ${p.issues.fixed.total === 1 ? "problem" : "problems"} fixed. See what changed and what's next.`,
    link: monthlyReportLink(p.project.id, p.period),
  };
}
