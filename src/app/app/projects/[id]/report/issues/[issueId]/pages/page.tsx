import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ExternalLink, Search, Sparkles, Wrench } from "lucide-react";
import { db } from "@/lib/db";
import { hasRole, requireAppProject } from "@/lib/dashboard/server";
import { asArray } from "@/lib/dashboard/format";
import { loadIssue } from "@/lib/report/issue-page";
import { checkIdOfIssue } from "@/lib/report/page-notes";
import { resolveFix } from "@/lib/fix-guides";
import { pageName } from "@/lib/fix-guides/helpers";
import { CODE_PLATFORMS, PLATFORM_LABEL, type Platform } from "@/lib/platform/detect";
import { getSitePlatform } from "@/lib/platform/server";
import { OPEN_STATUSES, type TaskPriority } from "@/lib/tasks/types";
import type { IssueImpact } from "@/lib/report/types";
import { issueHref, issuePageHref } from "@/components/app/nav";
import { CopyBlock } from "@/components/app/actions/copy-block";
import { AddToTasksButton } from "@/components/app/fix/add-to-tasks";
import { InlineCode } from "@/components/app/fix/inline-code";
import { Card, LinkButton } from "@/components/ui";

export const metadata = { title: "Problem on one page" };

const PRIORITY: Record<IssueImpact, TaskPriority> = { high: "high", medium: "medium", low: "low" };

/** For "same as another page" problems: which field must be unique. */
const DUP_FIELD: Record<string, "title" | "description"> = { "seo.titles": "title", "seo.meta_description": "description" };

