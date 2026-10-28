"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  CheckCircle2, ChevronDown, ExternalLink, FileText, Hand, History, Inbox, Lock, Pencil, Play, RotateCcw, XCircle,
} from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { fmtDate } from "@/lib/dashboard/format";
import {
  Badge, Button, Card, Dialog, EmptyState, Field, Meter, Notice, RiskBadge, StatusBadge, TabPanel, Tabs, Textarea, useToast,
} from "@/components/ui";
import { DiffView, fieldLabel } from "./diff-view";
import { CopyBlock } from "./actions/copy-block";
import { ActionTimeline, buildTimeline, type ApprovalEvent, type ExecutionEvent } from "./actions/action-timeline";
import { PRIORITY_TONE, actionSummary, actionTitle, policyInPlainWords } from "./actions/action-copy";
import { findingCopy } from "./audit/finding-copy";

export interface ActionView {
  id: string;
  type: string;
  status: string;
  targetUrl: string | null;
  rationale: string;
  riskClass: string;
  policyDecision: string;
  policyReason: string | null;
  priority: string;
  priorityScore: number;
  expectedImpact: string | null;
  effort: string;
  confidence: number;
  evidenceRefs: unknown[];
  change: { field: string; before: string | null; after: string } | null;
  /** Hash of exactly the draft shown on screen — approvals are bound to it. */
  draftHash: string;
  integrationId: string | null;
  /** Copy-ready steps when the change can't be applied automatically (same text as GET /api/actions/[id]). */
  manualInstructions: string | null;
  approval: { decision: string; expiresAt: string; comments: string | null } | null;
  execution: { result: string; validation: string | null; rollbackStatus: string | null; finishedAt: string | null } | null;
  approvals: ApprovalEvent[];
  executions: ExecutionEvent[];
  createdAt: string;
  updatedAt: string;
}

const TABS = [
  { id: "awaiting", label: "Needs approval", statuses: ["awaiting_approval"], empty: "Nothing is waiting for your approval right now." },
  { id: "ready", label: "Ready", statuses: ["proposed", "approved"], empty: "No suggestions are waiting to be applied." },
  { id: "running", label: "In progress", statuses: ["executing", "rollback_pending"], empty: "Nothing is being applied at the moment." },
  { id: "done", label: "Done", statuses: ["succeeded", "succeeded_with_warnings"], empty: "Applied changes will show up here." },
  { id: "manual", label: "Do by hand", statuses: ["blocked"], empty: "No changes need to be done by hand." },
  {
    id: "closed",
    label: "Not applied",
    statuses: ["failed", "rolled_back", "rollback_failed", "rejected", "expired", "cancelled"],
    empty: "Rejected, failed and undone changes will show up here.",
  },
];

const EDITABLE = ["proposed", "awaiting_approval", "approved", "rejected", "expired", "blocked", "failed"];
const ADVISORY_FIELDS = ["brief"];

