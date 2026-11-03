import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronRight, ExternalLink, Globe, Wrench } from "lucide-react";
import { requireAppProject } from "@/lib/dashboard/server";
import { loadIssue } from "@/lib/report/issue-page";
import type { IssueImpact } from "@/lib/report/types";
import { issueHref, issuePageHref } from "@/components/app/nav";
import { PILLAR_SHORT } from "@/components/app/report/pillars";
import { Card, LinkButton } from "@/components/ui";

export const metadata = { title: "Problem" };

const PRIORITY: Record<IssueImpact, { label: string; tone: string; line: string }> = {
  high: { label: "Urgent", tone: "bg-danger-soft text-danger", line: "This one matters most. It's worth looking at first." },
  medium: { label: "Important", tone: "bg-warning-soft text-warning", line: "This holds your website back. Look at it after the urgent ones." },
  low: { label: "Nice to have", tone: "bg-surface-2 text-muted", line: "A small thing. Look at it when the bigger problems are done." },
};

/** Shows a page address the way people read it: "/about" instead of "https://example.com/about". */
function pathOf(url: string) {
  try {
    const u = new URL(url);
    const p = `${u.pathname}${u.search}`;
    return p === "/" ? "Home page (/)" : p;
  } catch {
    return url;
  }
}

// One problem on its own page (QA view): what's wrong, why it matters, and what we found on every affected page.
// The next step is its own page: how to fix it on the customer's platform (./fix).
export default async function IssuePage({ params }: { params: Promise<{ id: string; issueId: string }> }) {
  const { id, issueId: raw } = await params;
  const issueId = decodeURIComponent(raw);
  const { session, project } = await requireAppProject(id);
  const data = await loadIssue(session.organizationId, project.id, issueId);
  if (!data) notFound();
  const { report, issue, index, prev, next, pages, unlisted } = data;
  const reportHref = `/app/projects/${project.id}/report#issues`;
  const fixHref = `${issueHref(project.id, issue.id)}/fix`;
  const pr = PRIORITY[issue.impact];

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <Link href={reportHref} className="inline-flex items-center gap-1.5 text-small font-medium text-muted hover:text-fg">
        <ArrowLeft size={16} aria-hidden /> All problems ({report.issues.length})
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`inline-flex h-6 items-center rounded-full px-2.5 font-semibold ${pr.tone}`}>{pr.label}</span>
          <span className="inline-flex h-6 items-center rounded-full border border-border px-2.5 font-medium text-muted">
            Part of {PILLAR_SHORT[issue.pillar]}
          </span>
          <span className="text-muted">
            Problem {index + 1} of {report.issues.length}
          </span>
        </div>
        <h1 className="text-h1 text-balance text-fg">{issue.title}</h1>
        <p className="text-body text-muted">{pr.line}</p>
      </header>

      <Card as="section" padding="md" aria-label="About this problem" className="space-y-5">
        <div>
          <h2 className="text-caption uppercase tracking-[0.06em] text-muted">What&apos;s wrong</h2>
          <p className="mt-1.5 text-body text-fg">{issue.whatsWrong}</p>
        </div>
        <div>
          <h2 className="text-caption uppercase tracking-[0.06em] text-muted">Why it matters</h2>
          <p className="mt-1.5 text-body text-fg-soft">{issue.whyItMatters}</p>
        </div>
        {issue.evidence && (
          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <h2 className="text-caption uppercase tracking-[0.06em] text-muted">What we saw</h2>
            <p className="mt-1 break-words text-small text-fg-soft">{issue.evidence}</p>
          </div>
        )}
      </Card>

      <Card as="section" aria-labelledby="affected-pages">
        <div className="border-b border-border px-5 py-4 sm:px-6">
          <h2 id="affected-pages" className="text-h4 text-fg">
            {pages.length ? `Pages with this problem (${issue.affectedCount})` : "Where this problem is"}
          </h2>
          <p className="mt-0.5 text-small text-muted">
            {pages.length ? "Each page and what we found on it. Open a page to see everything about it and how to fix it there." : "This is about your website as a whole, not one page."}
          </p>
        </div>
        {pages.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-4 text-small text-fg-soft sm:px-6">
            <Globe size={18} aria-hidden className="shrink-0 text-muted" />
            <a href={project.websiteUrl} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-primary hover:underline">
              {project.websiteUrl}
            </a>
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {pages.map(({ url: u, note }) => {
              return (
                <li key={u} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <a
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 font-medium text-fg hover:text-primary hover:underline"
                    >
                      <span className="truncate">{pathOf(u)}</span>
                      <ExternalLink size={13} aria-hidden className="shrink-0 text-muted" />
                      <span className="sr-only">(opens in new tab)</span>
                    </a>
                    <p className="mt-0.5 break-words text-small text-muted">{note ?? "Found in your last website check."}</p>
                  </div>
                  <LinkButton
                    href={issuePageHref(project.id, issue.id, u)}
                    variant="secondary"
                    size="sm"
                    iconRight={<ChevronRight />}
                    aria-label={`See details for ${pathOf(u)}`}
                    className="shrink-0 self-center"
                  >
                    <span className="hidden sm:inline">See details</span>
                    <span className="sm:hidden">Details</span>
                  </LinkButton>
                </li>
              );
            })}
            {unlisted > 0 && (
              <li className="px-5 py-3.5 text-small text-muted sm:px-6">
                …and {unlisted} more {unlisted === 1 ? "page" : "pages"} like these.
              </li>
            )}
          </ol>
        )}
      </Card>

      <div className="sticky bottom-20 z-10 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between lg:bottom-4">
        <div>
          <p className="font-semibold text-fg">Ready to fix it?</p>
          <p className="text-small text-fg-soft">Step-by-step help for your website, and you can add it to your task list.</p>
        </div>
        <LinkButton href={fixHref} size="lg" icon={<Wrench />} iconRight={<ArrowRight />} className="w-full sm:w-auto">
          How to fix this
        </LinkButton>
      </div>

      <nav aria-label="Other problems" className="flex items-center justify-between gap-3 border-t border-border pt-6 text-small font-medium">
        {prev ? (
          <Link href={issueHref(project.id, prev.id)} className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
            <ArrowLeft size={16} aria-hidden /> Previous problem
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={issueHref(project.id, next.id)} className="inline-flex items-center gap-1.5 text-muted hover:text-fg">
            Next problem <ArrowRight size={16} aria-hidden />
          </Link>
        ) : (
          <Link href={reportHref} className="text-muted hover:text-fg">
            Back to all problems
          </Link>
        )}
      </nav>
    </div>
  );
}
