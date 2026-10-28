"use client";
// Feature flags & kill switches (staff). Changes apply immediately and are audit-logged.
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { AlertTriangle, Plus, Power } from "lucide-react";
import { Badge, Button, Dialog, Input, Notice, Spinner } from "@/components/ui";
import { adminSend as send } from "./actions";

/** Accessible on/off switch. */
export function Switch({
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

export function FlagToggles({
  initial,
  allowAdd = true,
}: {
  initial: { key: string; enabled: boolean; isDefault: boolean; note?: string | null; updatedAt?: string | null }[];
  allowAdd?: boolean;
}) {
  const inputId = useId();
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
                    {f.updatedAt && <span className="text-xs text-muted">· changed {f.updatedAt}</span>}
                    {f.note && <span className="truncate text-xs text-muted">· {f.note}</span>}
                  </div>
                </div>
                <Switch checked={f.enabled} busy={busy === f.key} label={`Toggle ${f.key}`} onChange={(v) => toggle(f.key, v)} />
              </li>
            );
          })}
        </ul>
      )}
      {allowAdd && (
      <form
        className="flex gap-2 border-t border-border pt-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const k = newKey.trim();
          if (!k) return;
          if (await apply(k, false)) setNewKey("");
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          New flag key
        </label>
        <Input
          id={inputId}
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
      )}
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
