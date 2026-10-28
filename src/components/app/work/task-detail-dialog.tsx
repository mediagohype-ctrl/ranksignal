"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ExternalLink, History, Lock, MessageSquare, Paperclip, Pencil, Send, Trash2 } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  Divider,
  KeyValueList,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "@/components/ui";
import { fmtDate, hostOf } from "@/lib/dashboard/format";
import {
  STATUS_LABEL,
  TASK_STATUSES,
  type TaskCommentView,
  type TaskHistoryEntry,
  type TaskStatus,
  type TaskView,
} from "@/lib/tasks/types";
import { CategoryBadge, DueText, InternalBadge, PerformerBadge, PriorityBadge, TaskStatusBadge, api } from "./task-meta";

export interface WorkPermissions {
  canEdit: boolean;
  canSeeInternal: boolean;
  canDelete: boolean;
  staffMode: boolean;
}

function SectionTitle({ icon, children, count }: { icon: React.ReactNode; children: React.ReactNode; count?: number }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-caption uppercase tracking-[0.06em] text-muted [&_svg]:size-3.5">
      <span aria-hidden>{icon}</span>
      {children}
      {count !== undefined && <span className="tabular-nums">({count})</span>}
    </h3>
  );
}

export function TaskDetailDialog({
  task,
  projectId,
  perms,
  onClose,
  onChanged,
  onDeleted,
  onEdit,
}: {
  task: TaskView | null;
  projectId: string;
  perms: WorkPermissions;
  onClose: () => void;
  onChanged: (t: TaskView) => void;
  onDeleted: (id: string) => void;
  onEdit: (t: TaskView) => void;
}) {
  const toast = useToast();
  const [comments, setComments] = useState<TaskCommentView[] | null>(null);
  const [history, setHistory] = useState<TaskHistoryEntry[] | null>(null);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const taskId = task?.id ?? null;

  const load = useCallback(async (id: string) => {
    try {
      const [c, h] = await Promise.all([
        api<{ items: TaskCommentView[] }>(`/api/tasks/${id}/comments`),
        api<{ history: TaskHistoryEntry[] }>(`/api/tasks/${id}`),
      ]);
      setComments(c.items);
      setHistory(h.history);
    } catch {
      setComments([]);
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    setComments(null);
    setHistory(null);
    setBody("");
    setInternal(false);
    setConfirmDelete(false);
    if (taskId) void load(taskId);
  }, [taskId, load]);

  if (!task) return null;

  async function move(status: TaskStatus) {
    if (!task || status === task.status) return;
    setMoving(true);
    try {
      const res = await api<{ item: TaskView }>(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      onChanged(res.item);
      toast(`Moved to ${STATUS_LABEL[status]}`, "success");
      void load(task.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't move the task", "error");
    } finally {
      setMoving(false);
    }
  }

  async function post(e?: { preventDefault: () => void }) {
    e?.preventDefault();
    if (!task || !body.trim()) return;
    setPosting(true);
    try {
      const res = await api<{ item: TaskCommentView }>(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: body.trim(), internal: perms.canSeeInternal && internal }),
      });
      setComments((c) => [...(c ?? []), res.item]);
      setBody("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't post the comment", "error");
    } finally {
      setPosting(false);
    }
  }

  async function remove() {
    if (!task) return;
    setDeleting(true);
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      toast("Task deleted", "success");
      onDeleted(task.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete the task", "error");
    } finally {
      setDeleting(false);
    }
  }

  const details = [
    { label: "Who does it", value: <PerformerBadge performedBy={task.performedBy} /> },
    { label: "Assignee", value: task.assigneeName ? <span className="inline-flex items-center gap-2"><Avatar name={task.assigneeName} size="xs" />{task.assigneeName}</span> : <span className="text-muted">Unassigned</span> },
    { label: "Due", value: task.dueAt ? <DueText dueAt={task.dueAt} status={task.status} /> : <span className="text-muted">No date</span> },
    ...(task.completedAt ? [{ label: "Completed", value: fmtDate(task.completedAt) }] : []),
    ...(task.shippedUrl
      ? [{
          label: "Shipped at",
          value: (
            <a href={task.shippedUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all font-medium text-primary hover:underline">
              {hostOf(task.shippedUrl)}{(() => { try { const p = new URL(task.shippedUrl).pathname; return p === "/" ? "" : p; } catch { return ""; } })()}
              <ExternalLink size={13} aria-hidden />
            </a>
          ),
        }]
      : []),
    ...(task.findingId ? [{ label: "From", value: <Link href={`/app/projects/${projectId}/audit`} className="font-medium text-primary hover:underline">Audit finding</Link> }] : []),
    ...(task.actionId ? [{ label: "From", value: <Link href={`/app/projects/${projectId}/actions`} className="font-medium text-primary hover:underline">Recommended change</Link> }] : []),
  ];

  return (
    <Dialog
      open={!!task}
      onClose={onClose}
      size="xl"
      title={task.title}
      description={
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <TaskStatusBadge status={task.status} />
          <CategoryBadge category={task.category} />
          <PriorityBadge priority={task.priority} />
          {!task.clientVisible && <InternalBadge />}
        </span>
      }
      footer={
        confirmDelete ? (
          <>
            <span className="mr-auto self-center text-small text-fg">Delete this task and its comments? This can&apos;t be undone.</span>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button variant="danger" loading={deleting} loadingText="Deleting…" onClick={() => void remove()}>
              Delete task
            </Button>
          </>
        ) : (
          <>
            {perms.canDelete && (
              <Button variant="ghost" icon={<Trash2 />} className="mr-auto text-danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
            {perms.canEdit && (
              <Button variant="secondary" icon={<Pencil />} onClick={() => onEdit(task)}>
                Edit details
              </Button>
            )}
            <Button onClick={onClose}>Done</Button>
          </>
        )
      }
    >
      <div className="grid gap-6 pb-2 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-6">
          {task.description ? (
            <p className="whitespace-pre-wrap text-body text-fg-soft">{task.description}</p>
          ) : (
            <p className="text-muted">No details added yet.</p>
          )}

          {task.evidence.links.length > 0 && (
            <section aria-label="Evidence">
              <SectionTitle icon={<Paperclip />} count={task.evidence.links.length}>
                Evidence
              </SectionTitle>
              <ul className="space-y-1.5">
                {task.evidence.links.map((l) => (
                  <li key={l}>
                    <a
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-small text-primary hover:underline"
                    >
                      <ExternalLink size={13} aria-hidden className="shrink-0" />
                      <span className="truncate">{l.replace(/^https?:\/\//, "")}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="Comments">
            <SectionTitle icon={<MessageSquare />} count={comments?.length}>
              Comments
            </SectionTitle>
            {comments === null ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-3/4" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-muted">No comments yet. Questions and updates about this task go here.</p>
            ) : (
              <ol className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <Avatar name={c.authorName} size="sm" />
                    <div
                      className={clsx(
                        "min-w-0 flex-1 rounded-xl px-3.5 py-2.5",
                        c.internal ? "border border-dashed border-warning/50 bg-warning-soft" : "bg-surface-2",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption">
                        <span className="font-semibold text-fg">{c.authorName}</span>
                        <time className="text-muted" dateTime={c.createdAt}>
                          {fmtDate(c.createdAt, true)}
                        </time>
                        {c.internal && (
                          <Badge tone="warning" size="sm" icon={<Lock />}>
                            Internal note
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-small text-fg">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {perms.canEdit && (
              <form onSubmit={(e) => void post(e)} className="mt-4 space-y-2">
                <label htmlFor="task-comment" className="sr-only">
                  Add a comment
                </label>
                <Textarea
                  id="task-comment"
                  rows={3}
                  maxLength={5000}
                  placeholder={internal ? "Internal note: only admins and our team will see this" : "Write a comment…"}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void post();
                    }
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {perms.canSeeInternal ? (
                    <label className="flex items-center gap-2 text-small text-fg-soft">
                      <input type="checkbox" className="size-4 accent-primary" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
                      <Lock size={14} aria-hidden className="text-muted" />
                      Internal note (hidden from client viewers)
                    </label>
                  ) : (
                    <span />
                  )}
                  <Button type="submit" size="sm" icon={<Send />} loading={posting} disabled={!body.trim()}>
                    {internal ? "Add note" : "Comment"}
                  </Button>
                </div>
              </form>
            )}
          </section>
        </div>

        <aside className="space-y-5 lg:border-l lg:border-border lg:pl-6">
          {perms.canEdit && (
            <div className="space-y-1.5">
              <label htmlFor="task-detail-status" className="text-caption uppercase tracking-[0.06em] text-muted">
                Status
              </label>
              <Select
                id="task-detail-status"
                inputSize="sm"
                value={task.status}
                disabled={moving}
                onChange={(e) => void move(e.target.value as TaskStatus)}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <KeyValueList layout="stacked" items={details} />
          <Divider />
          <section aria-label="Status history">
            <SectionTitle icon={<History />}>History</SectionTitle>
            {history === null ? (
              <Skeleton className="h-16 w-full" />
            ) : history.length === 0 ? (
              <p className="text-small text-muted">Created {fmtDate(task.createdAt)}.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-border pl-4">
                {history.map((h) => (
                  <li key={h.id} className="relative text-small">
                    <span aria-hidden className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-border-strong" />
                    <div className="text-fg">{h.label}</div>
                    <div className="text-caption text-muted">
                      {h.actorName} · <time dateTime={h.createdAt}>{fmtDate(h.createdAt, true)}</time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </Dialog>
  );
}
