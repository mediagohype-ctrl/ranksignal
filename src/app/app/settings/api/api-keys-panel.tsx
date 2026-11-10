"use client";
import { useState } from "react";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { fmtDate, fmtDateTime } from "@/lib/dashboard/format";
import type { ApiKeyView } from "@/lib/api-keys/service";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Dialog,
  EmptyState,
  Field,
  Input,
  Notice,
  useToast,
} from "@/components/ui";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

export function ApiKeysPanel({
  initialKeys,
  canManage,
  maxKeys,
  baseUrl,
  timeZone,
}: {
  initialKeys: ApiKeyView[];
  canManage: boolean;
  maxKeys: number;
  baseUrl: string;
  timeZone: string | null;
}) {
  const toast = useToast();
  const [keys, setKeys] = useState(initialKeys);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<ApiKeyView | null>(null);
  const [busy, setBusy] = useState(false);

  const active = keys.filter((k) => !k.revokedAt);
  const atLimit = active.length >= maxKeys;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    const r = await createApiKeyAction(name);
    setCreating(false);
    if (!r.ok) {
      setCreateError(r.error);
      return;
    }
    setKeys((ks) => [r.item, ...ks]);
    setNewKey(r.key);
    setCopied(false);
    setName("");
  }

  async function revoke() {
    if (!revoking) return;
    setBusy(true);
    const r = await revokeApiKeyAction(revoking.id);
    setBusy(false);
    if (!r.ok) {
      toast(r.error, "error");
      return;
    }
    setKeys((ks) => ks.map((k) => (k.id === r.item.id ? r.item : k)).sort((a, b) => Number(!!a.revokedAt) - Number(!!b.revokedAt)));
    setRevoking(null);
    toast("Key revoked. Apps using it stop working straight away.", "success");
  }

  async function copy() {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function closeCreate() {
    setCreateOpen(false);
    setNewKey(null);
    setCreateError(null);
  }

  return (
    <Card>
      <CardHeader
        icon={<KeyRound />}
        title="Your API keys"
        description={`${active.length} of ${maxKeys} active key${maxKeys === 1 ? "" : "s"} on your plan.`}
        actions={
          canManage ? (
            <Button size="sm" icon={<Plus />} onClick={() => setCreateOpen(true)} disabled={atLimit} title={atLimit ? "Revoke a key or upgrade to add more" : undefined}>
              Create key
            </Button>
          ) : undefined
        }
      />
      <CardBody>
        {!canManage && (
          <Notice tone="info" className="mb-4">
            Only owners and admins can create or revoke API keys.
          </Notice>
        )}
        {keys.length === 0 ? (
          <EmptyState
            size="sm"
            title="No API keys yet"
            description={
              canManage
                ? "Create a key to pull your scores into Looker Studio, a spreadsheet or an AI assistant. You will see the key once, so keep it somewhere safe."
                : "Ask an owner or admin of this workspace to create one."
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
                    <span className="break-all">{k.name}</span>
                    {k.revokedAt ? <Badge tone="neutral">Revoked</Badge> : <Badge tone="success" variant="dot">Active</Badge>}
                    <Badge tone="info">Read only</Badge>
                  </p>
                  <p className="mt-0.5 text-small text-muted">
                    <code className="font-mono">{k.prefix}…</code> · Created {fmtDate(k.createdAt, false, timeZone)} ·{" "}
                    {k.revokedAt
                      ? `Revoked ${fmtDate(k.revokedAt, false, timeZone)}`
                      : k.lastUsedAt
                        ? `Last used ${fmtDateTime(k.lastUsedAt, timeZone)}`
                        : "Never used"}
                  </p>
                </div>
                {canManage && !k.revokedAt && (
                  <Button size="sm" variant="outline" icon={<Trash2 />} onClick={() => setRevoking(k)}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <Dialog
        open={createOpen}
        onClose={closeCreate}
        title={newKey ? "Copy your new key" : "Create an API key"}
        icon={<KeyRound />}
        description={newKey ? "This is the only time you will see it. If you lose it, revoke it and create a new one." : "Name it after where you will use it."}
        footer={
          newKey ? (
            <Button onClick={closeCreate}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeCreate}>
                Cancel
              </Button>
              <Button type="submit" form="create-api-key" loading={creating}>
                Create key
              </Button>
            </>
          )
        }
      >
        {newKey ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-xl border border-border bg-surface-2 p-3">
              <code className="min-w-0 flex-1 break-all font-mono text-small text-fg">{newKey}</code>
              <Button size="sm" variant="outline" icon={copied ? <Check /> : <Copy />} onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-small text-muted">Try it:</p>
            <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 font-mono text-caption text-fg">
              {`curl -H "Authorization: Bearer ${newKey.slice(0, 12)}…" \\\n  ${baseUrl}/api/v1/projects`}
            </pre>
          </div>
        ) : (
          <form id="create-api-key" onSubmit={create} className="space-y-3">
            <Field label="Key name" htmlFor="api-key-name" hint='For example "Looker Studio" or "Agency dashboard".' error={createError} required>
              <Input id="api-key-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required autoFocus />
            </Field>
          </form>
        )}
      </Dialog>

      <Dialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        title="Revoke this key?"
        tone="danger"
        icon={<Trash2 />}
        description={revoking ? `Anything using "${revoking.name}" (${revoking.prefix}…) stops working straight away. This cannot be undone.` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={revoke}>
              Revoke key
            </Button>
          </>
        }
      />
    </Card>
  );
}
