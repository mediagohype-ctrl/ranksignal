import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, ExternalLink, FileBarChart2, FolderKanban, ListChecks, Plus, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireAppSession } from "@/lib/dashboard/server";
import { readMetrics } from "@/lib/dashboard/data";
import { fmtRelative, hostOf, isActiveStatus } from "@/lib/dashboard/format";
import { Avatar, Badge, Card, LinkButton, PageHeader, ScoreRing, StatusBadge, Tooltip } from "@/components/ui";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const s = await requireAppSession();
  const projects = await db.project.findMany({
    where: { organizationId: s.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      visibilityRuns: {
        where: { status: { in: ["succeeded", "succeeded_with_warnings"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { metrics: true, finishedAt: true, createdAt: true },
      },
      crawlRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, finishedAt: true, createdAt: true, pagesCrawled: true },
      },
      _count: { select: { findings: { where: { status: "open" } }, actions: { where: { status: "awaiting_approval" } } } },
    },
  });
  if (projects.length === 0) redirect("/app/onboarding");

  return (
    <>
      <PageHeader
        icon={<FolderKanban />}
        title="Projects"
        description="Each project follows one website and brand — how healthy the site is, and how AI assistants talk about it."
        actions={
          <LinkButton href="/app/onboarding" icon={<Plus />}>
            New project
          </LinkButton>
        }
      />
      <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => {
          const vis = p.visibilityRuns[0];
          const crawl = p.crawlRuns[0];
          const m = readMetrics(vis?.metrics);
          const index = m ? Math.round(m.visibilityIndex) : null;
          const scanning = crawl && isActiveStatus(crawl.status);
          const times = [vis?.finishedAt ?? vis?.createdAt, crawl?.finishedAt ?? crawl?.createdAt].filter(Boolean) as Date[];
          const lastScan = times.length ? new Date(Math.max(...times.map((t) => t.getTime()))) : null;
          const href = `/app/projects/${p.id}`;
          return (
            <Card as="li" key={p.id} variant="interactive" className="relative flex flex-col">
              <div className="flex items-start gap-3 p-5 pb-4">
                <Avatar name={p.name} size="lg" className="ring-0" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-h4 truncate text-fg">
                    <Link href={`${href}/report`} className="after:absolute after:inset-0 after:rounded-2xl after:content-['']">
                      {p.name}
                    </Link>
                  </h2>
                  <a
                    href={p.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative z-[1] inline-flex max-w-full items-center gap-1 text-small text-muted hover:text-fg"
                  >
                    <span className="truncate">{hostOf(p.websiteUrl)}</span>
                    <ExternalLink size={12} aria-hidden className="shrink-0" />
                    <span className="sr-only">(opens in new tab)</span>
                  </a>
                </div>
                {m?.simulated && (
                  <Tooltip content="Demo data — connect an AI provider for real answers" side="bottom" focusable className="relative z-[1]">
                    <Badge tone="warning" size="sm">
                      Simulated
                    </Badge>
                  </Tooltip>
                )}
              </div>

              <div className="flex items-center gap-4 px-5 pb-5">
                <ScoreRing score={index} grade={null} size="sm" label="AI visibility index" />
                <div className="min-w-0 flex-1">
                  <div className="text-caption uppercase tracking-[0.06em] text-muted">AI visibility</div>
                  <div className="text-small text-fg-soft">
                    {index === null ? "Not measured yet" : index >= 50 ? "Often appears in AI answers" : index >= 20 ? "Sometimes appears" : "Rarely appears"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-h3 tabular-nums text-fg">{p._count.findings}</div>
                  <div className="text-xs text-muted">open issues</div>
                </div>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-5 py-3 text-xs text-muted">
                {scanning ? (
                  <StatusBadge status="running" />
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={13} aria-hidden />
                    {lastScan ? `Last scan ${fmtRelative(lastScan)}` : "No scans yet"}
                  </span>
                )}
                {p._count.actions > 0 && (
                  <Badge tone="warning" size="sm" icon={<ShieldCheck />}>
                    {p._count.actions} to approve
                  </Badge>
                )}
                <div className="relative z-[1] ml-auto flex items-center gap-1">
                  <Tooltip content="Site audit">
                    <LinkButton href={`${href}/audit`} variant="ghost" size="icon-sm" aria-label={`Site audit for ${p.name}`}>
                      <ListChecks />
                    </LinkButton>
                  </Tooltip>
                  <Tooltip content="Approvals">
                    <LinkButton href={`${href}/actions`} variant="ghost" size="icon-sm" aria-label={`Actions and approvals for ${p.name}`}>
                      <ShieldCheck />
                    </LinkButton>
                  </Tooltip>
                  <LinkButton href={`${href}/report`} variant="secondary" size="xs" icon={<FileBarChart2 />} iconRight={<ArrowRight />}>
                    Report
                  </LinkButton>
                </div>
              </div>
            </Card>
          );
        })}
        <li>
          <Link
            href="/app/onboarding"
            className="flex h-full min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary-soft-fg"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-surface-2">
              <Plus size={20} aria-hidden />
            </span>
            <span className="text-small font-medium">Add another website</span>
          </Link>
        </li>
      </ul>
    </>
  );
}
