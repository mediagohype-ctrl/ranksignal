"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CheckCircle2, ClipboardList, Columns3, KanbanSquare, List, Plus, ShieldCheck } from "lucide-react";
import { Button, EmptyState, Notice, Stat, TabPanel, Tabs, useToast } from "@/components/ui";
import { STATUS_LABEL, type AssigneeOption, type TaskDraft, type TaskStatus, type TaskView } from "@/lib/tasks/types";
import { BoardView } from "./board-view";
import { ListView } from "./list-view";
import { TaskDetailDialog, type WorkPermissions } from "./task-detail-dialog";
import { TaskFormDialog } from "./task-form-dialog";
import { api, isOverdue } from "./task-meta";
import { WorkLog, type WorkLogMonth } from "./work-log";

type View = "board" | "list" | "log";
const VIEW_KEY = "work.view";

export function WorkClient({
  projectId,
  initialTasks,
  assignees,
  months,
  perms,
  currentUserId,
  prefill,
  prefillError,
}: {
  projectId: string;
  initialTasks: TaskView[];
  assignees: AssigneeOption[];
  months: [WorkLogMonth, WorkLogMonth];
  perms: WorkPermissions;
  currentUserId: string;
  prefill: TaskDraft | null;
  prefillError: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [tasks, setTasks] = useState<TaskView[]>(initialTasks);
  const [view, setView] = useState<View>("board");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; task: TaskView | null; draft: TaskDraft | null; status?: TaskStatus }>({
    open: !!prefill && perms.canEdit,
    task: null,
    draft: prefill,
  });
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => setTasks(initialTasks), [initialTasks]);
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "board" || v === "list" || v === "log") setView(v);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const changeView = (v: string) => {
    setView(v as View);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const detail = useMemo(() => tasks.find((t) => t.id === detailId) ?? null, [tasks, detailId]);
  const upsert = useCallback((t: TaskView) => setTasks((xs) => (xs.some((x) => x.id === t.id) ? xs.map((x) => (x.id === t.id ? t : x)) : [t, ...xs])), []);

  /** Drop ?fromFinding / ?fromAction once the prefilled dialog has been used or dismissed. */
  const clearPrefillParams = useCallback(() => {
    if (prefill || prefillError) router.replace(pathname, { scroll: false });
  }, [prefill, prefillError, router, pathname]);

  async function move(t: TaskView, status: TaskStatus) {
    if (status === t.status) return;
    setMovingId(t.id);
    upsert({ ...t, status }); // optimistic
    try {
      const res = await api<{ item: TaskView }>(`/api/tasks/${t.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      upsert(res.item);
      toast(`Moved to ${STATUS_LABEL[status]}`, "success");
      if (status === "done" || t.status === "done") router.refresh(); // refresh the work log
    } catch (e) {
      upsert(t);
      toast(e instanceof Error ? e.message : "Couldn't move the task", "error");
    } finally {
      setMovingId(null);
    }
  }

  const openCreate = (status?: TaskStatus) => setForm({ open: true, task: null, draft: null, status });
  const closeForm = () => {
    setForm((f) => ({ ...f, open: false }));
    clearPrefillParams();
  };

  const open = tasks.filter((t) => !["done", "cancelled"].includes(t.status));
  const stats = {
    open: open.length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    waiting: tasks.filter((t) => t.status === "client_review").length,
    overdue: open.filter((t) => isOverdue(t)).length,
    shipped: months[0].items.length,
  };
  const empty = tasks.length === 0;

  return (
    <div className="space-y-8">
      {prefillError && (
        <Notice tone="warning" title="Couldn't prefill the task">
          {prefillError}
        </Notice>
      )}
      {perms.staffMode && (
        <Notice tone="info" icon={<ShieldCheck />} title="Staff controls are on">
          You can see internal tasks and notes, delete tasks, and mark work as internal. Clients never see internal items.
        </Notice>
      )}

      {!empty && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Open tasks" value={stats.open} hint={`${stats.inProgress} in progress`} icon={<ClipboardList />} />
          <Stat label="Waiting on you" value={stats.waiting} hint="Needs your review or input" icon={<Columns3 />} />
          <Stat label="Overdue" value={stats.overdue} hint="Past their due date" />
          <Stat label="Shipped this month" value={stats.shipped} hint="Tasks and applied changes" icon={<CheckCircle2 />} />
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            label="Work views"
            idPrefix="work"
            variant="pills"
            value={view}
            onChange={changeView}
            tabs={[
              { id: "board", label: "Board", icon: <KanbanSquare size={15} /> },
              { id: "list", label: "List", icon: <List size={15} />, count: tasks.length },
              { id: "log", label: "Work log", icon: <CheckCircle2 size={15} /> },
            ]}
          />
          {perms.canEdit && (
            <Button icon={<Plus />} onClick={() => openCreate()}>
              New task
            </Button>
          )}
        </div>
        <TabPanel idPrefix="work" value={view}>
          {view === "log" ? (
            <WorkLog months={months} showsInternal={perms.canSeeInternal} onOpenTask={(id) => tasks.some((t) => t.id === id) && setDetailId(id)} />
          ) : empty ? (
            <EmptyState
              bordered
              size="lg"
              icon={<KanbanSquare />}
              title="Your work board is empty"
              description={
                <>
                  This board tracks every piece of work on your site: fixes from the audit, new content, technical changes and
                  off-site work. Each task moves from <strong>To do</strong> to <strong>In progress</strong> to <strong>Done</strong>.
                  Anything waiting on you shows in <strong>Waiting on you</strong>, and finished work appears in the Work log.
                </>
              }
              action={
                perms.canEdit ? (
                  <Button icon={<Plus />} onClick={() => openCreate()}>
                    Add the first task
                  </Button>
                ) : undefined
              }
            />
          ) : view === "board" ? (
            <BoardView
              tasks={tasks}
              canEdit={perms.canEdit}
              movingId={movingId}
              onOpen={(t) => setDetailId(t.id)}
              onMove={(t, s) => void move(t, s)}
              onCreate={(s) => openCreate(s)}
            />
          ) : (
            <ListView tasks={tasks} assignees={assignees} currentUserId={currentUserId} onOpen={(t) => setDetailId(t.id)} />
          )}
        </TabPanel>
      </div>

      <TaskDetailDialog
        task={detail}
        projectId={projectId}
        perms={perms}
        onClose={() => setDetailId(null)}
        onChanged={(t) => {
          upsert(t);
          router.refresh();
        }}
        onDeleted={(id) => {
          setTasks((xs) => xs.filter((x) => x.id !== id));
          setDetailId(null);
          router.refresh();
        }}
        onEdit={(t) => {
          setDetailId(null);
          setForm({ open: true, task: t, draft: null });
        }}
      />

      {perms.canEdit && (
        <TaskFormDialog
          open={form.open}
          onClose={closeForm}
          projectId={projectId}
          task={form.task}
          draft={form.draft}
          defaultStatus={form.status}
          assignees={assignees}
          canSeeInternal={perms.canSeeInternal}
          onSaved={(t, created) => {
            upsert(t);
            setForm({ open: false, task: null, draft: null });
            toast(created ? "Task created" : "Task updated", "success");
            clearPrefillParams();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
