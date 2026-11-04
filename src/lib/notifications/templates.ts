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

/**
 * Priority groups as shown to people (docs/PLAIN_WORDS.md). Report issues carry impact high/medium/low; raw
 * audit severities (critical/high → Urgent, medium → Important, low/info → Nice to have) are only a fallback.
 */
const PRIORITIES = [
  { label: "urgent", impacts: ["high"], severities: ["critical", "high"] },
  { label: "important", impacts: ["medium"], severities: ["medium"] },
  { label: "nice to have", impacts: ["low"], severities: ["low", "info"] },
] as const;
const pct = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? `${Math.round(x * 100)}%` : "—");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Counts per priority. Pass the REPORT's grouped issues (getStoredReport(...).issues) so the message matches the
 * number people see in the report; `openBySeverity` (raw finding rows) is a legacy fallback only.
 */
export function priorityCounts(o: { issues?: { impact: string }[] | null; openBySeverity?: Partial<Record<string, number>> }): [string, number][] {
  if (o.issues) {
    return PRIORITIES.map((p) => [p.label, o.issues!.filter((i) => (p.impacts as readonly string[]).includes(i.impact)).length] as [string, number]).filter(([, n]) => n > 0);
  }
  const sev = o.openBySeverity ?? {};
  return PRIORITIES.map((p) => [p.label, p.severities.reduce((a, s) => a + (sev[s] ?? 0), 0)] as [string, number]).filter(([, n]) => n > 0);
}

/** After the WEBSITE check. AI results come separately ("Your AI results are ready") — never "full report" here. */
export function reportReadyNotice(o: {
  organizationId: string; projectId: string; projectName: string; crawlRunId: string; pagesCrawled: number;
  /** The report's grouped issues (preferred). */
  issues?: { impact: string }[] | null;
  /** Legacy fallback: open findings by severity. */
  openBySeverity?: Partial<Record<string, number>>;
}): RunNotice {
  const counts = priorityCounts(o);
  const total = counts.reduce((a, [, n]) => a + n, 0);
  const summary = total
    ? `We found ${plural(total, "problem")} to fix: ${counts.map(([s, n]) => `${n} ${s}`).join(", ")}.`
    : "We didn't find any problems to fix this time.";
  const urgent = counts.find(([s]) => s === "urgent")?.[1] ?? 0;
  return {
    organizationId: o.organizationId,
    projectId: o.projectId,
    type: "report_ready",
    title: `Your website results are ready — ${o.projectName}`,
    body: `We checked ${plural(o.pagesCrawled, "page")}. ${summary}`,
    link: `/app/projects/${o.projectId}/report?run=${o.crawlRunId}`,
    email: {
      subject: `Your website results for ${o.projectName} are ready`,
      preheader: summary,
      paragraphs: [
        `We just finished checking ${plural(o.pagesCrawled, "page")} on ${o.projectName}'s website.`,
        summary,
        urgent > 0
          ? `Start with the ${plural(urgent, "urgent problem")} — each one explains what's wrong, why it matters and how to fix it.`
          : "Each problem is explained in plain English, with suggested fixes.",
        "What AI tools say about you comes next — we'll tell you when your AI results are ready.",
      ],
      ctaLabel: "See your website results",
    },
  };
}

/** After the AI check. `questions` = distinct customer questions actually asked in this run. */
export function visibilityReadyNotice(o: {
  organizationId: string; projectId: string; projectName: string; visibilityRunId: string;
  metrics: { mentionRate?: unknown; citationRate?: unknown; collected?: unknown; simulated?: unknown } | null;
  partial: boolean;
  questions?: number | null;
  /** Answers expected (run.sampleSize), for "123 of 125 answers". */
  expected?: number | null;
}): RunNotice {
  const m = o.metrics ?? {};
  const simulated = m.simulated === true;
  const answers = typeof m.collected === "number" ? m.collected : null;
  const questions = typeof o.questions === "number" && o.questions > 0 ? o.questions : null;
  const rates = `AI named you in ${pct(m.mentionRate)} of answers and linked to your site in ${pct(m.citationRate)}.`;
  const notes = [
    simulated ? "These are made-up demo answers (simulated), not real AI answers." : "",
    o.partial
      ? answers !== null && o.expected
        ? `We got ${answers} of ${o.expected} answers this time, so the numbers are based on fewer answers.`
        : "Some questions couldn't be checked this time, so the numbers are based on fewer answers."
      : "",
  ].filter(Boolean);
  return {
    organizationId: o.organizationId,
    projectId: o.projectId,
    type: "visibility_ready",
    title: `Your AI results are ready — ${o.projectName}`,
    body: [rates, ...notes].join(" "),
    link: `/app/projects/${o.projectId}/visibility?run=${o.visibilityRunId}`,
    email: {
      subject: `Your AI results for ${o.projectName} are ready`,
      preheader: rates,
      paragraphs: [
        questions !== null
          ? `We asked AI assistants ${plural(questions, "question")} your customers might ask${answers !== null ? ` and read ${plural(answers, "answer")}` : ""}.`
          : "We asked AI assistants the questions your customers might ask.",
        rates,
        ...notes,
        "Results move around from one check to the next, so look at the trend over several checks rather than a single number.",
      ],
      ctaLabel: "See your AI results",
    },
  };
}

