"use client";
import clsx from "clsx";
import { Bot, Building2, EyeOff, User } from "lucide-react";
import { Badge, type Tone } from "@/components/ui";
import {
  CATEGORY_LABEL,
  PERFORMER_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  type TaskCategory,
  type TaskPerformer,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks/types";

export const STATUS_TONE: Record<TaskStatus, Tone> = {
  backlog: "neutral",
  in_progress: "primary",
  client_review: "warning",
  done: "success",
  blocked: "danger",
  cancelled: "neutral",
};

/** Accent stripe colour for board columns (token classes only). */
export const STATUS_DOT: Record<TaskStatus, string> = {
  backlog: "bg-muted",
  in_progress: "bg-primary",
  client_review: "bg-warning",
  done: "bg-success",
  blocked: "bg-danger",
  cancelled: "bg-border-strong",
};

const PRIORITY_TONE: Record<TaskPriority, Tone> = { high: "danger", medium: "info", low: "neutral" };

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} variant="dot">
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: TaskCategory | string }) {
  return <Badge tone="neutral">{CATEGORY_LABEL[category as TaskCategory] ?? category}</Badge>;
}

export function PriorityBadge({ priority, hideMedium }: { priority: TaskPriority; hideMedium?: boolean }) {
  if (hideMedium && priority === "medium") return null;
  return (
    <Badge tone={PRIORITY_TONE[priority]} variant="outline">
      {PRIORITY_LABEL[priority]} priority
    </Badge>
  );
}

export function PerformerBadge({ performedBy }: { performedBy: TaskPerformer }) {
  const Icon = performedBy === "agency" ? Building2 : performedBy === "client" ? User : Bot;
  const tone: Tone = performedBy === "agency" ? "primary" : performedBy === "client" ? "accent" : "info";
  return (
    <Badge tone={tone} icon={<Icon />}>
      {PERFORMER_LABEL[performedBy]}
    </Badge>
  );
}

export function InternalBadge() {
  return (
    <Badge tone="warning" icon={<EyeOff />} title="Only visible to admins and our team">
      Internal
    </Badge>
  );
}

export function isOverdue(t: { dueAt: string | null; status: TaskStatus }): boolean {
  return !!t.dueAt && !["done", "cancelled"].includes(t.status) && new Date(t.dueAt).getTime() < Date.now() - 86_400_000;
}

export function DueText({ dueAt, status, className }: { dueAt: string | null; status: TaskStatus; className?: string }) {
  if (!dueAt) return null;
  const overdue = isOverdue({ dueAt, status });
  const d = new Date(dueAt);
  const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <span className={clsx("tabular-nums", overdue ? "font-medium text-danger" : "text-muted", className)}>
      {overdue ? `Overdue · ${label}` : `Due ${label}`}
    </span>
  );
}

/** Small fetch wrapper: JSON in/out, throws Error with the API's message. */
export async function api<T>(url: string, init?: RequestInit & { body?: string }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; details?: unknown } };
  if (!res.ok) {
    const fieldErrors = (data.error?.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
    const first = fieldErrors ? Object.entries(fieldErrors).find(([, v]) => v?.length) : undefined;
    throw new Error(first ? `${first[0]}: ${first[1][0]}` : (data.error?.message ?? "Something went wrong"));
  }
  return data as T;
}
