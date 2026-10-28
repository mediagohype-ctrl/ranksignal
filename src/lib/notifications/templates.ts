// Pure builders for run-completion notifications (in-app row + email copy). Plain English, no guarantees.

export type RunNoticeType = "report_ready" | "visibility_ready" | "job_failed" | "approval_requested";

export interface RunNotice {
  organizationId: string;
  projectId: string;
  type: RunNoticeType;
  title: string;
  body: string;
  /** Unique per run — doubles as the dedupe key together with `type`. */
  link: string;
  email: { subject: string; preheader: string; paragraphs: string[]; ctaLabel: string };
}

const SEVERITIES = ["critical", "high", "medium", "low"] as const;
const pct = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? `${Math.round(x * 100)}%` : "—");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function reportReadyNotice(o: {
  organizationId: string; projectId: string; projectName: string; crawlRunId: string; pagesCrawled: number;
  openBySeverity: Partial<Record<string, number>>;
}): RunNotice {
  const counts = SEVERITIES.map((s) => [s, o.openBySeverity[s] ?? 0] as const).filter(([, n]) => n > 0);
  const total = counts.reduce((a, [, n]) => a + n, 0);
  const summary = total
    ? `We found ${plural(total, "open issue")}: ${counts.map(([s, n]) => `${n} ${s}`).join(", ")}.`
    : "We didn't find any open issues this time.";
  const urgent = (o.openBySeverity.critical ?? 0) + (o.openBySeverity.high ?? 0);
  return {
    organizationId: o.organizationId,
    projectId: o.projectId,
    type: "report_ready",
    title: `Your website report is ready — ${o.projectName}`,
    body: `We checked ${plural(o.pagesCrawled, "page")}. ${summary}`,
    link: `/app/projects/${o.projectId}/report?run=${o.crawlRunId}`,
    email: {
      subject: `Your website report for ${o.projectName} is ready`,
      preheader: summary,
      paragraphs: [
        `We just finished checking ${plural(o.pagesCrawled, "page")} on ${o.projectName}'s website.`,
        summary,
        urgent > 0
          ? `Start with the ${plural(urgent, "critical or high-priority item")} — the report explains what's wrong, why it matters and how to fix it.`
          : "The report explains each finding in plain English, with suggested fixes.",
      ],
      ctaLabel: "Open the report",
    },
  };
}

export function visibilityReadyNotice(o: {
  organizationId: string; projectId: string; projectName: string; visibilityRunId: string;
  metrics: { mentionRate?: unknown; citationRate?: unknown; collected?: unknown; simulated?: unknown } | null;
  partial: boolean;
}): RunNotice {
  const m = o.metrics ?? {};
  const simulated = m.simulated === true;
  const answers = typeof m.collected === "number" ? m.collected : null;
  const rates = `Mentioned in ${pct(m.mentionRate)} of answers; your site was cited in ${pct(m.citationRate)}.`;
  const notes = [
    simulated ? "These are simulated demo answers, not real AI responses." : "",
    o.partial ? "Some questions couldn't be checked this time, so the numbers are based on fewer answers." : "",
  ].filter(Boolean);
  return {
    organizationId: o.organizationId,
    projectId: o.projectId,
    type: "visibility_ready",
    title: `AI visibility check finished — ${o.projectName}`,
    body: [rates, ...notes].join(" "),
    link: `/app/projects/${o.projectId}/visibility?run=${o.visibilityRunId}`,
    email: {
      subject: `AI visibility check finished for ${o.projectName}`,
      preheader: rates,
      paragraphs: [
        `We asked AI assistants${answers !== null ? ` ${plural(answers, "question")}` : " your tracked questions"} that your customers might ask.`,
        rates,
        ...notes,
        "Results move around from run to run; look at the trend over several checks rather than a single number.",
      ],
      ctaLabel: "See the results",
    },
  };
}

/** Plain-English reason for a failed scan. Never echoes raw internals for unknown errors. */
export function plainFailureReason(error: string | null | undefined, errorClass: string | null | undefined): string {
  const e = (error ?? "").toLowerCase();
  if (e.includes("interrupted")) return "The scan was interrupted while our servers restarted. Please run it again.";
  if (errorClass === "quota" || e.includes("credit") || e.includes("quota") || e.includes("budget"))
    return "Your plan's usage limit was reached. Usage resets at the start of your next billing period, or you can upgrade.";
  if (e.includes("no active prompts")) return "There are no questions to check yet. Add some questions on the Prompts page.";
  if (e.includes("no visibility provider")) return "No AI assistant is connected for checks right now. Please try again later.";
  if (e.includes("robots")) return "Your website's robots.txt asked us not to read these pages, so we stopped.";
  if (/dns|enotfound|econnrefused|timed? ?out|timeout|unreachable|fetch failed|status 5\d\d|tls|certificate/.test(e))
    return "We couldn't reach your website. Check that it's online and loads in a browser, then try again.";
  if (errorClass === "policy") return "The scan was blocked by a safety rule.";
  return "Something went wrong on our side. You can try again from the project page; if it keeps happening, contact support.";
}

export function jobFailedNotice(o: {
  organizationId: string; projectId: string; projectName: string; kind: "crawl" | "visibility"; runId: string;
  error: string | null; errorClass: string | null;
}): RunNotice {
  const what = o.kind === "crawl" ? "website scan" : "AI visibility check";
  const reason = plainFailureReason(o.error, o.errorClass);
  const path = o.kind === "crawl" ? "audit" : "visibility";
  return {
    organizationId: o.organizationId,
    projectId: o.projectId,
    type: "job_failed",
    title: `A scan failed — ${o.projectName}`,
    body: `The ${what} didn't finish. ${reason}`,
    link: `/app/projects/${o.projectId}/${path}?failed=${o.runId}`,
    email: {
      subject: `The ${what} for ${o.projectName} didn't finish`,
      preheader: reason,
      paragraphs: [`The ${what} for ${o.projectName} didn't finish.`, reason, "Your earlier results are unchanged."],
      ctaLabel: "Open the project",
    },
  };
}

export function approvalsNotice(o: {
  organizationId: string; projectId: string; projectName: string; workflowRunId: string; count: number;
}): RunNotice {
  const n = plural(o.count, "change");
  return {
    organizationId: o.organizationId,
    projectId: o.projectId,
    type: "approval_requested",
    title: `${n} need${o.count === 1 ? "s" : ""} your approval — ${o.projectName}`,
    body: `We drafted ${n} for ${o.projectName}. Nothing is published until you review and approve the exact wording.`,
    link: `/app/projects/${o.projectId}/actions?run=${o.workflowRunId}`,
    email: {
      subject: `${n} need${o.count === 1 ? "s" : ""} your approval (${o.projectName})`,
      preheader: "Nothing is published until you approve it.",
      paragraphs: [
        `We drafted ${n} for ${o.projectName} based on the latest scan.`,
        "Nothing is published until you review and approve the exact wording. You can also edit or reject each one.",
      ],
      ctaLabel: "Review changes",
    },
  };
}

/** Pure dedupe: drop notices already stored (same org + type + link) and duplicates within the batch. */
export function filterUnsent<T extends Pick<RunNotice, "organizationId" | "type" | "link">>(
  notices: T[],
  existing: { organizationId: string; type: string; link: string | null }[],
): T[] {
  const key = (n: { organizationId: string; type: string; link: string | null }) => `${n.organizationId}|${n.type}|${n.link ?? ""}`;
  const seen = new Set(existing.map(key));
  return notices.filter((n) => {
    const k = key(n);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
