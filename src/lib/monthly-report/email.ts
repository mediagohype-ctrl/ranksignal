// Email + in-app notification copy for a delivered monthly report (pure).
import { BRAND } from "@/lib/brand";
import { renderEmail } from "@/lib/email/layout";
import type { MonthlyReportPayload } from "./types";

export function monthlyReportLink(projectId: string, period: string): string {
  return `/app/projects/${projectId}/monthly/${period}`;
}

const pct = (n: number | null | undefined) => (typeof n === "number" ? `${Math.round(n * 100)}%` : "—");

export function monthlyReportEmail(p: MonthlyReportPayload, summary: string, appUrl: string = BRAND.appUrl) {
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
    facts.push(s ? `Mentioned in AI answers: ${pct(s.mentionRate)} → ${pct(e.mentionRate)}.` : `Mentioned in ${pct(e.mentionRate)} of AI answers.`);
  }
  facts.push(`Work shipped: ${p.work.shipped.length}. Issues fixed: ${p.issues.fixed.total}.`);
  const { html, text } = renderEmail({
    title: `${p.periodLabel} impact report for ${p.project.name}`,
    preheader: facts[0] ?? `Your ${p.periodLabel} report is ready.`,
    paragraphs: [summary, ...facts, "Changes are measured, not guaranteed, and AI answers vary between checks — the report explains what we can and can't conclude."],
    cta: { label: "Open the full report", url: new URL(monthlyReportLink(p.project.id, p.period), appUrl).toString() },
    footer: `You're getting this because you're an owner or admin on ${BRAND.name}. To stop these emails for this project, open Project settings → Notifications.`,
  });
  return { subject, html, text };
}

export function monthlyReportNotice(p: MonthlyReportPayload) {
  return {
    type: "monthly_report" as const,
    title: `${p.periodLabel} impact report is ready — ${p.project.name}`,
    body: `${p.work.shipped.length} item${p.work.shipped.length === 1 ? "" : "s"} shipped, ${p.issues.fixed.total} issue${p.issues.fixed.total === 1 ? "" : "s"} fixed. See what changed and what's next.`,
    link: monthlyReportLink(p.project.id, p.period),
  };
}
