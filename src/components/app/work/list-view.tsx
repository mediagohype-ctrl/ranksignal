"use client";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Avatar, Button, Card, EmptyState, Input, Select, TD, TH, THead, TR, Table } from "@/components/ui";
import { fmtDate } from "@/lib/dashboard/format";
import {
  CATEGORY_LABEL,
  PERFORMER_LABEL,
  STATUS_LABEL,
  TASK_CATEGORIES,
  TASK_PERFORMERS,
  TASK_STATUSES,
  type AssigneeOption,
  type TaskView,
} from "@/lib/tasks/types";
import { CategoryBadge, DueText, InternalBadge, PerformerBadge, PriorityBadge, TaskStatusBadge } from "./task-meta";

interface Filters {
  q: string;
  status: string;
  category: string;
  performedBy: string;
  assignee: string;
}
const EMPTY: Filters = { q: "", status: "", category: "", performedBy: "", assignee: "" };

export function ListView({
  tasks,
  assignees,
  currentUserId,
  onOpen,
}: {
  tasks: TaskView[];
  assignees: AssigneeOption[];
  currentUserId: string;
  onOpen: (t: TaskView) => void;
}) {
  const [f, setF] = useState<Filters>(EMPTY);
  const set = (k: keyof Filters, v: string) => setF((p) => ({ ...p, [k]: v }));
  const active = Object.values(f).some(Boolean);

  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (f.status && t.status !== f.status) return false;
      if (f.category && t.category !== f.category) return false;
      if (f.performedBy && t.performedBy !== f.performedBy) return false;
      if (f.assignee === "none" && t.assigneeId) return false;
      if (f.assignee === "me" && t.assigneeId !== currentUserId) return false;
      if (f.assignee && !["none", "me"].includes(f.assignee) && t.assigneeId !== f.assignee) return false;
      if (q && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tasks, f, currentUserId]);

  return (
    <div className="space-y-4">
      <div role="search" aria-label="Filter tasks" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <label htmlFor="task-q" className="sr-only">
            Search tasks
          </label>
          <Input id="task-q" inputSize="sm" placeholder="Search tasks" className="pl-9" value={f.q} onChange={(e) => set("q", e.target.value)} />
        </div>
        <Select inputSize="sm" aria-label="Status" value={f.status} onChange={(e) => set("status", e.target.value)}>
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select inputSize="sm" aria-label="Type of work" value={f.category} onChange={(e) => set("category", e.target.value)}>
          <option value="">All types</option>
          {TASK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
        <Select inputSize="sm" aria-label="Who does it" value={f.performedBy} onChange={(e) => set("performedBy", e.target.value)}>
          <option value="">Anyone</option>
          {TASK_PERFORMERS.map((p) => (
            <option key={p} value={p}>
              {PERFORMER_LABEL[p]}
            </option>
          ))}
        </Select>
        <Select inputSize="sm" aria-label="Assignee" value={f.assignee} onChange={(e) => set("assignee", e.target.value)}>
          <option value="">All assignees</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center justify-between text-caption text-muted" aria-live="polite">
        <span>
          Showing <span className="tabular-nums">{rows.length}</span> of <span className="tabular-nums">{tasks.length}</span> tasks
        </span>
        {active && (
          <Button variant="ghost" size="xs" icon={<X />} onClick={() => setF(EMPTY)}>
            Clear filters
          </Button>
        )}
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState size="sm" icon={<Search />} title="No tasks match" description="Try a different search or clear the filters." />
        ) : (
          <Table caption="Tasks" stickyHeader maxHeight="40rem">
            <THead>
              <tr>
                <TH>Task</TH>
                <TH>Status</TH>
                <TH>Type</TH>
                <TH>Who</TH>
                <TH>Assignee</TH>
                <TH>Due</TH>
                <TH align="right">Updated</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((t) => (
                <TR key={t.id}>
                  <TD className="min-w-[16rem]">
                    <button
                      type="button"
                      onClick={() => onOpen(t)}
                      className="focus-ring rounded-md text-left font-medium text-fg hover:text-primary hover:underline"
                    >
                      {t.title}
                    </button>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <PriorityBadge priority={t.priority} hideMedium />
                      {!t.clientVisible && <InternalBadge />}
                    </div>
                  </TD>
                  <TD>
                    <TaskStatusBadge status={t.status} />
                  </TD>
                  <TD>
                    <CategoryBadge category={t.category} />
                  </TD>
                  <TD>
                    <PerformerBadge performedBy={t.performedBy} />
                  </TD>
                  <TD>
                    {t.assigneeName ? (
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <Avatar name={t.assigneeName} size="xs" />
                        {t.assigneeName}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </TD>
                  <TD className="whitespace-nowrap">
                    {t.dueAt ? <DueText dueAt={t.dueAt} status={t.status} /> : <span className="text-muted">—</span>}
                  </TD>
                  <TD numeric className="whitespace-nowrap text-muted">
                    {fmtDate(t.updatedAt)}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
