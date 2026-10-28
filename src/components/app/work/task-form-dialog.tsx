"use client";
import { useEffect, useState } from "react";
import { ClipboardPlus, Link2, Pencil } from "lucide-react";
import { Button, Dialog, Field, Input, Notice, Select, Textarea, fieldDescribedBy } from "@/components/ui";
import {
  CATEGORY_LABEL,
  PERFORMER_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_CATEGORIES,
  TASK_PERFORMERS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type AssigneeOption,
  type TaskCategory,
  type TaskDraft,
  type TaskPerformer,
  type TaskPriority,
  type TaskStatus,
  type TaskView,
} from "@/lib/tasks/types";
import { api } from "./task-meta";

interface FormState {
  title: string;
  description: string;
  category: TaskCategory;
  performedBy: TaskPerformer;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  dueAt: string;
  shippedUrl: string;
  links: string;
  clientVisible: boolean;
}

function initialState(task: TaskView | null, draft: TaskDraft | null, status?: TaskStatus): FormState {
  if (task) {
    return {
      title: task.title,
      description: task.description ?? "",
      category: task.category,
      performedBy: task.performedBy,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId ?? "",
      dueAt: task.dueAt ? task.dueAt.slice(0, 10) : "",
      shippedUrl: task.shippedUrl ?? "",
      links: task.evidence.links.join("\n"),
      clientVisible: task.clientVisible,
    };
  }
  return {
    title: draft?.title ?? "",
    description: draft?.description ?? "",
    category: draft?.category ?? "onsite",
    performedBy: draft?.performedBy ?? "agency",
    status: status ?? "backlog",
    priority: draft?.priority ?? "medium",
    assigneeId: "",
    dueAt: "",
    shippedUrl: draft?.shippedUrl ?? "",
    links: "",
    clientVisible: true,
  };
}

/** Create or edit a task. `task` = edit mode; otherwise create (optionally prefilled from a finding/action draft). */
export function TaskFormDialog({
  open,
  onClose,
  projectId,
  task,
  draft,
  defaultStatus,
  assignees,
  canSeeInternal,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  task: TaskView | null;
  draft: TaskDraft | null;
  defaultStatus?: TaskStatus;
  assignees: AssigneeOption[];
  canSeeInternal: boolean;
  onSaved: (t: TaskView, created: boolean) => void;
}) {
  const [f, setF] = useState<FormState>(() => initialState(task, draft, defaultStatus));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setF(initialState(task, draft, defaultStatus));
      setError(null);
    }
  }, [open, task, draft, defaultStatus]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const links = f.links
    .split(/\s+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const badLink = links.find((l) => !/^https?:\/\/\S+\.\S+/i.test(l));
  const badShipped = f.shippedUrl.trim() && !/^https?:\/\/\S+\.\S+/i.test(f.shippedUrl.trim());

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!f.title.trim()) return setError("Add a short title so everyone knows what this is.");
    if (badShipped) return setError("The shipped URL must start with http:// or https://");
    if (badLink) return setError(`"${badLink}" doesn't look like a web link.`);
    setBusy(true);
    setError(null);
    const body = {
      title: f.title.trim(),
      description: f.description.trim() || null,
      category: f.category,
      performedBy: f.performedBy,
      status: f.status,
      priority: f.priority,
      assigneeId: f.assigneeId || null,
      dueAt: f.dueAt || null,
      shippedUrl: f.shippedUrl.trim() || null,
      evidence: { links },
      ...(canSeeInternal ? { clientVisible: f.clientVisible } : {}),
      ...(!task && draft?.findingId ? { findingId: draft.findingId } : {}),
      ...(!task && draft?.actionId ? { actionId: draft.actionId } : {}),
    };
    try {
      const res = task
        ? await api<{ item: TaskView }>(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify(body) })
        : await api<{ item: TaskView }>(`/api/projects/${projectId}/tasks`, { method: "POST", body: JSON.stringify(body) });
      onSaved(res.item, !task);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the task");
    } finally {
      setBusy(false);
    }
  }

  const id = (k: string) => `task-${k}`;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      icon={task ? <Pencil /> : <ClipboardPlus />}
      title={task ? "Edit task" : "New task"}
      description={task ? "Changes are saved for everyone on this project." : "Add a piece of work to the board."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} loadingText="Saving…" onClick={() => void submit()}>
            {task ? "Save changes" : "Create task"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {!task && (draft?.findingId || draft?.actionId) && (
          <Notice tone="info" icon={<Link2 />} title={draft.findingId ? "Linked to an audit finding" : "Linked to a recommended change"}>
            We filled in the details from it. Adjust anything before creating the task.
          </Notice>
        )}
        {error && (
          <Notice tone="danger" title="Couldn't save">
            {error}
          </Notice>
        )}
        <Field label="Title" htmlFor={id("title")} required>
          <Input id={id("title")} value={f.title} maxLength={200} onChange={(e) => set("title", e.target.value)} required />
        </Field>
        <Field label="Details" htmlFor={id("desc")} optional hint="What needs doing and how we'll know it's done.">
          <Textarea
            id={id("desc")}
            rows={4}
            value={f.description}
            maxLength={5000}
            onChange={(e) => set("description", e.target.value)}
            aria-describedby={fieldDescribedBy(id("desc"), { hint: true })}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Type of work" htmlFor={id("cat")}>
            <Select id={id("cat")} value={f.category} onChange={(e) => set("category", e.target.value as TaskCategory)}>
              {TASK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Who does it" htmlFor={id("who")}>
            <Select id={id("who")} value={f.performedBy} onChange={(e) => set("performedBy", e.target.value as TaskPerformer)}>
              {TASK_PERFORMERS.map((p) => (
                <option key={p} value={p}>
                  {PERFORMER_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor={id("status")}>
            <Select id={id("status")} value={f.status} onChange={(e) => set("status", e.target.value as TaskStatus)}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor={id("prio")}>
            <Select id={id("prio")} value={f.priority} onChange={(e) => set("priority", e.target.value as TaskPriority)}>
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assignee" htmlFor={id("assignee")} optional>
            <Select id={id("assignee")} value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
              <option value="">Unassigned</option>
              {assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due date" htmlFor={id("due")} optional>
            <Input id={id("due")} type="date" value={f.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
          </Field>
        </div>
        <Field label="Shipped URL" htmlFor={id("url")} optional hint="The live page where this work can be seen.">
          <Input
            id={id("url")}
            type="url"
            inputMode="url"
            placeholder="https://"
            value={f.shippedUrl}
            invalid={!!badShipped}
            onChange={(e) => set("shippedUrl", e.target.value)}
            aria-describedby={fieldDescribedBy(id("url"), { hint: true })}
          />
        </Field>
        <Field label="Evidence links" htmlFor={id("links")} optional hint="One link per line: screenshots, docs, published posts, listings.">
          <Textarea
            id={id("links")}
            rows={3}
            value={f.links}
            invalid={!!badLink}
            onChange={(e) => set("links", e.target.value)}
            aria-describedby={fieldDescribedBy(id("links"), { hint: true })}
            className="font-mono text-small"
          />
        </Field>
        {canSeeInternal && (
          <label className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3 text-small text-fg">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={f.clientVisible}
              onChange={(e) => set("clientVisible", e.target.checked)}
            />
            <span>
              <span className="font-medium">Visible to the client</span>
              <span className="block text-muted">
                Untick for internal team work. Internal tasks never appear in the client&apos;s work log or monthly report.
              </span>
            </span>
          </label>
        )}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
