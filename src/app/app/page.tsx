import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, ExternalLink, FileBarChart2, FolderKanban, ListChecks, Plus, RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { requireAppSession } from "@/lib/dashboard/server";
import { readMetrics } from "@/lib/dashboard/data";
import { fmtRelative, hostOf, isActiveStatus } from "@/lib/dashboard/format";
import { getPlan } from "@/lib/billing/plans";
import { loadTodo } from "@/lib/tasks/todo-server";
import { todoHref } from "@/lib/tasks/todo";
import { Avatar, Badge, Card, LinkButton, PageHeader, ScoreRing, StatusBadge, Tooltip } from "@/components/ui";

export const metadata = { title: "All websites" };

export default async function ProjectsPage() {
  const s = await requireAppSession();
  const [org, projects] = await Promise.all([
    db.organization.findUnique({ where: { id: s.organizationId }, select: { planId: true } }),
    db.project.findMany({
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
    },
    }),
  ]);
  if (projects.length === 0) redirect("/app/onboarding");

  // "N fixes waiting" = the open items on that website's To-do list (loadTodo — the same list and number the
  // To-do page shows). There is no separate screen of changes waiting for approval any more (the old Fixes to
  // approve page now opens the To-do list), so the card no longer says "N to approve" for any offer.
  const waiting = new Map<string, number | null>(
    await Promise.all(
      projects.map(async (p) => {
        try {
          const { lists } = await loadTodo(s, p.id);
          return [p.id, lists.website.length + lists.outside.length] as const;
        } catch {
          return [p.id, null] as const;
        }
      }),
    ),
  );
  // A full plan can't add another website: say so on the card instead of promising "Add another website".
  const plan = getPlan(org?.planId ?? "trial");
  const planFull = projects.length >= plan.maxProjects;

  return (
    <>
      <PageHeader
        icon={<FolderKanban />}
        title="All websites"
        description="See how each website looks to Google and whether AI tools name you."
        actions={
          planFull ? undefined : (
            <LinkButton href="/app/onboarding" icon={<Plus />}>
              Add a website
            </LinkButton>
          )
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
          const fixes = waiting.get(p.id) ?? null;
          const todo = todoHref(p.id);
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
                  <Tooltip content="Sample answers, not real ones. Real AI answers appear once AI checks are switched on." side="bottom" focusable className="relative z-[1]">
                    <Badge tone="warning" size="sm">
                      Sample data
                    </Badge>
                  </Tooltip>
                )}
              </div>

              <div className="flex items-center gap-4 px-5 pb-5">
                <ScoreRing score={index} grade={null} size="sm" label="AI mentions score" />
                <div className="min-w-0 flex-1">
                  <div className="text-caption uppercase tracking-[0.06em] text-muted">AI mentions</div>
                  <div className="text-small text-fg-soft">
                    {index === null ? "Not checked yet" : index >= 50 ? "Often named in AI answers" : index >= 20 ? "Sometimes named" : "Rarely named"}
                  </div>
                </div>
                {fixes !== null && (
                  <Link href={todo} className="relative z-[1] rounded-lg text-right hover:underline" aria-label={`${fixes} ${fixes === 1 ? "fix" : "fixes"} waiting for ${p.name}. Open the To-do list.`}>
                    <div className="text-h3 tabular-nums text-fg">{fixes}</div>
                    <div className="text-xs text-muted">{fixes === 1 ? "fix waiting" : "fixes waiting"}</div>
                  </Link>
                )}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border px-5 py-3 text-xs text-muted">
                {scanning ? (
                  <StatusBadge status="running" />
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={13} aria-hidden />
                    {lastScan ? `Last checked ${fmtRelative(lastScan)}` : "Not checked yet"}
                  </span>
                )}
                <div className="relative z-[1] ml-auto flex items-center gap-1">
                  <Tooltip content="To-do list">
                    <LinkButton href={todo} variant="ghost" size="icon-sm" aria-label={`To-do list for ${p.name}`}>
                      <ListChecks />
                    </LinkButton>
                  </Tooltip>
                  <LinkButton href={`${href}/report`} variant="secondary" size="xs" icon={<FileBarChart2 />} iconRight={<ArrowRight />}>
                    Full report
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
              {planFull ? <RefreshCw size={20} aria-hidden /> : <Plus size={20} aria-hidden />}
            </span>
            {planFull ? (
              <>
                <span className="text-small font-medium">Replace your website or talk to us about more</span>
                <span className="text-xs">
                  Your {plan.name} plan includes {plan.maxProjects} {plan.maxProjects === 1 ? "website" : "websites"}.
                </span>
              </>
            ) : (
              <span className="text-small font-medium">Add another website</span>
            )}
          </Link>
        </li>
      </ul>
    </>
  );
}
