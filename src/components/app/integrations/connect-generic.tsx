"use client";
// Generic connect form rendered from a connector descriptor's connectFields + setupSteps.
// Posts to POST /api/integrations/<id>/connect. Secrets are cleared after a successful connect.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, PlugZap, ShieldCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import type { PublicConnectorDescriptor } from "@/lib/connectors/catalog/types";
import { Button, Card, CardBody, CardHeader, Field, Input, Notice, fieldDescribedBy, useToast } from "@/components/ui";

export function ConnectGeneric({
  descriptor,
  projectId,
  canAdmin,
  defaults = {},
  connected = false,
  onConnected,
}: {
  descriptor: PublicConnectorDescriptor;
  projectId: string;
  canAdmin: boolean;
  /** Prefilled values by field key (never pass secrets). */
  defaults?: Record<string, string>;
  /** An integration for this provider already exists (submitting replaces its settings). */
  connected?: boolean;
  onConnected?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const initial = Object.fromEntries(descriptor.connectFields.map((f) => [f.key, f.type === "password" ? "" : defaults[f.key] ?? ""]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const idFor = (key: string) => `connect-${descriptor.id}-${key}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = { projectId };
      for (const f of descriptor.connectFields) if (values[f.key]?.trim()) body[f.key] = values[f.key].trim();
      await api(`/api/integrations/${encodeURIComponent(descriptor.id)}/connect`, { body });
      toast(`${descriptor.name} connected. Run a test any time to check it.`, "success");
      setValues((v) => Object.fromEntries(Object.entries(v).map(([k, val]) => [k, descriptor.connectFields.find((f) => f.key === k)?.type === "password" ? "" : val])));
      onConnected?.();
      router.refresh();
    } catch (err) {
      const details = (err as { details?: { field?: string } }).details;
      setError({ message: errorMessage(err), field: details?.field });
    } finally {
      setBusy(false);
    }
  }

  const generalError = error && (!error.field || !descriptor.connectFields.some((f) => f.key === error.field)) ? error.message : null;

  return (
    <Card>
      <CardHeader
        icon={<PlugZap />}
        title={connected ? `Update ${descriptor.name} connection` : `Connect ${descriptor.name}`}
        description={descriptor.description}
      />
      <CardBody className="grid gap-8 lg:grid-cols-2">
        <div>
          {canAdmin ? (
            <form onSubmit={submit} className="space-y-5">
              {descriptor.connectFields.map((f) => {
                const id = idFor(f.key);
                const required = f.required !== false;
                const fieldError = error?.field === f.key ? error.message : null;
                const isSecret = f.type === "password";
                return (
                  <Field key={f.key} label={f.label} htmlFor={id} hint={f.help} error={fieldError} required={required} optional={!required}>
                    <div className={isSecret ? "relative" : undefined}>
                      <Input
                        id={id}
                        name={f.key}
                        type={isSecret ? (shown[f.key] ? "text" : "password") : f.type === "url" ? "url" : "text"}
                        inputMode={f.type === "url" ? "url" : undefined}
                        autoComplete={isSecret ? "new-password" : "off"}
                        spellCheck={false}
                        required={required}
                        placeholder={f.placeholder}
                        invalid={!!fieldError}
                        className={isSecret ? "pr-11 font-mono" : undefined}
                        value={values[f.key] ?? ""}
                        onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                        aria-describedby={fieldDescribedBy(id, { hint: f.help, error: fieldError })}
                      />
                      {isSecret && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                          aria-label={shown[f.key] ? `Hide ${f.label}` : `Show ${f.label}`}
                          aria-pressed={!!shown[f.key]}
                          onClick={() => setShown((s) => ({ ...s, [f.key]: !s[f.key] }))}
                        >
                          {shown[f.key] ? <EyeOff /> : <Eye />}
                        </Button>
                      )}
                    </div>
                  </Field>
                );
              })}
              {generalError && (
                <Notice tone="danger" title="Couldn't connect">
                  {generalError}
                </Notice>
              )}
              <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-caption font-normal text-muted">
                <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-success" />
                We only change what you approve, and we check the connection before saving. Secrets are encrypted and never shown again.
              </div>
              <div className="flex justify-end pt-1">
                <Button type="submit" icon={<PlugZap />} loading={busy} loadingText="Connecting…" className="w-full sm:w-auto">
                  {connected ? "Save and re-test" : `Connect ${descriptor.name}`}
                </Button>
              </div>
            </form>
          ) : (
            <Notice tone="info" title="Admins only">
              Only an organization admin can connect {descriptor.name}. Ask an admin on your team to do this step.
            </Notice>
          )}
        </div>
        <div className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <h3 className="mb-3 flex items-center gap-2 text-small font-semibold text-fg">
            <KeyRound aria-hidden className="size-4 text-primary" />
            How to set it up
          </h3>
          <ol className="space-y-3">
            {descriptor.setupSteps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold tabular-nums text-primary-soft-fg"
                >
                  {i + 1}
                </span>
                <p className="min-w-0 text-small text-fg-soft">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step}
                </p>
              </li>
            ))}
          </ol>
          {descriptor.capabilities.limitations.length > 0 && (
            <details className="mt-5 rounded-lg border border-border px-3 py-2 text-small">
              <summary className="cursor-pointer font-medium text-fg">What this connection can and can&apos;t do</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-caption font-normal text-muted">
                {descriptor.capabilities.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
