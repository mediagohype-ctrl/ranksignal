import clsx from "clsx";
import { CheckCircle2, CircleDot, Clock, Lightbulb, Play, RotateCcw, XCircle } from "lucide-react";
import { fmtDate } from "@/lib/dashboard/format";
import { approvalLabel, executionLabel, rollbackLabel, validationLabel } from "./action-copy";

export interface ApprovalEvent {
  id: string;
  decision: string;
  draftHash: string;
  comments: string | null;
  requestedBy: string | null;
  approver: string | null;
  createdAt: string;
  decidedAt: string | null;
  expiresAt: string;
}

export interface ExecutionEvent {
  id: string;
  connector: string;
  result: string;
  validation: string | null;
  rollbackStatus: string | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

type Tone = "neutral" | "success" | "danger" | "warning" | "info";
export interface TimelineItem {
  key: string;
  at: string;
  title: string;
  detail?: string | null;
  tone: Tone;
  icon: React.ReactNode;
}

const TONE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
};

const connectorName = (c: string) => (c === "wordpress" ? "WordPress" : c === "manual" ? "manual export" : c);

export function buildTimeline(createdAt: string, approvals: ApprovalEvent[], executions: ExecutionEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [{ key: "created", at: createdAt, title: "Suggested by our analysis", tone: "neutral", icon: <Lightbulb /> }];
  for (const a of approvals) {
    items.push({
      key: `${a.id}-req`,
      at: a.createdAt,
      title: "Approval requested",
      detail: [a.requestedBy && `by ${a.requestedBy}`, `draft ${a.draftHash.slice(0, 8)}`].filter(Boolean).join(" · "),
      tone: "info",
      icon: <Clock />,
    });
    if (a.decision !== "pending" && (a.decidedAt || a.decision === "expired")) {
      items.push({
        key: `${a.id}-dec`,
        at: a.decidedAt ?? a.expiresAt,
        title: approvalLabel(a.decision),
        detail: [a.approver && `by ${a.approver}`, a.comments && `“${a.comments}”`].filter(Boolean).join(" · ") || null,
        tone: a.decision === "approved" ? "success" : a.decision === "rejected" ? "danger" : "neutral",
        icon: a.decision === "approved" ? <CheckCircle2 /> : a.decision === "rejected" ? <XCircle /> : <CircleDot />,
      });
    }
  }
  for (const e of executions) {
    items.push({ key: `${e.id}-start`, at: e.startedAt, title: `Started applying via ${connectorName(e.connector)}`, tone: "info", icon: <Play /> });
    if (e.finishedAt || e.result !== "pending") {
      const v = validationLabel(e.validation);
      items.push({
        key: `${e.id}-end`,
        at: e.finishedAt ?? e.startedAt,
        title: executionLabel(e.result),
        detail: [v && `${v[0].toUpperCase()}${v.slice(1)}`, e.error].filter(Boolean).join(" · ") || null,
        tone: e.result === "success" ? (e.validation === "warning" ? "warning" : "success") : e.result === "partial" ? "warning" : e.result === "failure" ? "danger" : "info",
        icon: e.result === "success" ? <CheckCircle2 /> : e.result === "failure" ? <XCircle /> : <CircleDot />,
      });
    }
    const rb = rollbackLabel(e.rollbackStatus);
    if (rb) {
      items.push({
        key: `${e.id}-rb`,
        at: e.finishedAt ?? e.startedAt,
        title: rb,
        tone: e.rollbackStatus === "rolled_back" ? "neutral" : e.rollbackStatus === "pending" ? "info" : "danger",
        icon: <RotateCcw />,
      });
    }
  }
  return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** Vertical history of approvals and executions for one action, oldest first. */
export function ActionTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-4">
      {items.map((it, i) => (
        <li key={it.key} className="relative flex gap-3">
          {i < items.length - 1 && <span aria-hidden className="absolute left-3.5 top-8 -bottom-4 w-px bg-border" />}
          <span aria-hidden className={clsx("relative flex size-7 shrink-0 items-center justify-center rounded-full [&_svg]:size-3.5", TONE[it.tone])}>
            {it.icon}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-small font-medium text-fg">{it.title}</p>
            <p className="text-caption text-muted">
              <time dateTime={it.at}>{fmtDate(it.at, true)}</time>
              {it.detail && <span className="break-words"> · {it.detail}</span>}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
