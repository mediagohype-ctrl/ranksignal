import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Sparkles } from "lucide-react";
import clsx from "clsx";
import { db } from "@/lib/db";
import { hasRole, requireAppProject } from "@/lib/dashboard/server";
import { asArray } from "@/lib/dashboard/format";
import { loadIssue } from "@/lib/report/issue-page";
import { resolveFix } from "@/lib/fix-guides";
import { CODE_PLATFORMS, isPlatform, PLATFORM_LABEL, PLATFORMS, type Platform } from "@/lib/platform/detect";
import { getSitePlatform } from "@/lib/platform/server";
import { OPEN_STATUSES, type TaskPriority } from "@/lib/tasks/types";
import type { IssueImpact } from "@/lib/report/types";
import { issueHref } from "@/components/app/nav";
import { CopyBlock } from "@/components/app/actions/copy-block";
import { AddToTasksButton } from "@/components/app/fix/add-to-tasks";
import { InlineCode } from "@/components/app/fix/inline-code";
import { Card, LinkButton, Table, TD, TH, THead, TR } from "@/components/ui";

export const metadata = { title: "How to fix" };

const PRIORITY: Record<IssueImpact, TaskPriority> = { high: "high", medium: "medium", low: "low" };

/** Plain-text task description: the problem, the plan and the steps, so the task stands on its own. */
function taskDescription(o: { whatsWrong: string; platform: string; steps: string[]; changes: { page: string; change: string }[]; guideUrl: string }) {
  const L = [o.whatsWrong, "", `How to fix it (${o.platform}):`, ...o.steps.map((s, i) => `${i + 1}. ${s}`)];
  if (o.changes.length) {
    L.push("", "What to change:");
    for (const c of o.changes.slice(0, 30)) L.push(`- ${c.page}: ${c.change}`);
  }
  L.push("", `Full guide and AI prompt: ${o.guideUrl}`);
  const text = L.join("\n");
  return text.length > 4900 ? `${text.slice(0, 4890)}…` : text;
}

