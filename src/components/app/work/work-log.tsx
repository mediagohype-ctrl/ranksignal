"use client";
import { Bot, Building2, CheckCircle2, ExternalLink, Info, User, Zap } from "lucide-react";
import clsx from "clsx";
import { Card, CardBody, CardHeader, EmptyState, Notice, Stat } from "@/components/ui";
import { hostOf } from "@/lib/dashboard/format";
import { PERFORMER_LABEL, groupByWeek, type TaskPerformer } from "@/lib/tasks/types";
import { CategoryBadge } from "./task-meta";

/** ShippedItem with dates serialized for the client. */
export interface ShippedItemView {
  kind: "task" | "change";
  title: string;
  category: string;
  performedBy: TaskPerformer;
  completedAt: string;
  url?: string;
  taskId?: string;
  actionId?: string;
}

export interface WorkLogMonth {
  label: string;
  items: ShippedItemView[];
}

const PERFORMER_ICON = { agency: Building2, client: User, system: Bot } as const;
const PERFORMER_CHIP: Record<TaskPerformer, string> = {
  agency: "bg-primary-soft text-primary-soft-fg",
  client: "bg-accent-soft text-accent",
  system: "bg-info-soft text-info",
};

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return `${hostOf(url)}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
}

function weekLabel(iso: string) {
  const d = new Date(iso);
  return `Week of ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}

function MonthLog({ month, current, onOpenTask }: { month: WorkLogMonth; current: boolean; onOpenTask: (id: string) => void }) {
  const counts = { agency: 0, client: 0, system: 0 } as Record<TaskPerformer, number>;
  for (const it of month.items) counts[it.performedBy]++;
  const weeks = groupByWeek(month.items);

  return (
    <Card as="section">
      <CardHeader
        eyebrow={current ? "This month" : "Last month"}
        title={month.label}
        description={
          month.items.length
            ? `${month.items.length} item${month.items.length === 1 ? "" : "s"} shipped`
            : current
              ? "Nothing shipped yet this month."
              : "Nothing was shipped this month."
        }
      />
      <CardBody className="space-y-6">
        {month.items.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {(["agency", "client", "system"] as const).map((p) => {
              const Icon = PERFORMER_ICON[p];
              return <Stat key={p} size="sm" label={PERFORMER_LABEL[p]} value={counts[p]} icon={<Icon />} />;
            })}
          </div>
        )}
        {weeks.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<CheckCircle2 />}
            title={current ? "Work shipped this month will appear here" : "No shipped work recorded"}
            description="Finished tasks and changes applied to your site are listed with the date and who did them."
          />
        ) : (
          <ol className="space-y-6">
            {weeks.map((w) => (
              <li key={w.weekOf}>
                <h4 className="mb-2 text-caption uppercase tracking-[0.06em] text-muted">{weekLabel(w.weekOf)}</h4>
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {w.items.map((it, i) => {
                    const Icon = PERFORMER_ICON[it.performedBy];
                    const KindIcon = it.kind === "change" ? Zap : CheckCircle2;
                    return (
                      <li key={`${it.taskId ?? it.actionId ?? i}-${it.completedAt}`} className="flex gap-3 px-4 py-3">
                        <KindIcon
                          size={18}
                          aria-hidden
                          className={clsx("mt-0.5 shrink-0", it.kind === "change" ? "text-info" : "text-success")}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            {it.taskId ? (
                              <button
                                type="button"
                                onClick={() => onOpenTask(it.taskId!)}
                                className="focus-ring rounded-md text-left text-small font-medium text-fg hover:text-primary hover:underline"
                              >
                                {it.title}
                              </button>
                            ) : (
                              <span className="text-small font-medium text-fg">{it.title}</span>
                            )}
                            {it.kind === "change" && <span className="text-caption text-muted">Applied to your site</span>}
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-caption">
                            <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium", PERFORMER_CHIP[it.performedBy])}>
                              <Icon size={12} aria-hidden />
                              {PERFORMER_LABEL[it.performedBy]}
                            </span>
                            <CategoryBadge category={it.category} />
                            {it.url && (
                              <a
                                href={it.url}
                                target="_blank"
                                rel="noopener noreferrer nofollow"
                                className="inline-flex min-w-0 items-center gap-1 text-primary hover:underline"
                              >
                                <span className="truncate">{shortUrl(it.url)}</span>
                                <ExternalLink size={12} aria-hidden className="shrink-0" />
                              </a>
                            )}
                          </div>
                        </div>
                        <time dateTime={it.completedAt} className="shrink-0 text-caption tabular-nums text-muted">
                          {new Date(it.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

export function WorkLog({
  months,
  showsInternal,
  onOpenTask,
}: {
  months: [WorkLogMonth, WorkLogMonth];
  showsInternal: boolean;
  onOpenTask: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <Notice tone="neutral" icon={<Info />} title="What this shows">
        Every finished task and every change applied to your site, with who did it: <strong>Our team</strong>, <strong>You</strong>, or{" "}
        <strong>Automated</strong> (a change you approved, applied through your connected site). This is a record of work delivered; it
        doesn&apos;t claim any ranking or traffic result. Measured changes are in your monthly report.
        {showsInternal && " You can see internal tasks here too; clients only see client-visible work."}
      </Notice>
      <div className="grid gap-6 xl:grid-cols-2">
        <MonthLog month={months[0]} current onOpenTask={onOpenTask} />
        <MonthLog month={months[1]} current={false} onOpenTask={onOpenTask} />
      </div>
    </div>
  );
}
