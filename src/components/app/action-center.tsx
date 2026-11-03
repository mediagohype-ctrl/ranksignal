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
  Badge, Button, Card, Dialog, EmptyState, Field, Input, LinkButton, Notice, RiskBadge, StatusBadge, TabPanel, Tabs, Textarea, useToast,
} from "@/components/ui";
import { DiffView, fieldLabel } from "./diff-view";
import { CopyBlock } from "./actions/copy-block";
import { ActionTimeline, buildTimeline, type ApprovalEvent, type ExecutionEvent } from "./actions/action-timeline";
import { PRIORITY_TONE, actionSummary, actionTitle, policyInPlainWords, priorityLabel } from "./actions/action-copy";
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
  { id: "awaiting", label: "Needs your OK", statuses: ["awaiting_approval"], empty: "Nothing is waiting for your OK right now." },
  { id: "ready", label: "Ready", statuses: ["proposed", "approved"], empty: "No fixes are waiting to go live." },
  { id: "running", label: "In progress", statuses: ["executing", "rollback_pending"], empty: "No fixes are going live right now." },
  { id: "done", label: "Done", statuses: ["succeeded", "succeeded_with_warnings", "completed_manually"], empty: "Fixes that are live will show up here." },
  { id: "manual", label: "Do by hand", statuses: ["blocked"], empty: "No fixes need to be done by hand." },
  {
    id: "closed",
    label: "Not done",
    statuses: ["failed", "rolled_back", "rollback_failed", "rejected", "expired", "cancelled"],
    empty: "Fixes you turned down, that failed, or that were undone show up here.",
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
        title="No fixes to approve yet"
        description="Check your website first. We'll turn the problems we find into fixes here."
        action={
          <LinkButton href={`/app/projects/${projectId}/audit`}>Go to website problems</LinkButton>
        }
      />
    );
  }

  return (
    <div>
      <Tabs
        label="Fixes by status"
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
      return { label: `Website problem: ${findingCopy(code, code.replace(/_/g, " ")).title}`, href: `/app/projects/${projectId}/audit` };
    }
    if (kind === "visibility_run") return { label: "AI check results", href: `/app/projects/${projectId}/visibility` };
    if (kind === "prompt") return { label: "Customer question", href: `/app/projects/${projectId}/prompts` };
    const url = typeof o.url === "string" ? o.url : typeof o.pageUrl === "string" ? o.pageUrl : null;
    if (url) return { label: url, href: url };
    return { label: [kind, o.code ?? o.id].filter(Boolean).join(" · ") || "Supporting detail", href: null };
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
  const [dialog, setDialog] = useState<null | "approve" | "reject" | "edit" | "execute" | "rollback" | "manual">(null);
  const [manualNote, setManualNote] = useState("");
  const [manualUrl, setManualUrl] = useState("");
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
      "Approved. Your OK applies to this exact text.",
    );
  const reject = () =>
    run("reject", () => api(`/api/actions/${a.id}/reject`, { body: { reason: reason.trim() || undefined } }), "Turned down. Nothing on your site was changed.");
  const execute = () => run("execute", () => api(`/api/actions/${a.id}/execute`, { body: {} }), "Making the change now. We'll check the page again when it's done.");
  const rollback = () => run("rollback", () => api(`/api/actions/${a.id}/rollback`, { body: {} }), "Undo started. We'll put the old version back.");

  async function saveDraft() {
    if (!draft.trim()) {
      setEditError("The new text can't be empty.");
      return;
    }
    setBusy("edit");
    setEditError(null);
    try {
      await api(`/api/actions/${a.id}`, { method: "PATCH", body: { after: draft } });
      toast("Saved. It now needs your OK again.", "success");
      setDialog(null);
      router.refresh();
    } catch (e) {
      setEditError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function completeManually() {
    setBusy("manual");
    try {
      await api(`/api/actions/${a.id}/complete-manually`, {
        method: "POST",
        body: { ...(manualNote.trim() ? { note: manualNote.trim() } : {}), ...(manualUrl.trim() ? { url: manualUrl.trim() } : {}) },
      });
      toast("Marked as done. It now counts as finished work.", "success");
      setDialog(null);
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
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
  // Class A items are briefs / internal tasks: nothing to publish automatically.
  const canExecute =
    a.riskClass !== "A" &&
    !!a.integrationId &&
    (a.status === "approved" || (a.policyDecision === "auto_execute" && ["proposed", "failed"].includes(a.status)));
  const locked = a.status === "awaiting_approval" || a.status === "approved";
  const advisory = !!a.change && ADVISORY_FIELDS.includes(a.change.field);
  const timeline = buildTimeline(a.createdAt, a.approvals, a.executions);
  const summary = actionSummary(a.type);
  const showEdit = canEdit && !!a.change && EDITABLE.includes(a.status);
  const showApprove = canApprove && a.status === "awaiting_approval";
  // Work done by hand (no connector, a brief, or blocked/failed automation). The server re-checks eligibility.
  const canCompleteManually =
    canApprove &&
    !["succeeded", "succeeded_with_warnings", "completed_manually", "rejected", "cancelled", "rolled_back", "executing", "validating"].includes(a.status) &&
    (!a.integrationId || a.riskClass === "A" || ["blocked", "failed"].includes(a.status));
  // Applying a change to a live site needs admin/owner (or staff support mode); canApprove carries that role.
  const hasButtons = showEdit || showApprove || (canApprove && canExecute) || (canApprove && canRollback) || canCompleteManually;

  return (
    <Card as="article" className="overflow-hidden" aria-labelledby={`act-${a.id}-title`}>
      {/* Header */}
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={a.status} />
              <Badge tone={PRIORITY_TONE[a.priority] ?? "neutral"}>{priorityLabel(a.priority)}</Badge>
              {!a.integrationId && a.change && !advisory && <Badge icon={<Hand />}>Do by hand</Badge>}
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
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <div>
            <dt className="text-caption uppercase tracking-[0.06em] text-muted">How urgent</dt>
            <dd className="mt-1 text-small font-medium text-fg">{priorityLabel(a.priority)}</dd>
          </div>
          <div>
            <dt className="text-caption uppercase tracking-[0.06em] text-muted">What it should help</dt>
            <dd className="mt-1 text-small text-fg">{a.expectedImpact ?? "Not estimated"}</dd>
          </div>
          <div>
            <dt className="text-caption uppercase tracking-[0.06em] text-muted">How much work</dt>
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
          <Notice tone="neutral" icon={<Lock />} title="Your OK applies to this exact text — if it's edited, it needs your OK again.">
            {a.approval?.decision === "pending" && (
              <span className="text-caption">This request expires {fmtDate(a.approval.expiresAt, true)}.</span>
            )}
          </Notice>
        )}

        {a.manualInstructions && (
          <Notice tone="tip" icon={<Hand />} title="Make this change by hand">
            <p className="mb-3">
              We can’t make this change for you
              {a.integrationId ? "" : " because your website isn’t connected"}. Copy the steps below into your website editor, then check
              your website again so we can confirm it worked.
            </p>
            <CopyBlock label="Step-by-step instructions" text={a.manualInstructions} />
          </Notice>
        )}

        {a.approval?.decision === "rejected" && a.approval.comments && (
          <p className="text-small text-muted">
            <span className="font-medium text-fg">Turned down because:</span> {a.approval.comments}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <Disclosure icon={<FileText />} label="What we found" count={a.evidenceRefs.length}>
            {a.evidenceRefs.length === 0 ? (
              <p className="text-small text-muted">Nothing linked.</p>
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
              Edit text
            </Button>
          )}
          {canApprove && canRollback && (
            <Button variant="secondary" size="sm" icon={<RotateCcw />} onClick={() => setDialog("rollback")}>
              Undo
            </Button>
          )}
          {showApprove && (
            <>
              <Button variant="secondary" size="sm" icon={<XCircle />} onClick={() => setDialog("reject")}>
                Turn down
              </Button>
              <Button variant="accent" size="sm" icon={<CheckCircle2 />} onClick={() => setDialog("approve")}>
                Approve
              </Button>
            </>
          )}
          {canApprove && canExecute && (
            <Button size="sm" icon={<Play />} onClick={() => setDialog("execute")}>
              Make change
            </Button>
          )}
          {canCompleteManually && (
            <Button variant="secondary" size="sm" icon={<CheckCircle2 />} onClick={() => setDialog("manual")}>
              I did it by hand
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
        description="Your OK applies to the text below. If anyone edits it later, it needs your OK again before it can go live."
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
        title="Turn down this fix?"
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
        title="Make this change on your website?"
        description={
          <>
            We’ll save the current version first, put the new text live{a.targetUrl ? <> on <span className="break-all font-medium text-fg">{a.targetUrl}</span></> : null}, then check the page again. You can undo it afterwards.
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button loading={busy === "execute"} loadingText="Starting…" onClick={execute}>
              Make change
            </Button>
          </>
        }
      />

      <Dialog
        open={dialog === "manual"}
        onClose={close}
        icon={<CheckCircle2 />}
        title="Mark this as done by hand?"
        description="Use this when you made the change yourself (for example, in your website editor). It will count as finished work in reports."
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button loading={busy === "manual"} loadingText="Saving…" onClick={completeManually}>
              Mark as done
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="What was done" htmlFor={`man-note-${a.id}`} optional>
            <Textarea id={`man-note-${a.id}`} rows={2} value={manualNote} onChange={(e) => setManualNote(e.target.value)} maxLength={2000} />
          </Field>
          <Field label="Link to the changed page" htmlFor={`man-url-${a.id}`} optional>
            <Input id={`man-url-${a.id}`} type="url" value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} placeholder="https://" />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={dialog === "rollback"}
        onClose={close}
        icon={<RotateCcw />}
        tone="warning"
        title="Undo this change?"
        description="We'll put back the version that was live before this change."
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button variant="danger" loading={busy === "rollback"} loadingText="Starting…" onClick={rollback}>
              Undo
            </Button>
          </>
        }
      />

      <Dialog
        open={dialog === "edit"}
        onClose={close}
        size="xl"
        icon={<Pencil />}
        title="Edit text"
        description="Editing the text means it needs your OK again. Saving also checks the change against your safety rules."
        footer={
          <>
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button loading={busy === "edit"} loadingText="Saving…" onClick={saveDraft} disabled={!!a.change && draft === a.change.after}>
              Save text
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