// Step 2 of a problem: how to fix it on the platform the site is built with, a page-by-page plan with real
// values, a copyable AI prompt, how to check it worked, and "Add to my task list" (brief 5.5, one next step).
export default async function FixPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; issueId: string }>;
  searchParams: Promise<{ platform?: string }>;
}) {
  const [{ id, issueId: raw }, sp] = await Promise.all([params, searchParams]);
  const issueId = decodeURIComponent(raw);
  const { session, project } = await requireAppProject(id);
  const data = await loadIssue(session.organizationId, project.id, issueId);
  if (!data) notFound();
  const { report, issue, next, pages } = data;

  const detected = await getSitePlatform(session.organizationId, project.id, project.websiteUrl, report.crawl.crawlRunId);
  const chosen: Platform = isPlatform(sp.platform) ? sp.platform : (detected ?? "custom");
  const brand = asArray<string>(project.brandNames)[0] ?? project.name;
  const fix = resolveFix({ brand, websiteUrl: project.websiteUrl, platform: chosen, issue, pages });
  const code = CODE_PLATFORMS.includes(chosen);

  const problemHref = issueHref(project.id, issue.id);
  const fixHref = `${problemHref}/fix`;
  const taskTitle = `Fix: ${issue.title}`.slice(0, 200);
  const existing = await db.task.findFirst({
    where: { organizationId: session.organizationId, projectId: project.id, title: taskTitle, status: { in: [...OPEN_STATUSES] } },
    select: { id: true },
  });

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <Link href={problemHref} className="inline-flex items-center gap-1.5 text-small font-medium text-muted hover:text-fg">
        <ArrowLeft size={16} aria-hidden /> Back to the problem
      </Link>

      <header className="space-y-2">
        <p className="eyebrow">How to fix</p>
        <h1 className="text-h1 text-balance text-fg">{issue.title}</h1>
        <p className="inline-flex items-center gap-1.5 text-small text-muted">
          <Clock size={14} aria-hidden /> {fix.time}
        </p>
      </header>

      <Card as="section" padding="md" aria-label="The problem and its effect" className="space-y-4">
        <div>
          <h2 className="text-caption uppercase tracking-[0.06em] text-muted">The problem</h2>
          <p className="mt-1.5 text-body text-fg">{issue.whatsWrong}</p>
        </div>
        <div>
          <h2 className="text-caption uppercase tracking-[0.06em] text-muted">What it does to your website</h2>
          <p className="mt-1.5 text-body text-fg-soft">{fix.effect}</p>
        </div>
      </Card>

      {/* Platform */}
      <section aria-labelledby="platform" className="space-y-3">
        <h2 id="platform" className="text-h4 text-fg">
          {detected && chosen === detected ? (
            <>Your website is built with <span className="text-primary">{PLATFORM_LABEL[chosen]}</span></>
          ) : (
            <>Steps for <span className="text-primary">{PLATFORM_LABEL[chosen]}</span></>
          )}
        </h2>
        <p className="text-small text-muted">
          {detected ? "We found this from your website's code." : "We couldn't tell what your website is built with."} Not right? Pick yours:
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => (
            <li key={p}>
              <Link
                href={`${fixHref}?platform=${p}`}
                scroll={false}
                aria-current={p === chosen ? "true" : undefined}
                className={clsx(
                  "inline-flex h-8 items-center rounded-full border px-3 text-small font-medium transition-colors",
                  p === chosen ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface text-fg-soft hover:border-border-strong",
                )}
              >
                {PLATFORM_LABEL[p]}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {fix.changes.length > 0 && (
        <Card as="section" aria-labelledby="changes">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <h2 id="changes" className="text-h4 text-fg">What to change, page by page</h2>
            <p className="mt-0.5 text-small text-muted">Our suggestions from your pages. Feel free to improve the wording.</p>
          </div>
          <div className="overflow-x-auto">
            <Table caption="What to change on each page">
              <THead>
                <tr>
                  <TH>Page</TH>
                  <TH>Now</TH>
                  <TH>Change it to</TH>
                </tr>
              </THead>
              <tbody>
                {fix.changes.map((c, i) => (
                  <TR key={`${c.page}-${i}`}>
                    <TD className="whitespace-nowrap font-medium text-fg">{c.page}</TD>
                    <TD className="min-w-48 text-muted">{c.now}</TD>
                    <TD className="min-w-56 text-fg">{c.change}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      <Card as="section" padding="md" aria-labelledby="steps">
        <h2 id="steps" className="text-h4 text-fg">
          Step by step{fix.platformSpecific ? ` in ${PLATFORM_LABEL[chosen]}` : ""}
        </h2>
        {!fix.platformSpecific && chosen !== "custom" && (
          <p className="mt-1 text-small text-muted">
            We don&apos;t have {PLATFORM_LABEL[chosen]}-specific steps for this one yet. These general steps work everywhere — the AI prompt below asks for {PLATFORM_LABEL[chosen]} steps.
          </p>
        )}
        <ol className="mt-4 space-y-3">
          {fix.steps.map((step, n) => (
            <li key={n} className="flex gap-3 text-body text-fg-soft">
              <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-small font-semibold text-primary-fg">
                {n + 1}
              </span>
              <span className="min-w-0 break-words pt-0.5 [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:font-mono [&_code]:text-small">
                <InlineCode text={step} />
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <section aria-labelledby="prompt" className="space-y-3">
        <div>
          <h2 id="prompt" className="flex items-center gap-2 text-h4 text-fg">
            <Sparkles size={18} aria-hidden className="text-primary" /> Let AI do it for you
          </h2>
          <p className="mt-0.5 text-small text-muted">
            {code
              ? "Copy this and paste it into an AI coding assistant opened in your website's code (Cursor, Claude Code, GitHub Copilot, or ChatGPT). It already includes your pages and what to change."
              : `Copy this and paste it into ChatGPT, Claude or Gemini. It writes the new text for each page and walks you through ${PLATFORM_LABEL[chosen]}.`}
          </p>
        </div>
        <CopyBlock text={fix.prompt} label="AI prompt" maxHeight="18rem" />
      </section>

      <Card as="section" padding="md" aria-labelledby="verify">
        <h2 id="verify" className="flex items-center gap-2 text-h4 text-fg">
          <CheckCircle2 size={18} aria-hidden className="text-success" /> Check it worked
        </h2>
        <ul className="mt-3 space-y-2">
          {fix.verify.map((v, n) => (
            <li key={n} className="flex gap-2 text-small text-fg-soft">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-muted" />
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
        <div>
          <p className="font-semibold text-fg">Not doing it right now?</p>
          <p className="text-small text-fg-soft">Save it to your task list with these steps, so you or your developer can do it later.</p>
        </div>
        <AddToTasksButton
          projectId={project.id}
          canEdit={hasRole(session, "member")}
          existing={!!existing}
          task={{
            title: taskTitle,
            description: taskDescription({
              whatsWrong: issue.whatsWrong,
              platform: PLATFORM_LABEL[chosen],
              steps: fix.steps,
              changes: fix.changes,
              guideUrl: fixHref,
            }),
            category: fix.category,
            priority: PRIORITY[issue.impact],
            links: pages.map((p) => p.url).filter((u) => /^https?:\/\//.test(u)),
          }}
        />
      </div>

      {next && (
        <div className="flex justify-end border-t border-border pt-6">
          <LinkButton href={issueHref(project.id, next.id)} variant="ghost" iconRight={<ArrowRight />}>
            Next problem
          </LinkButton>
        </div>
      )}
    </div>
  );
}
