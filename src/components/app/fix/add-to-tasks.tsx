"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ListPlus } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import type { TaskCategory, TaskPriority } from "@/lib/tasks/types";
import { Button, useToast } from "@/components/ui";

/** Adds a problem's fix to the project's Task board (once); shows a link to it afterwards. */
export function AddToTasksButton({
  projectId,
  task,
  existing,
  canEdit,
}: {
  projectId: string;
  task: { title: string; description: string; category: TaskCategory; priority: TaskPriority; links: string[]; todoKey?: string };
  /** Already on the task board (open): don't add twice. */
  existing: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [added, setAdded] = useState(existing);
  const [busy, setBusy] = useState(false);
  const boardHref = `/app/projects/${projectId}/todo`;

  if (added) {
    return (
      <Link
        href={boardHref}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-success/40 bg-success-soft px-4 text-small font-semibold text-success sm:w-auto"
      >
        <CheckCircle2 size={18} aria-hidden /> In your to-do list — open it
      </Link>
    );
  }

  async function add() {
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/tasks`, {
        body: {
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          performedBy: "client",
          evidence: task.links.length || task.todoKey ? { links: task.links.slice(0, 20), ...(task.todoKey ? { todoKey: task.todoKey } : {}) } : null,
        },
      });
      setAdded(true);
      toast("Added to your task list.", "success");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      size="lg"
      icon={<ListPlus />}
      onClick={add}
      loading={busy}
      disabled={!canEdit}
      title={canEdit ? undefined : "Your role can view tasks but not add them"}
      className="w-full sm:w-auto"
    >
      Add to my task list
    </Button>
  );
}
