"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertTriangle, LifeBuoy, Plus, Power } from "lucide-react";
import { Badge, Button, Dialog, Field, Input, Notice, Spinner, Textarea } from "@/components/ui";

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => null)) as { item?: unknown; error?: { message?: string } } | null;
  if (!res.ok) throw new Error(data?.error?.message ?? `Request failed (${res.status})`);
  return data?.item;
}

/** Accessible on/off switch. */
function Switch({
  checked,
  onChange,
  label,
  busy,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className={clsx(
        "focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
        checked ? "bg-success" : "bg-surface-3",
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "flex size-5 items-center justify-center rounded-full bg-surface shadow-sm transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      >
        {busy && <Spinner size={10} />}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ flags */

export function FlagToggles({ initial }: { initial: { key: string; enabled: boolean; isDefault: boolean }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [confirmKill, setConfirmKill] = useState(false);

  async function apply(key: string, enabled: boolean) {
    setBusy(key);
    setError(null);
    try {
      await send("/api/admin/flags", "POST", { key, enabled });
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  function toggle(key: string, enabled: boolean) {
    if (key === "global.publishing" && !enabled) {
      setConfirmKill(true);
      return;
    }
    void apply(key, enabled);
  }

  return (
    <div className="space-y-4">
      {error && <Notice tone="danger">{error}</Notice>}
      {initial.length === 0 ? (
        <p className="text-small text-muted">No flags defined.</p>
      ) : (
        <ul className="divide-y divide-border">
          {initial.map((f) => {
            const kill = f.key === "global.publishing";
            return (
              <li key={f.key} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className={clsx("truncate font-mono text-xs text-fg", kill && "font-semibold")}>{f.key}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {kill && (
                      <Badge tone="danger" size="sm" icon={<Power />}>
                        Kill switch
                      </Badge>
                    )}
                    {f.isDefault && (
                      <Badge tone="neutral" size="sm">
                        Default
                      </Badge>
                    )}
                    <span className={clsx("text-xs font-medium", f.enabled ? "text-success" : "text-danger")}>
                      {f.enabled ? "On" : "Off"}
                    </span>
                  </div>
                </div>
                <Switch checked={f.enabled} busy={busy === f.key} label={`Toggle ${f.key}`} onChange={(v) => toggle(f.key, v)} />
              </li>
            );
          })}
        </ul>
      )}
      <form
        className="flex gap-2 border-t border-border pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const k = newKey.trim();
          if (!k) return;
          if (await apply(k, false)) setNewKey("");
        }}
      >
        <label htmlFor="new-flag" className="sr-only">
          New flag key
        </label>
        <Input
          id="new-flag"
          inputSize="sm"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="action.update_title or provider.x"
          className="font-mono text-xs"
        />
        <Button type="submit" size="sm" variant="secondary" icon={<Plus />} disabled={!newKey.trim()} loading={busy === newKey.trim() && !!newKey.trim()}>
          Add (off)
        </Button>
      </form>
      <Dialog
        open={confirmKill}
        onClose={() => setConfirmKill(false)}
        tone="danger"
        icon={<AlertTriangle />}
        title="Stop all publishing?"
        description="This blocks every connector from publishing changes for every tenant until it is turned back on. The action is audit-logged."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmKill(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy === "global.publishing"}
              onClick={async () => {
                if (await apply("global.publishing", false)) setConfirmKill(false);
              }}
            >
              Disable publishing
            </Button>
          </>
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ per-org publishing */

export function OrgControls({ orgId, orgName, publishingEnabled }: { orgId: string; orgName?: string; publishingEnabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (reason.trim().length < 5) {
      setError("Give a reason of at least 5 characters (e.g. a ticket number).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await send(`/api/admin/orgs/${orgId}`, "PATCH", { publishingEnabled: !publishingEnabled, reason: reason.trim() });
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Switch
          checked={publishingEnabled}
          label={`Publishing for ${orgName ?? orgId}`}
          onChange={() => {
            setError(null);
            setOpen(true);
          }}
        />
        <span className={clsx("text-xs font-medium", publishingEnabled ? "text-success" : "text-danger")}>
          {publishingEnabled ? "On" : "Off"}
        </span>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        tone={publishingEnabled ? "danger" : "default"}
        icon={<Power />}
        title={publishingEnabled ? "Pause publishing for this tenant?" : "Resume publishing for this tenant?"}
        description={`${orgName ?? orgId} — the reason is stored in the audit log.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant={publishingEnabled ? "danger" : "primary"} loading={busy} onClick={submit}>
              {publishingEnabled ? "Pause publishing" : "Resume publishing"}
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor={`reason-${orgId}`} error={error} required>
          <Textarea
            id={`reason-${orgId}`}
            rows={2}
            value={reason}
            invalid={!!error}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ticket #1234 — customer requested pause"
          />
        </Field>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ support access */

export function SupportAccess() {
  const [orgId, setOrgId] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!orgId.trim() || reason.trim().length < 5) {
      setError("Enter an organization id and a reason of at least 5 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await send("/api/admin/support-access", "POST", { organizationId: orgId.trim(), reason }));
    } catch (err) {
      setError((err as Error).message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Organization id" htmlFor="sa-org">
        <Input id="sa-org" value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="cl…" className="font-mono text-xs" required />
      </Field>
      <Field label="Reason" htmlFor="sa-reason" hint="Logged with your name. Include a ticket number.">
        <Input
          id="sa-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ticket #1234"
          required
          minLength={5}
          aria-describedby="sa-reason-hint"
        />
      </Field>
      {error && <Notice tone="danger">{error}</Notice>}
      <Button type="submit" fullWidth variant="secondary" icon={<LifeBuoy />} loading={busy} loadingText="Opening…">
        Open read-only support view
      </Button>
      {result != null && (
        <pre className="max-h-96 overflow-auto rounded-xl border border-border bg-surface-2 p-3 font-mono text-xs text-fg-soft">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </form>
  );
}
