// Email + in-app notification copy for a delivered monthly report (pure).
import { BRAND, bookCallHref } from "@/lib/brand";
import { REFERRAL_TERMS, REFERRAL_TITLE } from "@/lib/growth/referral-copy";
import { nothingDone } from "./compute";
import { renderEmail } from "@/lib/email/layout";
import { emailBranding, type Branding } from "@/lib/branding";
import type { MonthlyReportPayload } from "./types";

export function monthlyReportLink(projectId: string, period: string): string {
  return `/app/projects/${projectId}/monthly/${period}`;
}

/** "15 minutes" / "1 hour" / "4 hours" for a fix's time. */
export function minutesText(m: number): string {
  if (m < 60) return `${m} minutes`;
  const h = Math.round(m / 60);
  return `${h} ${h === 1 ? "hour" : "hours"}`;
}

/**
 * A month with nothing done leads with a nudge instead of a report of zeros (zeros make people cancel).
 * Real top fix from the end-of-month report (title, time, points). Null when something was done.
 */
export function monthlyNudge(p: Pick<MonthlyReportPayload, "work" | "issues" | "topFix">): { headline: string; fix: string | null; help: string } | null {
  if (!nothingDone(p)) return null;
  const f = p.topFix ?? null;
  return {
    headline: "You haven't fixed anything yet.",
    fix: f
      ? `Fix #1 — “${f.title.replace(/\.$/, "")}” — takes about ${minutesText(f.minutes)}${f.points > 0 ? ` and adds ${f.points} ${f.points === 1 ? "point" : "points"} to your score` : ""}.`
      : null,
    help: "Or let our team do it: book a free call.",
  };
}

/** Absolute "Book a free call" link (the calendar, or the contact page until the owner sets one). */
export function bookCallUrl(appUrl: string = BRAND.appUrl): string {
  return new URL(bookCallHref(), appUrl).toString();
}

const pct = (n: number | null | undefined) => (typeof n === "number" ? `${Math.round(n * 100)}%` : "—");

/**
 * `branding` (optional, from getBranding(orgId)) white-labels the email; pass the returned `replyTo` to sendEmail.
 * Without it the email is unchanged.
 */
export function monthlyReportEmail(p: MonthlyReportPayload, summary: string, appUrl: string = BRAND.appUrl, branding?: Branding) {
  const eb = branding ? emailBranding(branding) : undefined;
  const sender = eb?.displayName ?? BRAND.name;
  const subject = monthlyNudge(p)
    ? `${p.project.name}: your first fix takes ${p.topFix ? `about ${minutesText(p.topFix.minutes)}` : "a few minutes"}`
    : `Your ${p.periodLabel} impact report — ${p.project.name}`;
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
  const nudge = monthlyNudge(p);
  // Never send a line of zeros: a month with nothing done leads with the next fix instead.
  if (!nudge) facts.push(`Work done: ${p.work.shipped.length}. Problems fixed: ${p.issues.fixed.total}.`);
  const referral = `${REFERRAL_TITLE}: ${REFERRAL_TERMS} Your invite link is on your website's Home page in ${BRAND.name}.`;
  const caveat = "We measure changes but can't promise them, and AI answers vary from one check to the next — the report explains what we can and can't tell.";
  const paragraphs = nudge
    ? [
        nudge.headline,
        ...(nudge.fix ? [nudge.fix] : []),
        `${nudge.help.replace(/\.$/, "")}: ${bookCallUrl(appUrl)}`,
        ...facts,
        caveat,
        referral,
      ]
    : [summary, ...facts, caveat, referral];
  const { html, text } = renderEmail({
    title: nudge ? `Your ${p.periodLabel} update for ${p.project.name}` : `${p.periodLabel} impact report for ${p.project.name}`,
    preheader: nudge ? (nudge.fix ?? nudge.headline) : (facts[0] ?? `Your ${p.periodLabel} report is ready.`),
    paragraphs,
    cta: nudge && p.topFix
      ? { label: "Start fix #1", url: new URL(`/app/projects/${p.project.id}/todo/${encodeURIComponent(p.topFix.id)}`, appUrl).toString() }
      : { label: "Open the full report", url: new URL(monthlyReportLink(p.project.id, p.period), appUrl).toString() },
    footer: `You're getting this because you're an Owner or Admin on ${sender}. To stop these emails for this website, open Settings → Notifications.`,
    branding: eb,
  });
  return { subject, html, text, replyTo: (eb && branding?.replyTo) || undefined };
}

export function monthlyReportNotice(p: MonthlyReportPayload) {
  return {
    type: "monthly_report" as const,
    title: `${p.periodLabel} impact report is ready — ${p.project.name}`,
    body: monthlyNudge(p)
      ? [monthlyNudge(p)!.headline, monthlyNudge(p)!.fix ?? "Your first fix is waiting on your To-do list."].join(" ")
      : `${p.work.shipped.length} ${p.work.shipped.length === 1 ? "item" : "items"} done, ${p.issues.fixed.total} ${p.issues.fixed.total === 1 ? "problem" : "problems"} fixed. See what changed and what's next.`,
    link: monthlyReportLink(p.project.id, p.period),
  };
}