export function ActionCenter({
  projectId,
  actions,
  canEdit,
  canApprove,
}: {
  projectId: string;
  actions: ActionView[];
  canEdit: boolean;
  canApprove: boolean;
}) {
  const initial = TABS.find((t) => actions.some((a) => t.statuses.includes(a.status)))?.id ?? "awaiting";
  const [tab, setTab] = useState(initial);
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  const shown = actions.filter((a) => current.statuses.includes(a.status));

  if (actions.length === 0) {
    return (
      <EmptyState
        bordered
        size="lg"
        icon={<Inbox />}
        title="No recommendations yet"
        description="Run an audit and an AI visibility check from the project overview. We'll turn what we find into suggested fixes here."
        action={
          <Link href={`/app/projects/${projectId}/audit`} className="text-small font-medium text-primary hover:underline">
            Go to the audit
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <Tabs
        label="Actions by status"
        idPrefix="ac"
        value={tab}
        onChange={setTab}
        tabs={TABS.map((t) => ({ id: t.id, label: t.label, count: actions.filter((a) => t.statuses.includes(a.status)).length }))}
      />
      <TabPanel idPrefix="ac" value={tab}>
        {shown.length === 0 ? (
          <EmptyState bordered icon={<Inbox />} title={`Nothing in “${current.label}”`} description={current.empty} />
        ) : (
          <ul className="space-y-5">
            {shown.map((a) => (
              <li key={a.id}>
                <ActionCard projectId={projectId} action={a} canEdit={canEdit} canApprove={canApprove} />
              </li>
            ))}
          </ul>
        )}
      </TabPanel>
    </div>
  );
}

function evidenceLink(e: unknown, projectId: string): { label: string; href: string | null } {
  if (typeof e === "string") return { label: e, href: /^https?:\/\//.test(e) ? e : null };
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const kind = String(o.kind ?? o.type ?? "");
    if (kind === "finding") {
      const code = typeof o.code === "string" ? o.code : "";
      return { label: `Audit finding: ${findingCopy(code, code.replace(/_/g, " ")).title}`, href: `/app/projects/${projectId}/audit` };
    }
    if (kind === "visibility_run") return { label: "AI visibility check results", href: `/app/projects/${projectId}/visibility` };
    if (kind === "prompt") return { label: "Tracked AI question", href: `/app/projects/${projectId}/prompts` };
    const url = typeof o.url === "string" ? o.url : typeof o.pageUrl === "string" ? o.pageUrl : null;
    if (url) return { label: url, href: url };
    return { label: [kind, o.code ?? o.id].filter(Boolean).join(" · ") || "Evidence", href: null };
  }
  return { label: String(e), href: null };
}

function Disclosure({ icon, label, count, children }: { icon: React.ReactNode; label: string; count?: number; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-border">
      <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 rounded-xl px-3 py-2.5 text-small font-medium text-fg-soft hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-muted [&_svg]:size-4">{icon}</span>
        {label}
        {count !== undefined && <span className="rounded-full bg-surface-2 px-1.5 text-xs tabular-nums leading-5 text-muted">{count}</span>}
        <ChevronDown aria-hidden className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border px-3 py-3">{children}</div>
    </details>
  );
}

function ActionCard({ projectId, action: a, canEdit, canApprove }: { projectId: string; action: ActionView; canEdit: boolean; canApprove: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "approve" | "reject" | "edit" | "execute" | "rollback">(null);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [draft, setDraft] = useState(a.change?.after ?? "");
  const [editError, setEditError] = useState<string | null>(null);

  const close = () => setDialog(null);

  async function run(kind: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(kind);
    try {
      await fn();
      toast(ok, "success");
      setDialog(null);
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  const approve = () =>
    run(
      "approve",
      () => api(`/api/actions/${a.id}/approve`, { body: { draftHash: a.draftHash, comments: comment.trim() || undefined } }),
      "Approved. The approval is locked to this exact text.",
    );
  const reject = () =>
    run("reject", () => api(`/api/actions/${a.id}/reject`, { body: { reason: reason.trim() || undefined } }), "Rejected. Nothing on your site was changed.");
  const execute = () => run("execute", () => api(`/api/actions/${a.id}/execute`, { body: {} }), "Applying the change now. We'll re-check the page when it's done.");
  const rollback = () => run("rollback", () => api(`/api/actions/${a.id}/rollback`, { body: {} }), "Undo started. We'll restore the previous version.");

  async function saveDraft() {
    if (!draft.trim()) {
      setEditError("The new text can't be empty.");
      return;
    }
    setBusy("edit");
    setEditError(null);
    try {
      await api(`/api/actions/${a.id}`, { method: "PATCH", body: { after: draft } });
      toast("Draft saved. It now needs a fresh approval.", "success");
      setDialog(null);
      router.refresh();
    } catch (e) {
      setEditError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const canRollback =
    ["succeeded", "succeeded_with_warnings", "failed", "rollback_failed"].includes(a.status) &&
    !!a.execution &&
    a.execution.rollbackStatus !== "rolled_back" &&
    a.execution.rollbackStatus !== "pending" &&
    !!a.integrationId;
  const canExecute =
    !!a.integrationId &&
    (a.status === "approved" || (a.policyDecision === "auto_execute" && ["proposed", "failed"].includes(a.status)));
  const locked = a.status === "awaiting_approval" || a.status === "approved";
  const advisory = !!a.change && ADVISORY_FIELDS.includes(a.change.field);
  const timeline = buildTimeline(a.createdAt, a.approvals, a.executions);
  const summary = actionSummary(a.type);
  const showEdit = canEdit && !!a.change && EDITABLE.includes(a.status);
  const showApprove = canApprove && a.status === "awaiting_approval";
  const hasButtons = showEdit || showApprove || (canEdit && canExecute) || (canApprove && canRollback);

  return (
    <Card as="article" className="overflow-hidden" aria-labelledby={`act-${a.id}-title`}>
      {/* Header */}
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={a.status} />
              <Badge tone={PRIORITY_TONE[a.priority] ?? "neutral"} className="capitalize">
                {a.priority} priority
              </Badge>
              {!a.integrationId && a.change && !advisory && <Badge icon={<Hand />}>Apply by hand</Badge>}
            </div>
            <h3 id={`act-${a.id}-title`} className="text-h4 text-fg">
              {actionTitle(a.type)}
            </h3>
            {summary && <p className="mt-0.5 text-small text-muted">{summary}</p>}
          </div>
          <span className="text-caption text-muted">Updated {fmtDate(a.updatedAt, true)}</span>
        </div>
        {a.targetUrl && (
          <a
            href={a.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex max-w-full items-center gap-1 text-small text-primary hover:underline"
          >
            <span className="truncate">{a.targetUrl}</span>
            <ExternalLink aria-hidden className="size-3.5 shrink-0" />
            <span className="sr-only">(opens in new tab)</span>
          </a>
        )}
      </div>

      {/* Body */}
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div>
          <h4 className="mb-1 text-caption uppercase tracking-[0.06em] text-muted">Why we suggest this</h4>
          <p className="text-body text-fg-soft">{a.rationale}</p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3 sm:flex-row sm:items-start sm:gap-3">
          <RiskBadge riskClass={a.riskClass} className="shrink-0 self-start" />
          <div className="min-w-0">
            <p className="text-small text-fg-soft">{policyInPlainWords(a.policyDecision, a.riskClass, a.policyReason)}</p>
            {a.policyReason && (
              <details className="mt-1 text-caption text-muted">
                <summary className="cursor-pointer font-normal hover:text-fg">Technical reason</summary>
                <p className="mt-1 break-words font-normal">{a.policyReason}</p>
              </details>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div>
            <dt className="text-caption uppercase tracking-[0.06em] text-muted">Priority</dt>
            <dd className="mt-1 text-small font-medium capitalize text-fg">
              {a.priority}
              <span className="ml-1 font-normal text-muted tabular-nums">· score {Math.round(a.priorityScore)}</span>
            </dd>
          </div>
          <div>
            <dt className="text-caption uppercase tracking-[0.06em] text-muted">Expected impact</dt>
            <dd className="mt-1 text-small text-fg">{a.expectedImpact ?? "Not estimated"}</dd>
          </div>
          <div>
            <dt className="text-caption uppercase tracking-[0.06em] text-muted">How sure we are</dt>
            <dd className="mt-1">
              <Meter value={Math.round(a.confidence * 100)} max={100} label="Confidence" tone="primary" size="xs" />
              <span className="mt-1 block text-small tabular-nums text-fg">{Math.round(a.confidence * 100)}%</span>
            </dd>
          </div>
          <div>
            <dt className="text-caption uppercase tracking-[0.06em] text-muted">Effort</dt>
            <dd className="mt-1 text-small capitalize text-fg">{a.effort}</dd>
          </div>
        </dl>

        {a.change ? (
          advisory ? (
            <CopyBlock label={fieldLabel(a.change.field)} text={a.change.after} />
          ) : (
            <DiffView field={a.change.field} before={a.change.before} after={a.change.after} />
          )
        ) : (
          <p className="rounded-xl border border-dashed border-border-strong px-4 py-3 text-small text-muted">
            This is advice for your team — there’s no text to change on your site.
          </p>
        )}

        {locked && a.change && (
          <Notice tone="neutral" icon={<Lock />} title="Approval is locked to this exact text — editing it needs a new approval.">
            <span className="text-caption">
              Draft fingerprint <code className="font-mono">{a.draftHash.slice(0, 12)}</code>
              {a.approval?.decision === "pending" && ` · request expires ${fmtDate(a.approval.expiresAt, true)}`}
            </span>
          </Notice>
        )}

        {a.manualInstructions && (
          <Notice tone="tip" icon={<Hand />} title="Apply this change by hand">
            <p className="mb-3">
              We can’t make this change automatically
              {a.integrationId ? "" : " because no website is connected"}. Copy the steps below into your website editor, then run a new audit
              so we can confirm it worked.
            </p>
            <CopyBlock label="Step-by-step instructions" text={a.manualInstructions} />
          </Notice>
        )}

        {a.approval?.decision === "rejected" && a.approval.comments && (
          <p className="text-small text-muted">
            <span className="font-medium text-fg">Rejected because:</span> {a.approval.comments}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Disclosure icon={<FileText />} label="Evidence" count={a.evidenceRefs.length}>
            {a.evidenceRefs.length === 0 ? (
              <p className="text-small text-muted">No linked evidence.</p>
            ) : (
              <ul className="space-y-1.5 text-small">
                {a.evidenceRefs.slice(0, 10).map((e, i) => {
                  const { label, href } = evidenceLink(e, projectId);
                  return (
                    <li key={i} className="break-words">
                      {href ? (
                        /^https?:/.test(href) ? (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {label}
                          </a>
                        ) : (
                          <Link href={href} className="text-primary hover:underline">
                            {label}
                          </Link>
                        )
                      ) : (
                        <span className="text-fg-soft">{label}</span>
                      )}
                    </li>
                  );
                })}
                {a.evidenceRefs.length > 10 && <li className="text-muted">+{a.evidenceRefs.length - 10} more</li>}
              </ul>
            )}
          </Disclosure>
          <Disclosure icon={<History />} label="History" count={timeline.length}>
            <ActionTimeline items={timeline} />
          </Disclosure>
        </div>
      </div>

      {/* Footer */}
      {hasButtons && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-2/50 px-5 py-3 sm:px-6">
          {showEdit && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Pencil />}
              onClick={() => {
                setDraft(a.change!.after);
                setEditError(null);
                setDialog("edit");
              }}
            >
              Edit draft
            </Button>
          )}
          {canApprove && canRollback && (
            <Button variant="secondary" size="sm" icon={<RotateCcw />} onClick={() => setDialog("rollback")}>
              Roll back
            </Button>
          )}
          {showApprove && (
            <>
              <Button variant="secondary" size="sm" icon={<XCircle />} onClick={() => setDialog("reject")}>
                Reject
              </Button>
              <Button variant="accent" size="sm" icon={<CheckCircle2 />} onClick={() => setDialog("approve")}>
                Approve
              </Button>
            </>
          )}
          {canEdit && canExecute && (
            <Button size="sm" icon={<Play />} onClick={() => setDialog("execute")}>
              Apply change
            </Button>
          )}
        </div>
      )}

      {/* Dialogs */}
      <Dialog
        open={dialog === "approve"}
        onClose={close}
        size="lg"
        icon={<CheckCircle2 />}
        title="Approve this exact text?"
        description="Your approval is locked to the text below. If anyone edits it later, it will need a new approval before it can go live."
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button variant="accent" loading={busy === "approve"} loadingText="Approving…" onClick={approve}>
              Approve
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {a.change && (advisory ? <CopyBlock label={fieldLabel(a.change.field)} text={a.change.after} maxHeight="12rem" /> : <DiffView field={a.change.field} before={a.change.before} after={a.change.after} />)}
          <Field label="Note for your team" htmlFor={`apc-${a.id}`} optional>
            <Textarea id={`apc-${a.id}`} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "reject"}
        onClose={close}
        icon={<XCircle />}
        tone="danger"
        title="Reject this change?"
        description="Nothing will change on your site. Adding a reason helps your team and improves future suggestions."
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button variant="danger" loading={busy === "reject"} loadingText="Rejecting…" onClick={reject}>
              Reject
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor={`rej-${a.id}`} optional>
          <Textarea id={`rej-${a.id}`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} placeholder="e.g. Doesn't match our tone of voice" />
        </Field>
      </Dialog>

      <Dialog
        open={dialog === "execute"}
        onClose={close}
        icon={<Play />}
        tone="warning"
        title="Apply this change to your website?"
        description={
          <>
            We’ll save the current version first, publish the new text{a.targetUrl ? <> on <span className="break-all font-medium text-fg">{a.targetUrl}</span></> : null}, then re-check the page. You can roll it back afterwards.
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button loading={busy === "execute"} loadingText="Starting…" onClick={execute}>
              Apply change
            </Button>
          </>
        }
      />

      <Dialog
        open={dialog === "rollback"}
        onClose={close}
        icon={<RotateCcw />}
        tone="warning"
        title="Roll back this change?"
        description="We'll restore the version that was live before this change was applied."
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button variant="danger" loading={busy === "rollback"} loadingText="Starting…" onClick={rollback}>
              Roll back
            </Button>
          </>
        }
      />

      <Dialog
        open={dialog === "edit"}
        onClose={close}
        size="xl"
        icon={<Pencil />}
        title="Edit draft"
        description="Approval is locked to this exact text — editing it needs a new approval. Saving also re-checks the change against your safety rules."
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button loading={busy === "edit"} loadingText="Saving…" onClick={saveDraft} disabled={!!a.change && draft === a.change.after}>
              Save new draft
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={`New ${fieldLabel(a.change?.field ?? "text").toLowerCase()}`} htmlFor={`edit-${a.id}`} error={editError} hint={`${draft.length} characters`}>
            <Textarea
              id={`edit-${a.id}`}
              rows={advisory ? 12 : 5}
              value={draft}
              invalid={!!editError}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={20000}
              className={clsx(advisory && "font-mono text-xs")}
            />
          </Field>
          {a.change && draft !== a.change.after && !advisory && (
            <DiffView field={a.change.field} before={a.change.before} after={draft} />
          )}
        </div>
      </Dialog>
    </Card>
  );
}
