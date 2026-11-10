"use client";
// Alert settings: each rule on/off + threshold, channels, recipients and instant vs daily digest. Admins edit;
// everyone else sees the settings read-only.
import { useState } from "react";
import { Bell, Mail, MessageCircle, Save } from "lucide-react";
import { Button, Card, CardBody, CardFooter, CardHeader, Input, Notice, useToast } from "@/components/ui";
import { SwitchRow } from "@/components/app/project-settings/switch";
import type { AlertConfig, AlertPlanLimits, AlertRuleId, RuleMeta } from "@/lib/alerts/config";

export interface AlertMemberOption {
  userId: string;
  name: string | null;
  email: string;
  role: string;
}

export function AlertSettingsForm({
  projectId,
  initial,
  rules,
  members,
  limits,
  canManage,
  delivery,
}: {
  projectId: string;
  initial: AlertConfig;
  rules: RuleMeta[];
  members: AlertMemberOption[];
  limits: AlertPlanLimits;
  canManage: boolean;
  delivery: { emailConfigured: boolean; whatsappConfigured: boolean; whatsappOptIn: boolean };
}) {
  const toast = useToast();
  const [config, setConfig] = useState<AlertConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const disabled = !canManage || saving;

  const update = (fn: (c: AlertConfig) => AlertConfig) => {
    setConfig((c) => fn(structuredClone(c)));
    setDirty(true);
  };
  const setRule = (id: AlertRuleId, patch: Partial<AlertConfig["rules"][AlertRuleId]>) =>
    update((c) => ({ ...c, rules: { ...c.rules, [id]: { ...c.rules[id], ...patch } } }));
  const toggleRecipient = (userId: string) =>
    update((c) => ({ ...c, recipients: c.recipients.includes(userId) ? c.recipients.filter((x) => x !== userId) : [...c.recipients, userId] }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/alerts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = (await res.json().catch(() => null)) as { item?: { config: AlertConfig }; error?: { message?: string } } | null;
      if (!res.ok || !data?.item) throw new Error(data?.error?.message ?? "Couldn't save your alert settings.");
      setConfig(data.item.config);
      setDirty(false);
      toast("Alert settings saved", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save your alert settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  const tooMany = config.recipients.length > limits.maxRecipients;

  return (
    <div className="space-y-6">
      {!canManage && (
        <Notice tone="info" title="Only owners and admins can change alerts">
          You can see which alerts are on. Ask an owner or admin of your team to change them.
        </Notice>
      )}

      <Card>
        <CardHeader icon={<Bell />} title="What to alert on" description="Every alert is on by default. We check after each website check, AI check or Search Console sync." />
        <CardBody className="divide-y divide-border py-0">
          {rules.map((r) => {
            const rc = config.rules[r.id];
            return (
              <div key={r.id} className="py-1">
                <SwitchRow
                  id={`rule-${r.id}`}
                  label={r.label}
                  help={
                    <>
                      {r.help} <span className="text-muted">Checked after each {r.checkedAfter}.</span>
                    </>
                  }
                  checked={rc.enabled}
                  disabled={disabled}
                  onChange={(v) => setRule(r.id, { enabled: v })}
                />
                {r.threshold && rc.enabled && (
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-small text-fg-soft">
                    <label htmlFor={`threshold-${r.id}`}>{r.threshold.label}:</label>
                    <Input
                      id={`threshold-${r.id}`}
                      type="number"
                      inputSize="sm"
                      className="w-24"
                      min={r.threshold.min}
                      max={r.threshold.max}
                      value={rc.threshold ?? r.threshold.default}
                      disabled={disabled}
                      onChange={(e) => setRule(r.id, { threshold: Number(e.target.value) })}
                    />
                    <span className="text-muted">
                      {r.threshold.unit} (between {r.threshold.min} and {r.threshold.max})
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={<Mail />} title="How to tell you" description="Alerts always appear on the alert history below." />
        <CardBody className="divide-y divide-border py-0">
          <SwitchRow
            id="ch-inapp"
            label="In the app"
            help="Shows in the bell menu at the top of the app."
            checked={config.channels.inApp}
            disabled={disabled}
            onChange={(v) => update((c) => ({ ...c, channels: { ...c.channels, inApp: v } }))}
          />
          <SwitchRow
            id="ch-email"
            label="Email"
            help={delivery.emailConfigured ? "Sent to the people chosen below." : "Email sending isn't set up on this server yet, so emails are skipped for now."}
            checked={config.channels.email}
            disabled={disabled}
            onChange={(v) => update((c) => ({ ...c, channels: { ...c.channels, email: v } }))}
          />
          <SwitchRow
            id="ch-whatsapp"
            label="WhatsApp"
            help={
              !limits.whatsapp
                ? "WhatsApp alerts aren't included in your plan."
                : delivery.whatsappOptIn
                  ? "Sent to your workspace's WhatsApp number."
                  : "Turn on WhatsApp updates in your workspace settings first; until then nothing is sent on WhatsApp."
            }
            checked={config.channels.whatsapp && limits.whatsapp}
            disabled={disabled || !limits.whatsapp}
            onChange={(v) => update((c) => ({ ...c, channels: { ...c.channels, whatsapp: v } }))}
          />
          <div className="py-3">
            <p className="text-small font-medium text-fg" id="digest-label">
              When to send emails and WhatsApp messages
            </p>
            <div role="radiogroup" aria-labelledby="digest-label" className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["instant", "Straight away", "One message per alert, as soon as it happens."],
                  ["daily", "Once a day (digest)", "One summary at about 9 am India time. Urgent alerts like “site down” still go out straight away."],
                ] as const
              ).map(([value, label, help]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-small ${config.digest === value ? "border-primary bg-primary-soft/40" : "border-border"}`}
                >
                  <input
                    type="radio"
                    name="digest"
                    value={value}
                    className="mt-1"
                    checked={config.digest === value}
                    disabled={disabled || (value === "daily" && !limits.digest)}
                    onChange={() => update((c) => ({ ...c, digest: value }))}
                  />
                  <span>
                    <span className="block font-medium text-fg">{label}</span>
                    <span className="text-muted">{help}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={<MessageCircle />}
          title="Who gets alerts"
          description={`Nobody picked = every owner and admin. You can pick up to ${limits.maxRecipients} people on your plan.`}
        />
        <CardBody>
          {members.length === 0 ? (
            <p className="text-small text-muted">Only owners and admins can see the team list.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {members.map((m) => (
                <li key={m.userId}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-3 text-small">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={config.recipients.includes(m.userId)}
                      disabled={disabled}
                      onChange={() => toggleRecipient(m.userId)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-fg">{m.name || m.email}</span>
                      <span className="block truncate text-muted">
                        {m.email} · <span className="capitalize">{m.role}</span>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {tooMany && <p className="mt-2 text-small text-danger">Pick at most {limits.maxRecipients} people.</p>}
        </CardBody>
        {canManage && (
          <CardFooter>
            {dirty && <span className="mr-auto text-small text-muted">You have unsaved changes.</span>}
            <Button icon={<Save />} loading={saving} disabled={!dirty || tooMany} onClick={save}>
              Save alert settings
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
