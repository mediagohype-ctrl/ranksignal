"use client";
import { useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { Avatar, Button, Select } from "@/components/ui";
import { STATUS_HINT, STATUS_LABEL, TASK_STATUSES, type TaskStatus, type TaskView } from "@/lib/tasks/types";
import { CategoryBadge, DueText, InternalBadge, PerformerBadge, PriorityBadge, STATUS_DOT } from "./task-meta";

const BOARD_COLUMNS: TaskStatus[] = ["backlog", "in_progress", "client_review", "blocked", "done"];

function TaskCard({
  task,
  canEdit,
  moving,
  onOpen,
  onMove,
}: {
  task: TaskView;
  canEdit: boolean;
  moving: boolean;
  onOpen: (t: TaskView) => void;
  onMove: (t: TaskView, s: TaskStatus) => void;
}) {
  const selectId = `move-${task.id}`;
  return (
    <li
      className={clsx(
        "group rounded-xl border border-border bg-surface p-3 shadow-xs transition-shadow hover:shadow-card-hover",
        moving && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="focus-ring block w-full rounded-md text-left text-small font-semibold text-fg hover:text-primary"
      >
        {task.title}
      </button>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <CategoryBadge category={task.category} />
        <PriorityBadge priority={task.priority} hideMedium />
        {task.performedBy !== "agency" && <PerformerBadge performedBy={task.performedBy} />}
        {!task.clientVisible && <InternalBadge />}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-caption">
        <DueText dueAt={task.dueAt} status={task.status} />
        {task.assigneeName ? (
          <span className="ml-auto inline-flex min-w-0 items-center gap-1.5 text-muted" title={`Assigned to ${task.assigneeName}`}>
            <Avatar name={task.assigneeName} size="xs" />
            <span className="sr-only">Assigned to {task.assigneeName}</span>
          </span>
        ) : null}
      </div>
      {canEdit && (
        <div className="mt-3 border-t border-border pt-2.5">
          <label htmlFor={selectId} className="sr-only">
            Move “{task.title}” to
          </label>
          <Select
            id={selectId}
            inputSize="sm"
            value={task.status}
            disabled={moving}
            onChange={(e) => onMove(task, e.target.value as TaskStatus)}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === task.status ? `${STATUS_LABEL[s]} (current)` : `Move to ${STATUS_LABEL[s]}`}
              </option>
            ))}
          </Select>
        </div>
      )}
    </li>
  );
}

export function BoardView({
  tasks,
  canEdit,
  movingId,
  onOpen,
  onMove,
  onCreate,
}: {
  tasks: TaskView[];
  canEdit: boolean;
  movingId: string | null;
  onOpen: (t: TaskView) => void;
  onMove: (t: TaskView, s: TaskStatus) => void;
  onCreate: (status: TaskStatus) => void;
}) {
  const [showCancelled, setShowCancelled] = useState(false);
  const columns = showCancelled ? [...BOARD_COLUMNS, "cancelled" as const] : BOARD_COLUMNS;
  const cancelledCount = tasks.filter((t) => t.status === "cancelled").length;
  const rank = { high: 0, medium: 1, low: 2 } as const;

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-3">
        {columns.map((status) => {
          const items = tasks
            .filter((t) => t.status === status)
            .sort((a, b) =>
              status === "done"
                ? (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
                : rank[a.priority] - rank[b.priority] || (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9"),
            );
          const headingId = `col-${status}`;
          return (
            <section
              key={status}
              aria-labelledby={headingId}
              className="flex w-[17.5rem] shrink-0 snap-start flex-col rounded-2xl bg-surface-2 p-3"
            >
              <header className="mb-3 flex items-start justify-between gap-2 px-1">
                <div className="min-w-0">
                  <h3 id={headingId} className="flex items-center gap-2 text-small font-semibold text-fg">
                    <span aria-hidden className={clsx("size-2 rounded-full", STATUS_DOT[status])} />
                    {STATUS_LABEL[status]}
                    <span className="rounded-full bg-surface-3 px-1.5 text-xs tabular-nums leading-5 text-fg-soft">{items.length}</span>
                  </h3>
                  <p className="mt-0.5 text-caption text-muted">{STATUS_HINT[status]}</p>
                </div>
                {canEdit && status !== "done" && status !== "cancelled" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Add a task to ${STATUS_LABEL[status]}`}
                    onClick={() => onCreate(status)}
                  >
                    <Plus />
                  </Button>
                )}
              </header>
              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border-strong px-3 py-6 text-center text-caption text-muted">
                  Nothing here
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {items.map((t) => (
                    <TaskCard key={t.id} task={t} canEdit={canEdit} moving={movingId === t.id} onOpen={onOpen} onMove={onMove} />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      {cancelledCount > 0 && (
        <Button variant="link" size="sm" onClick={() => setShowCancelled((v) => !v)}>
          {showCancelled ? "Hide cancelled tasks" : `Show ${cancelledCount} cancelled task${cancelledCount === 1 ? "" : "s"}`}
        </Button>
      )}
    </div>
  );
}
