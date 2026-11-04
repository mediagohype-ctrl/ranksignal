import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, CheckCircle2, Clock, FileText, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { hasRole, requireAppProject } from "@/lib/dashboard/server";
import { ACTIVE_RUN_STATUSES } from "@/lib/dashboard/format";
import { IMPACT_LABEL } from "@/lib/report/issues";
import { pointsLabel } from "@/lib/report/points";
import { plural } from "@/lib/report/inputs";
import { recheckLine, timeLabel, todoHref, type TodoItem, type TodoSide } from "@/lib/tasks/todo";
import { loadTodo } from "@/lib/tasks/todo-server";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { RunButtons } from "@/components/app/run-buttons";
import { PutBackButton } from "@/components/app/fix/fix-screen";
import { todoItemHref } from "@/components/app/nav";
import { Card, EmptyState, LinkButton, Meter, PageHeader } from "@/components/ui";

export const metadata = { title: "To-do" };

const TABS: { key: TodoSide; label: string }[] = [
  { key: "website", label: "On your website" },
  { key: "outside", label: "Outside your website" },
];

function TodoCard({ projectId, item }: { projectId: string; item: TodoItem }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-4 sm:flex-nowrap sm:px-6">
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <p className="text-small font-medium text-fg">{item.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} aria-hidden /> {timeLabel(item.minutes)}
          </span>
          {item.points > 0 ? <span className="font-semibold text-success">{pointsLabel(item.points)}</span> : <span>{IMPACT_LABEL[item.impact]}</span>}
          {item.state === "started" && <span className="font-medium text-info">Started</span>}
        </p>
      </div>
      <LinkButton href={todoItemHref(projectId, item.id)} variant="secondary" size="sm" iconRight={<ArrowRight />} aria-label={`Fix: ${item.title}`}>
        {item.state === "started" ? "Continue" : "Fix"}
      </LinkButton>
    </li>
  );
}

// The To-do tab (Developer Brief v1): "What do I fix?" — one list, most gain for least work first.
export default async function TodoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { session, project } = await requireAppProject(id);
  const tab: TodoSide = sp.tab === "outside" ? "outside" : "website";
  const [{ report, lists }, activeCrawl] = await Promise.all([
    loadTodo(session, project.id),
    db.crawlRun.findFirst({ where: { organizationId: session.organizationId, projectId: project.id, status: { in: ACTIVE_RUN_STATUSES } }, select: { id: true } }),
  ]);
  const canRun = hasRole(session, "member");
  const shown = tab === "website" ? lists.website : lists.outside;
  const { done, total } = lists.progress;

  return (
    <div className="mx-auto max-w-[960px] space-y-6">
      <PageHeader
        title="To-do"
        description="What to fix, best first: the most help for the least work."
        actions={<AutoRefresh active={!!activeCrawl} intervalMs={5000} label="Checking your website…" />}
      />

      {!report && lists.outside.length === 0 && lists.website.length === 0 ? (
        <Card padding="md">
          <EmptyState
            icon={<FileText />}
            title={activeCrawl ? "Reading your website…" : "Check your website to get your to-do list"}
            description={activeCrawl ? "Your list appears here when it's done." : undefined}
            action={!activeCrawl && canRun ? <RunButtons projectId={project.id} crawlActive={false} visibilityActive={false} canRun show={["audit"]} /> : undefined}
          />
        </Card>
      ) : (
        <>
          {total > 0 && (
            <section aria-label="Progress" className="space-y-2">
              <p className="text-small font-semibold text-fg">
                {done} of {total} done
              </p>
              <Meter value={done} max={total} label={`${done} of ${total} done`} tone="usage" size="md" />
            </section>
          )}

          <nav aria-label="To-do lists" className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2 p-1">
            {TABS.map((t) => {
              const n = t.key === "website" ? lists.website.length : lists.outside.length;
              const active = t.key === tab;
              return (
                <Link
                  key={t.key}
                  href={todoHref(project.id, { tab: t.key })}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-center text-small font-medium transition-colors",
                    active ? "bg-surface text-fg shadow-xs" : "text-muted hover:text-fg",
                  )}
                >
                  <span className="truncate">{t.label}</span>
                  <span className="tabular-nums text-xs text-muted">{n}</span>
                </Link>
              );
            })}
          </nav>

          <Card as="section" aria-label={TABS.find((t) => t.key === tab)!.label}>
            {shown.length === 0 ? (
              <div className="p-5 sm:p-6">
                <EmptyState
                  size="sm"
                  icon={<Sparkles />}
                  title={tab === "website" ? "Nothing to fix on your website right now." : "Nothing to do outside your website right now."}
                  action={
                    tab === "website" ? (
                      <LinkButton href={todoHref(project.id, { tab: "outside" })} variant="secondary" size="sm">
                        See outside your website
                      </LinkButton>
                    ) : (
                      <LinkButton href={`${todoHref(project.id)}/listings`} variant="secondary" size="sm">
                        Add a listing
                      </LinkButton>
                    )
                  }
                />
              </div>
            ) : (
              <ol className="divide-y divide-border">
                {shown.map((item) => (
                  <TodoCard key={item.id} projectId={project.id} item={item} />
                ))}
              </ol>
            )}
          </Card>

          {lists.done.length > 0 && (
            <details className="group rounded-2xl border border-border bg-surface">
              <summary className="cursor-pointer list-none px-4 py-3 text-small font-medium text-fg-soft hover:text-fg sm:px-6">
                Done ({lists.done.length})
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {lists.done.map((item) => {
                  const r = recheckLine(item.recheck ?? null);
                  return (
                    <li key={item.id} className="flex items-start gap-3 px-4 py-3 sm:px-6">
                      <CheckCircle2 size={18} aria-hidden className="mt-0.5 shrink-0 text-success" />
                      <div className="min-w-0 flex-1">
                        <Link href={todoItemHref(project.id, item.id)} className="text-small font-medium text-fg hover:underline">
                          {item.title}
                        </Link>
                        {r && <p className={clsx("mt-0.5 text-xs", r.tone === "success" ? "text-success" : "text-muted")}>{r.text}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}

          {lists.hidden.length > 0 && (
            <details className="rounded-2xl border border-border bg-surface">
              <summary className="cursor-pointer list-none px-4 py-3 text-small font-medium text-fg-soft hover:text-fg sm:px-6">
                Skipped or not for you ({lists.hidden.length})
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {lists.hidden.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                    <span className="min-w-0 flex-1 text-small text-fg-soft">{item.title}</span>
                    {canRun && <PutBackButton projectId={project.id} itemId={item.id} label={item.title} />}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="text-small text-muted">
            {report ? `From your last website check: ${plural(report.issues.length, "problem")}.` : null}{" "}
            <Link href={`${todoHref(project.id)}/listings`} className="font-medium text-primary hover:underline">
              Your listings
            </Link>
            {" · "}
            <Link href={`${todoHref(project.id)}/board`} className="font-medium text-primary hover:underline">
              Task board
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