// One affected page of one problem: what this page has now, what's wrong with it, which other pages it clashes
// with, and how to fix it on this page (change, platform steps, AI prompt, add to tasks).
export default async function IssuePageDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; issueId: string }>;
  searchParams: Promise<{ url?: string }>;
}) {
  const [{ id, issueId: raw }, sp] = await Promise.all([params, searchParams]);
  const issueId = decodeURIComponent(raw);
  const { session, project } = await requireAppProject(id);
  const data = await loadIssue(session.organizationId, project.id, issueId);
  if (!data || !sp.url) notFound();
  const { report, issue, pages } = data;
  const at = pages.findIndex((p) => p.url === sp.url);
  if (at < 0) notFound();
  const page = pages[at];
  const x = page.extracted;
  const name = pageName(page.url);

  const detected = await getSitePlatform(session.organizationId, project.id, project.websiteUrl, report.crawl.crawlRunId);
  const platform: Platform = detected ?? "custom";
  const brand = asArray<string>(project.brandNames)[0] ?? project.name;
  const ctx = { brand, websiteUrl: project.websiteUrl, platform, issue };
  const whole = resolveFix({ ...ctx, pages });
  const one = resolveFix({ ...ctx, pages: [page] });
  const change = one.changes[0];

  const field = DUP_FIELD[checkIdOfIssue(issue.id) ?? ""];
  const value = field && x?.[field]?.trim().toLowerCase();
  const twins = value ? pages.filter((p) => p.url !== page.url && p.extracted?.[field]?.trim().toLowerCase() === value) : [];

  const problemHref = issueHref(project.id, issue.id);
  const prev = pages[at - 1];
  const next = pages[at + 1];
  const taskTitle = `Fix: ${issue.title} (${name})`.slice(0, 200);
  const existing = await db.task.findFirst({
    where: { organizationId: session.organizationId, projectId: project.id, title: taskTitle, status: { in: [...OPEN_STATUSES] } },
    select: { id: true },
  });
  const taskText = [
    `Page: ${page.url}`,
    page.note ? `What we found: ${page.note}` : null,
    change ? `Change: "${change.now}" → "${change.change}"` : null,
    "",
    `How to fix it (${PLATFORM_LABEL[platform]}):`,
    ...one.steps.map((s, i) => `${i + 1}. ${s}`),
  ]
    .filter((l): l is string => l !== null)
    .join("\n")
    .slice(0, 4900);

  const facts: { label: string; value: string }[] = x
    ? [
        { label: "Google headline (title)", value: x.title?.trim() || "Missing" },
        { label: "Google summary (description)", value: x.description?.trim() || "Missing" },
        { label: "Main heading (H1)", value: x.h1[0]?.trim() || "Missing" },
        { label: "Words on the page", value: x.wordCount.toLocaleString("en") },
        ...(x.images.length ? [{ label: "Images", value: `${x.images.length} (${x.images.filter((i) => !i.alt?.trim()).length} without a description)` }] : []),
      ]
    : [];

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <Link href={problemHref} className="inline-flex items-center gap-1.5 text-small font-medium text-muted hover:text-fg">
        <ArrowLeft size={16} aria-hidden /> Back to the problem
      </Link>

      <header className="space-y-2">
        <p className="eyebrow">
          Page {at + 1} of {pages.length} · {issue.title}
        </p>
        <h1 className="break-words text-h1 text-fg">{name}</h1>
        <a href={page.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-small font-medium text-primary hover:underline">
          <span className="truncate">{page.url}</span>
          <ExternalLink size={13} aria-hidden className="shrink-0" />
          <span className="sr-only">(opens in new tab)</span>
        </a>
      </header>

      <Card as="section" padding="md" aria-label="The problem on this page" className="space-y-5">
        <div>
          <h2 className="text-caption uppercase tracking-[0.06em] text-muted">What&apos;s wrong on this page</h2>
          <p className="mt-1.5 text-body text-fg">{page.note ?? issue.whatsWrong}</p>
        </div>
        <div>
          <h2 className="text-caption uppercase tracking-[0.06em] text-muted">Why it&apos;s a problem</h2>
          <p className="mt-1.5 text-body text-fg-soft">{whole.effect}</p>
        </div>
        {twins.length > 0 && (
          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <h2 className="text-caption uppercase tracking-[0.06em] text-muted">
              {twins.length} other {twins.length === 1 ? "page has" : "pages have"} exactly the same {field === "title" ? "headline" : "summary"}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {twins.slice(0, 30).map((t) => (
                <li key={t.url}>
                  <Link
                    href={issuePageHref(project.id, issue.id, t.url)}
                    className="inline-flex h-7 items-center rounded-full border border-border bg-surface px-2.5 text-xs font-medium text-fg-soft hover:border-border-strong"
                  >
                    {pageName(t.url)}
                  </Link>
                </li>
              ))}
              {twins.length > 30 && <li className="self-center text-xs text-muted">…and {twins.length - 30} more</li>}
            </ul>
            <p className="mt-2 text-small text-fg-soft">To Google these all look like the same page, so it can&apos;t tell which one to show.</p>
          </div>
        )}
      </Card>

      {x && (
        <Card as="section" padding="md" aria-labelledby="now">
          <h2 id="now" className="flex items-center gap-2 text-h4 text-fg">
            <Search size={18} aria-hidden className="text-muted" /> How this page looks in Google today
          </h2>
          <div className="mt-3 rounded-xl border border-border bg-surface px-4 py-3">
            <p className="truncate text-xs text-muted">{page.url}</p>
            <p className="mt-0.5 text-[1.05rem] font-medium leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{x.title?.trim() || name}</p>
            <p className="mt-1 line-clamp-2 text-small text-fg-soft">{x.description?.trim() || "No summary set, so Google picks some text from the page."}</p>
          </div>
          <dl className="mt-4 divide-y divide-border">
            {facts.map((f) => (
              <div key={f.label} className="grid gap-1 py-2.5 sm:grid-cols-[14rem_1fr] sm:gap-4">
                <dt className="text-small text-muted">{f.label}</dt>
                <dd className={f.value === "Missing" ? "text-small font-medium text-danger" : "break-words text-small text-fg"}>{f.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <Card as="section" padding="md" aria-labelledby="fix-this">
        <h2 id="fix-this" className="flex items-center gap-2 text-h4 text-fg">
          <Wrench size={18} aria-hidden className="text-primary" /> How to fix this page
        </h2>
        {change && (
          <div className="mt-3 grid gap-2 rounded-xl border border-primary/30 bg-primary-soft px-4 py-3 sm:grid-cols-2 sm:gap-4">
            <div>
              <p className="text-caption uppercase tracking-[0.06em] text-muted">Now</p>
              <p className="mt-0.5 break-words text-small text-fg-soft">{change.now}</p>
            </div>
            <div>
              <p className="text-caption uppercase tracking-[0.06em] text-muted">Change it to</p>
              <p className="mt-0.5 break-words text-small font-semibold text-fg">{change.change}</p>
            </div>
          </div>
        )}
        <p className="mt-4 text-small text-muted">
          {detected ? `Steps for ${PLATFORM_LABEL[platform]}, which your website is built with.` : "General steps (we couldn't tell what your website is built with)."}
        </p>
        <ol className="mt-3 space-y-3">
          {one.steps.map((step, n) => (
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
        <LinkButton href={`${problemHref}/fix`} variant="secondary" size="sm" iconRight={<ArrowRight />} className="mt-4">
          Fix all {pages.length} pages at once
        </LinkButton>
      </Card>

      <section aria-labelledby="prompt" className="space-y-3">
        <div>
          <h2 id="prompt" className="flex items-center gap-2 text-h4 text-fg">
            <Sparkles size={18} aria-hidden className="text-primary" /> Let AI fix this page
          </h2>
          <p className="mt-0.5 text-small text-muted">
            {CODE_PLATFORMS.includes(platform)
              ? "Paste this into an AI coding assistant opened in your website's code (Cursor, Claude Code, GitHub Copilot, or ChatGPT)."
              : "Paste this into ChatGPT, Claude or Gemini. It writes the new text and walks you through the clicks."}
          </p>
        </div>
        <CopyBlock text={one.prompt} label="AI prompt for this page" maxHeight="14rem" />
      </section>

      <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
        <div>
          <p className="font-semibold text-fg">Fix this page later?</p>
          <p className="text-small text-fg-soft">Save it to your task list with the change and the steps.</p>
        </div>
        <AddToTasksButton
          projectId={project.id}
          canEdit={hasRole(session, "member")}
          existing={!!existing}
          task={{ title: taskTitle, description: taskText, category: one.category, priority: PRIORITY[issue.impact], links: [page.url] }}
        />
      </div>

      <nav aria-label="Other pages with this problem" className="flex items-center justify-between gap-3 border-t border-border pt-6 text-small font-medium">
        {prev ? (
          <Link href={issuePageHref(project.id, issue.id, prev.url)} className="inline-flex min-w-0 items-center gap-1.5 text-muted hover:text-fg">
            <ArrowLeft size={16} aria-hidden className="shrink-0" /> <span className="truncate">{pageName(prev.url)}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={issuePageHref(project.id, issue.id, next.url)} className="inline-flex min-w-0 items-center gap-1.5 text-muted hover:text-fg">
            <span className="truncate">Next page: {pageName(next.url)}</span> <ArrowRight size={16} aria-hidden className="shrink-0" />
          </Link>
        ) : (
          <Link href={problemHref} className="text-muted hover:text-fg">
            Back to the problem
          </Link>
        )}
      </nav>
    </div>
  );
}
