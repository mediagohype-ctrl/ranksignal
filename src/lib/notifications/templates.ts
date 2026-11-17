// Pure builders for run-completion notifications (in-app row + email copy). Plain English, no guarantees.
import { changeLine, prioritySplit, problemCounts, type ProblemChange, type ProblemCounts } from "@/lib/report/counts";

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

/** Legacy fallback only: raw audit severities → the three priorities (critical/high → urgent, medium → important). */
function countsFromSeverities(sev: Partial<Record<string, number>>): ProblemCounts {
  const urgent = (sev.critical ?? 0) + (sev.high ?? 0);
  const important = sev.medium ?? 0;
  const niceToHave = (sev.low ?? 0) + (sev.info ?? 0);
  return { problems: urgent + important + niceToHave, urgent, important, niceToHave, places: null, pages: null };
}
const pct = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? `${Math.round(x * 100)}%` : "—");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type CountInput = { counts?: ProblemCounts | null; issues?: { impact: string }[] | null; openBySeverity?: Partial<Record<string, number>> };

function noticeCounts(o: CountInput): ProblemCounts {
  if (o.counts) return o.counts;
  if (o.issues) return problemCounts({ issues: o.issues as { impact: "high" | "medium" | "low" }[] });
  return countsFromSeverities(o.openBySeverity ?? {});
}

/**
 * Counts per priority, as [label, n] pairs. The numbers come from problemCounts (src/lib/report/counts.ts) — the ONE
 * definition every screen uses — fed with the REPORT's problem list (getStoredReport(...).issues). `openBySeverity`
 * (raw finding rows) is a legacy fallback only.
 */
export function priorityCounts(o: CountInput): [string, number][] {
  const c = noticeCounts(o);
  return ([["urgent", c.urgent], ["important", c.important], ["nice to have", c.niceToHave]] as [string, number][]).filter(([, n]) => n > 0);
}

/** "24 problems to fix: 6 urgent, 10 important, 8 nice to have" */
function toFixLine(c: ProblemCounts): string {
  const split = prioritySplit(c);
  return `${plural(c.problems, "problem")} to fix${split ? `: ${split}` : ""}`;
}

/**
 * After the WEBSITE check. AI results come separately ("Your AI results are ready") — never "full report" here.
 * First check: "Your website results are ready" with the full count. Every later check is about the CHANGE:
 * "2 problems fixed, 1 new. Score 49 → 52." (pass `change`, from problemChange in src/lib/report/counts.ts).
 */
export function reportReadyNotice(
  o: CountInput & {
    organizationId: string; projectId: string; projectName: string; crawlRunId: string; pagesCrawled: number;
    /** Set on a re-check: what changed since the previous website check. */
    change?: ProblemChange | null;
    /** True when AI answers aren't part of this count yet — they can add problems when they arrive. */
    aiPending?: boolean;
  },
): RunNotice {
  const c = noticeCounts(o);
  const summary = c.problems ? `We found ${toFixLine(c)}.` : "We didn't find any problems to fix this time.";
  const urgentLine =
    c.urgent > 0
      ? `Start with the ${plural(c.urgent, "urgent problem")} — each one explains what's wrong, why it matters and how to fix it.`
      : "Each problem is explained in plain English, with suggested fixes.";
  const aiNote = o.aiPending
    ? "This count covers your website only. When your AI results arrive they can add problems about what AI tools say, so the Full report may then show a few more."
    : "";
  const base = {
    organizationId: o.organizationId,
    projectId: o.projectId,
    type: "report_ready" as const,
    link: `/app/projects/${o.projectId}/report?run=${o.crawlRunId}`,
  };

  if (o.change) {
    const changed = changeLine(o.change);
    const now = c.problems ? `You now have ${toFixLine(c)}.` : "There are no problems left to fix right now.";
    return {
      ...base,
      title: `What changed on your website — ${o.projectName}`,
      body: `${changed} ${now}`,
      email: {
        subject: `What changed on ${o.projectName}: ${changed.replace(/\.$/, "")}`,
        preheader: changed,
        paragraphs: [`We checked ${plural(o.pagesCrawled, "page")} on ${o.projectName}'s website again.`, changed, now, ...(aiNote ? [aiNote] : []), urgentLine],
        ctaLabel: "See what changed",
      },
    };
  }

  return {
    ...base,
    title: `Your website results are ready — ${o.projectName}`,
    body: `We checked ${plural(o.pagesCrawled, "page")}. ${summary}`,
    email: {
      subject: `Your website results for ${o.projectName} are ready`,
      preheader: summary,
      paragraphs: [
        `We just finished checking ${plural(o.pagesCrawled, "page")} on ${o.projectName}'s website.`,
        summary,
        urgentLine,
        aiNote || "What AI tools say about you comes next — we'll tell you when your AI results are ready.",
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
  /** An AI spend limit ended the check early (metrics.stoppedEarly): say so, and that the rest was given back. */
  stoppedByLimit?: boolean;
}): RunNotice {
  const m = o.metrics ?? {};
  const simulated = m.simulated === true;
  const answers = typeof m.collected === "number" ? m.collected : null;
  const questions = typeof o.questions === "number" && o.questions > 0 ? o.questions : null;
  const rates = `AI named you in ${pct(m.mentionRate)} of answers and linked to your site in ${pct(m.citationRate)}.`;
  const notes = [
    simulated ? "These are made-up demo answers (simulated), not real AI answers." : "",
    o.stoppedByLimit
      ? `We had to stop this check early because the AI limit was reached${answers !== null && o.expected ? `: we got ${answers} of ${o.expected} answers` : ""}. The answers we didn't collect are back in your AI answers for this month.`
      : o.partial
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
  // The AI limit stopped the check for good (after waiting several days) before any answer came in.
  if (e.includes("ai limit reached"))
    return "We couldn't collect any AI answers because the AI limit was reached several days in a row, so we stopped this check. The AI answers it was holding are back in your allowance — you can start the AI check again.";
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
