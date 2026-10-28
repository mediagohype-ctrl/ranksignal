"use client";
// Interactive admin actions. Every mutating action asks for a reason that is written to the audit log.
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightToLine,
  BadgeIndianRupee,
  CalendarPlus,
  KeyRound,
  Layers,
  MailCheck,
  Pause,
  Pencil,
  Play,
  Power,
  RotateCcw,
  Save,
  ShieldCheck,
  ShieldOff,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button, Dialog, Field, Notice, Select, Textarea, useToast, type ButtonVariant } from "@/components/ui";

export async function adminSend<T = unknown>(url: string, method: string, body?: unknown): Promise<T | undefined> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { item?: T; error?: { message?: string } } | null;
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
  return data?.item;
}

/* ------------------------------------------------------------------ generic reason dialog */

interface SelectField {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
  /** Convert the selected string before sending (e.g. "none" → null, "7" → 7). */
  parse?: (v: string) => unknown;
}

export function ReasonAction({
  label,
  icon,
  variant = "secondary",
  title,
  description,
  endpoint,
  method = "POST",
  body = {},
  field,
  confirmLabel,
  tone = "default",
  successMessage,
  onSuccess,
  disabled,
  size = "sm",
}: {
  label: string;
  icon?: React.ReactNode;
  variant?: ButtonVariant;
  title: string;
  description?: React.ReactNode;
  endpoint: string;
  method?: "POST" | "PATCH";
  body?: Record<string, unknown>;
  field?: SelectField;
  confirmLabel?: string;
  tone?: "default" | "danger" | "warning";
  successMessage: string;
  onSuccess?: (item: unknown) => void;
  disabled?: boolean;
  size?: "xs" | "sm" | "md";
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [value, setValue] = useState(field?.defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `reason-${title.replace(/\W+/g, "-").toLowerCase()}`;

  async function submit() {
    if (reason.trim().length < 3) {
      setError("Give a short reason (ticket number or explanation).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const extra = field ? { [field.name]: field.parse ? field.parse(value) : value } : {};
      const item = await adminSend(endpoint, method, { ...body, ...extra, reason: reason.trim() });
      setOpen(false);
      setReason("");
      toast(successMessage, "success");
      if (onSuccess) onSuccess(item);
      else router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size={size}
        variant={variant}
        icon={icon}
        disabled={disabled}
        onClick={() => {
          setError(null);
          setValue(field?.defaultValue ?? "");
          setOpen(true);
        }}
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        tone={tone}
        icon={icon}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant={tone === "danger" ? "danger" : "primary"} loading={busy} onClick={submit}>
              {confirmLabel ?? label}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {field && (
            <Field label={field.label} htmlFor={`${id}-field`}>
              <Select id={`${id}-field`} value={value} onChange={(e) => setValue(e.target.value)}>
                {field.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Reason" htmlFor={id} hint="Stored in the audit log with your name." error={error} required>
            <Textarea
              id={id}
              rows={2}
              value={reason}
              invalid={!!error}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ticket #1234 — customer asked for…"
            />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ organization actions */

export interface OrgActionTarget {
  id: string;
  name: string;
  planId: string;
  serviceTier: string | null;
  status: string;
  publishingEnabled: boolean;
}

export function OrgActions({ org }: { org: OrgActionTarget }) {
  const endpoint = `/api/admin/orgs/${org.id}`;
  const suspended = org.status === "suspended";
  return (
    <div className="flex flex-wrap gap-2">
      <ReasonAction
        label="Enter workspace"
        icon={<ArrowRightToLine />}
        variant="primary"
        title="Enter this workspace in support mode?"
        description={`You'll act inside ${org.name} as an admin. Every action is audit-logged. Use "Exit" in the admin bar to return.`}
        endpoint={`${endpoint}/enter`}
        confirmLabel="Enter workspace"
        successMessage="Entering workspace…"
        onSuccess={() => window.location.assign("/app")}
      />
      <ReasonAction
        label="Change plan"
        icon={<BadgeIndianRupee />}
        title="Change self-serve plan"
        description="Overrides the plan without touching Razorpay. A later billing webhook may change it again."
        endpoint={endpoint}
        method="PATCH"
        field={{
          name: "planId",
          label: "Plan",
          defaultValue: org.planId,
          options: ["trial", "starter", "growth", "agency"].map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) })),
        }}
        successMessage="Plan updated"
      />
      <ReasonAction
        label="Service tier"
        icon={<Layers />}
        title="Set done-for-you service tier"
        endpoint={endpoint}
        method="PATCH"
        field={{
          name: "serviceTier",
          label: "Service tier",
          defaultValue: org.serviceTier ?? "none",
          options: [
            { value: "none", label: "None (self-serve)" },
            { value: "fix", label: "Fix — ₹19,999/mo" },
            { value: "grow", label: "Grow — ₹49,999/mo" },
            { value: "authority", label: "Authority — ₹1,19,999/mo" },
          ],
          parse: (v) => (v === "none" ? null : v),
        }}
        successMessage="Service tier updated"
      />
      <ReasonAction
        label="Extend trial"
        icon={<CalendarPlus />}
        title="Extend the free trial"
        description="Adds days from today or from the current trial end, whichever is later. Only for orgs on the Trial plan."
        endpoint={`${endpoint}/trial`}
        disabled={org.planId !== "trial"}
        field={{
          name: "days",
          label: "Extend by",
          defaultValue: "7",
          options: [
            { value: "7", label: "+7 days" },
            { value: "14", label: "+14 days" },
            { value: "30", label: "+30 days" },
          ],
          parse: (v) => Number(v),
        }}
        successMessage="Trial extended"
      />
      <ReasonAction
        label={org.publishingEnabled ? "Pause publishing" : "Resume publishing"}
        icon={org.publishingEnabled ? <Pause /> : <Play />}
        tone={org.publishingEnabled ? "warning" : "default"}
        title={org.publishingEnabled ? "Pause publishing for this customer?" : "Resume publishing for this customer?"}
        description="Controls whether connectors may publish changes to this customer's sites."
        endpoint={endpoint}
        method="PATCH"
        body={{ publishingEnabled: !org.publishingEnabled }}
        successMessage={org.publishingEnabled ? "Publishing paused" : "Publishing resumed"}
      />
      <ReasonAction
        label={suspended ? "Reactivate" : "Suspend"}
        icon={<Power />}
        variant={suspended ? "secondary" : "danger"}
        tone={suspended ? "default" : "danger"}
        title={suspended ? "Reactivate this organization?" : "Suspend this organization?"}
        description={suspended ? "Scans and AI checks can start again." : "Stops all new scans and AI checks. Members can still sign in and see their data."}
        endpoint={endpoint}
        method="PATCH"
        body={{ status: suspended ? "active" : "suspended" }}
        successMessage={suspended ? "Organization reactivated" : "Organization suspended"}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ notes */

export interface NoteView {
  id: string;
  body: string;
  author: string;
  createdAt: string;
}

export function NotesPanel({ orgId, notes }: { orgId: string; notes: NoteView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      toast(ok, "success");
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          if (await run("new", () => adminSend(`/api/admin/orgs/${orgId}/notes`, "POST", { body: draft }), "Note added")) setDraft("");
        }}
      >
        <Field label="New internal note" htmlFor="new-note" hint="Only staff can see notes.">
          <Textarea id="new-note" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Call summary, promises made, next steps…" />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" size="sm" icon={<Save />} loading={busy === "new"} disabled={!draft.trim()}>
            Add note
          </Button>
        </div>
      </form>
      {error && <Notice tone="danger">{error}</Notice>}
      {notes.length === 0 ? (
        <p className="text-small text-muted">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                <span>
                  <span className="font-medium text-fg-soft">{n.author}</span> · {n.createdAt}
                </span>
                <span className="flex gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label="Edit note" onClick={() => setEditing({ id: n.id, body: n.body })}>
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete note"
                    loading={busy === n.id}
                    onClick={() => {
                      if (window.confirm("Delete this note?")) void run(n.id, () => adminSend(`/api/admin/orgs/${orgId}/notes/${n.id}`, "DELETE"), "Note deleted");
                    }}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </div>
              {editing?.id === n.id ? (
                <div className="space-y-2">
                  <label htmlFor={`edit-${n.id}`} className="sr-only">
                    Edit note
                  </label>
                  <Textarea id={`edit-${n.id}`} rows={3} value={editing.body} onChange={(e) => setEditing({ id: n.id, body: e.target.value })} />
                  <div className="flex justify-end gap-2">
                    <Button size="xs" variant="secondary" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      loading={busy === `edit-${n.id}`}
                      onClick={async () => {
                        if (await run(`edit-${n.id}`, () => adminSend(`/api/admin/orgs/${orgId}/notes/${n.id}`, "PATCH", { body: editing.body }), "Note saved"))
                          setEditing(null);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-small text-fg">{n.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ users */

export function UserActions({ userId, isStaff, isSelf, emailVerified }: { userId: string; isStaff: boolean; isSelf: boolean; emailVerified: boolean }) {
  const endpoint = `/api/admin/users/${userId}`;
  return (
    <div className="flex flex-wrap gap-2">
      <ReasonAction
        label="Send password reset"
        icon={<KeyRound />}
        title="Email a password-reset link?"
        description="The user gets a single-use link valid for 60 minutes."
        endpoint={endpoint}
        body={{ action: "password_reset" }}
        successMessage="Password reset email sent"
      />
      <ReasonAction
        label="Resend verification"
        icon={<MailCheck />}
        title="Resend the email verification link?"
        endpoint={endpoint}
        body={{ action: "resend_verification" }}
        disabled={emailVerified}
        successMessage="Verification email sent"
      />
      <ReasonAction
        label={isStaff ? "Remove staff access" : "Make staff"}
        icon={isStaff ? <ShieldOff /> : <ShieldCheck />}
        variant={isStaff ? "danger" : "secondary"}
        tone={isStaff ? "danger" : "warning"}
        title={isStaff ? "Remove staff access?" : "Grant staff access?"}
        description={
          isStaff
            ? "They lose the admin back-office and support mode immediately."
            : "Staff can see every customer's data, enter workspaces and change plans. Grant only to team members."
        }
        endpoint={endpoint}
        method="PATCH"
        body={{ isStaff: !isStaff }}
        disabled={isSelf}
        successMessage={isStaff ? "Staff access removed" : "Staff access granted"}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ leads */

const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "closed"] as const;

export function LeadEditor({ id, status, notes }: { id: string; status: string; notes: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState(status);
  const [n, setN] = useState(notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = s !== status || n !== (notes ?? "");

  async function save(nextStatus = s) {
    setBusy(true);
    setError(null);
    try {
      await adminSend(`/api/admin/leads/${id}`, "PATCH", { status: nextStatus, notes: n });
      setS(nextStatus);
      toast("Lead saved", "success");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const idx = LEAD_STATUSES.indexOf(s as (typeof LEAD_STATUSES)[number]);
  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2" aria-label="Pipeline">
        {LEAD_STATUSES.map((st, i) => (
          <li key={st}>
            <button
              type="button"
              aria-pressed={s === st}
              onClick={() => setS(st)}
              className={
                s === st
                  ? "rounded-full bg-primary px-3 py-1 text-small font-medium capitalize text-primary-fg"
                  : i < idx
                    ? "rounded-full bg-primary-soft px-3 py-1 text-small font-medium capitalize text-primary-soft-fg"
                    : "rounded-full border border-border bg-surface px-3 py-1 text-small font-medium capitalize text-muted hover:text-fg"
              }
            >
              {i + 1}. {st}
            </button>
          </li>
        ))}
      </ol>
      <Field label="Notes" htmlFor="lead-notes" hint="Internal only.">
        <Textarea id="lead-notes" rows={6} value={n} onChange={(e) => setN(e.target.value)} placeholder="Called on…, interested in Grow tier…" />
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <div className="flex flex-wrap justify-end gap-2">
        {idx >= 0 && idx < LEAD_STATUSES.length - 1 && (
          <Button variant="secondary" size="sm" loading={busy} onClick={() => save(LEAD_STATUSES[idx + 1])}>
            Move to {LEAD_STATUSES[idx + 1]}
          </Button>
        )}
        <Button size="sm" icon={<Save />} loading={busy} disabled={!dirty} onClick={() => save()}>
          Save
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ jobs */

export function JobActions({ id, state }: { id: string; state: string }) {
  const endpoint = `/api/admin/jobs/${id}`;
  return (
    <div className="flex flex-wrap gap-2">
      {state === "failed" && (
        <ReasonAction
          label="Retry"
          icon={<RotateCcw />}
          variant="primary"
          title="Retry this job?"
          description="Puts the run back in the queue now with attempts reset. Fix the root cause first if the error is permanent."
          endpoint={endpoint}
          body={{ action: "retry" }}
          successMessage="Job re-queued"
        />
      )}
      {(state === "queued" || state === "retry_scheduled") && (
        <ReasonAction
          label="Cancel"
          icon={<XCircle />}
          variant="danger"
          tone="danger"
          title="Cancel this job?"
          description="The run will not start. Domain records (crawl/visibility run) may still show it as queued."
          endpoint={endpoint}
          body={{ action: "cancel" }}
          confirmLabel="Cancel job"
          successMessage="Job cancelled"
        />
      )}
    </div>
  );
}