/** Plain-English reason for a failed website check or AI check. Never echoes raw internals for unknown errors. */
export function plainFailureReason(error: string | null | undefined, errorClass: string | null | undefined): string {
  const e = (error ?? "").toLowerCase();
  if (e.includes("interrupted")) return "The check was interrupted while our servers restarted. Please run it again.";
  // Daily AI budget: the check isn't failed, it continues tomorrow (the job requeues it).
  if (e.includes("budget")) return "We've reached today's limit for AI checks. We'll finish the rest of your AI check tomorrow — there's nothing you need to do.";
  if (e.includes("ai answers")) return "You've used all the AI answers in your plan for this month. They reset on the 1st, or you can upgrade for more.";
  if (e.includes("trial has ended")) return "Your free trial has ended. Choose a plan to keep running checks.";
  if (e.includes("payment")) return "Checks are paused because your last payment didn't go through. Update your payment details to continue.";
  if (e.includes("paused") || e.includes("suspended")) return "Your workspace is paused, so new checks can't start. Contact us to turn it back on.";
  if (errorClass === "quota" || e.includes("credit") || e.includes("quota") || e.includes("usage"))
    return "Your plan's usage limit for this month was reached. It resets on the 1st of next month, or you can upgrade.";
  if (e.includes("no active prompts")) return "There are no customer questions to check yet. Add some on the Customer questions page.";
  if (e.includes("no visibility provider")) return "No AI assistant is connected for checks right now. Please try again later.";
  if (e.includes("robots")) return "Your site's robot rules file asked us not to read these pages, so we stopped.";
  if (/dns|enotfound|econnrefused|timed? ?out|timeout|unreachable|fetch failed|status 5\d\d|tls|certificate/.test(e))
    return "We couldn't reach your website. Check that it's online and loads in a browser, then try again.";
  if (errorClass === "policy") return "The check was blocked by a safety rule. Contact us if you think this is a mistake.";
  return "Something went wrong on our side. You can try again from your website's Home page; if it keeps happening, contact us.";
}

export function jobFailedNotice(o: {
  organizationId: string; projectId: string; projectName: string; kind: "crawl" | "visibility"; runId: string;
  error: string | null; errorClass: string | null;
}): RunNotice {
  const what = o.kind === "crawl" ? "website check" : "AI check";
  const reason = plainFailureReason(o.error, o.errorClass);
  const path = o.kind === "crawl" ? "audit" : "visibility";
  return {
    organizationId: o.organizationId,
    projectId: o.projectId,
    type: "job_failed",
    title: `A check didn't finish — ${o.projectName}`,
    body: `The ${what} didn't finish. ${reason}`,
    link: `/app/projects/${o.projectId}/${path}?failed=${o.runId}`,
    email: {
      subject: `The ${what} for ${o.projectName} didn't finish`,
      preheader: reason,
      paragraphs: [`The ${what} for ${o.projectName} didn't finish.`, reason, "Your earlier results are unchanged."],
      ctaLabel: "Open your website",
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
    title: `${n} need${o.count === 1 ? "s" : ""} your OK — ${o.projectName}`,
    body: `We drafted ${n} for ${o.projectName}. Nothing is published until you review and approve the exact wording.`,
    link: `/app/projects/${o.projectId}/actions?run=${o.workflowRunId}`,
    email: {
      subject: `${n} need${o.count === 1 ? "s" : ""} your OK (${o.projectName})`,
      preheader: "Nothing is published until you approve it.",
      paragraphs: [
        `We drafted ${n} for ${o.projectName} based on the latest website check.`,
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
