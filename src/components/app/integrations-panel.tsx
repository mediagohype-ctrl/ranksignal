"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Activity, Check, Eye, EyeOff, FileDown, Globe, Hand, Plug, PlugZap, ShieldCheck, Unplug } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { fmtDate, fmtRelative, hostOf } from "@/lib/dashboard/format";
import type { ConnectorCapabilities } from "@/lib/types";
import {
  Badge, Button, Card, CardBody, CardHeader, Dialog, EmptyState, Field, Input, Notice, SectionHeading, Select, fieldDescribedBy, useToast,
  type Tone,
} from "@/components/ui";
import { CapabilityList, type CatalogEntry } from "./integrations/capability-matrix";
import { PLATFORM_CHOICES, noConnectionLine } from "./integrations/platforms";
import { WordPressHelp } from "./integrations/wordpress-help";
import { ConnectGeneric } from "./integrations/connect-generic";
import { ConnectGoogle } from "./integrations/connect-google";
import type { PublicConnectorDescriptor } from "@/lib/connectors/catalog/types";

export type { CatalogEntry };

export interface IntegrationView {
  id: string;
  provider: string;
  health: string;
  siteUrl: string | null;
  connectedBy: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  capabilities: Partial<ConnectorCapabilities> | null;
}

const HEALTH: Record<string, { tone: Tone; label: string; help: string }> = {
  healthy: { tone: "success", label: "Working", help: "Our last test reached your site successfully." },
  degraded: { tone: "warning", label: "Having trouble", help: "Some requests failed recently. Try testing again." },
  failed: { tone: "danger", label: "Not working", help: "We couldn't sign in. The password may have been removed or the site is down. Reconnect, or test again later." },
  unknown: { tone: "neutral", label: "Not tested yet", help: "Run a test to check the connection." },
};

function HealthBadge({ health }: { health: string }) {
  const h = HEALTH[health] ?? HEALTH.unknown;
  return (
    <Badge tone={h.tone} variant="soft" title={h.help}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {h.label}
    </Badge>
  );
}

const PROVIDER_NAME: Record<string, string> = {
  wordpress: "WordPress",
  manual: "Copy-and-paste steps",
  github: "GitHub",
  shopify: "Shopify",
  webflow: "Webflow",
  contentful: "Contentful",
  sanity: "Sanity",
  wix: "Wix",
  gsc: "Google Search Console",
  ga4: "Google Analytics 4",
};
const providerName = (p: string) => PROVIDER_NAME[p] ?? p.replace(/^\w/, (c) => c.toUpperCase());

export function IntegrationsPanel({
  projectId,
  defaultSiteUrl,
  integrations,
  capabilityMap,
  descriptors = [],
  detected = null,
  canAdmin,
  canTest,
}: {
  projectId: string;
  defaultSiteUrl: string;
  integrations: IntegrationView[];
  capabilityMap: Record<string, ConnectorCapabilities>;
  /** What our website check found the site is built with: the choice to pre-select and the name to show. */
  detected?: { choiceId: string; name: string } | null;
  /** Credential-based connectors other than WordPress (GitHub, Shopify, Webflow, Contentful, Sanity, Wix). */
  descriptors?: PublicConnectorDescriptor[];
  canAdmin: boolean;
  canTest: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ siteUrl: defaultSiteUrl, username: "", applicationPassword: "" });
  const [showPass, setShowPass] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<IntegrationView | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; text: string }>>({});

  const hasWordPress = integrations.some((i) => i.provider === "wordpress");

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setFormError(null);
    try {
      await api("/api/integrations/wordpress/connect", { body: { projectId, ...form } });
      toast("WordPress connected. Click “Test connection” any time to check it.", "success");
      setForm((f) => ({ ...f, applicationPassword: "" }));
      router.refresh();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setConnecting(false);
    }
  }

  async function test(i: IntegrationView) {
    setBusy(`test-${i.id}`);
    try {
      const r = await api<{ item: { test?: { ok: boolean; identity?: string; error?: string } } }>(`/api/integrations/${i.id}/test`, { body: {} });
      const t = r.item.test;
      if (t?.ok) {
        const text = `Connection works${t.identity ? ` — signed in as ${t.identity}` : ""}.`;
        setTestResult((s) => ({ ...s, [i.id]: { ok: true, text } }));
        toast(text, "success");
      } else {
        const text = `Test failed: ${t?.error ?? "we couldn't reach your site"}. Check your website is online, then test again.`;
        setTestResult((s) => ({ ...s, [i.id]: { ok: false, text } }));
        toast(text, "error");
      }
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(i: IntegrationView) {
    setBusy(`del-${i.id}`);
    try {
      await api(`/api/integrations/${i.id}`, { method: "DELETE" });
      toast("Disconnected. The saved password was deleted.", "success");
      setConfirm(null);
      router.refresh();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  // "Where is your website built?" — one platform at a time. The platform our website check found is pre-selected
  // ("We found Shopify. Is that right?"); the owner can pick another.
  const [picked, setPicked] = useState<string | null>(detected?.choiceId ?? null);
  const [confirmed, setConfirmed] = useState(false);
  const choice = PLATFORM_CHOICES.find((c) => c.id === picked) ?? null;
  const isConnected = (provider: string | null) => !!provider && integrations.some((i) => i.provider === provider);
  const showDetected = !!detected && picked === detected.choiceId && !confirmed;

  const wordpressPanel = (
    <Card>
      <CardHeader
        icon={<PlugZap />}
        title={hasWordPress ? "Connect another WordPress site" : "Connect WordPress"}
        description="Takes about two minutes. We use a WordPress Application Password — a separate password you can revoke at any time without changing your login."
      />
      <CardBody className="grid gap-8 lg:grid-cols-2">
        <div>
          {canAdmin ? (
            <form onSubmit={connect} className="space-y-5" noValidate={false}>
              <Field label="Website address" htmlFor="wp-url" hint="Your WordPress site's home page, e.g. https://example.com" required>
                <Input
                  id="wp-url"
                  type="url"
                  required
                  inputMode="url"
                  value={form.siteUrl}
                  onChange={(e) => setForm({ ...form, siteUrl: e.target.value })}
                  aria-describedby={fieldDescribedBy("wp-url", { hint: true })}
                />
              </Field>
              <Field label="WordPress username" htmlFor="wp-user" hint="The username you sign in with (not your email)." required>
                <Input
                  id="wp-user"
                  autoComplete="off"
                  required
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  aria-describedby={fieldDescribedBy("wp-user", { hint: true })}
                />
              </Field>
              <Field
                label="Application Password"
                htmlFor="wp-pass"
                hint="Paste the password WordPress generated. Spaces are fine."
                error={formError}
                required
              >
                <div className="relative">
                  <Input
                    id="wp-pass"
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    spellCheck={false}
                    required
                    minLength={8}
                    invalid={!!formError}
                    className="pr-11 font-mono"
                    value={form.applicationPassword}
                    onChange={(e) => setForm({ ...form, applicationPassword: e.target.value })}
                    aria-describedby={fieldDescribedBy("wp-pass", { hint: true, error: formError })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    aria-label={showPass ? "Hide password" : "Show password"}
                    aria-pressed={showPass}
                    onClick={() => setShowPass((v) => !v)}
                  >
                    {showPass ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </Field>
              <div className="flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-caption font-normal text-muted">
                <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-success" />
                We save drafts and only change what you approve. Publishing, deleting pages and changing URLs are never done for you.
              </div>
              <div className="flex justify-end pt-1">
                <Button type="submit" icon={<PlugZap />} loading={connecting} loadingText="Connecting…" className="w-full sm:w-auto">
                  Connect WordPress
                </Button>
              </div>
            </form>
          ) : (
            <Notice tone="info" title="Owner or Admin only">
              Only the Owner or an Admin can connect a website. Ask them to do this step.
            </Notice>
          )}
        </div>
        <div className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <WordPressHelp />
        </div>
      </CardBody>
    </Card>
  );

  return (
    <div className="space-y-10">
      {/* Connected */}
      <section aria-labelledby="int-connected">
        <SectionHeading
          id="int-connected"
          title="Your connections"
          description="A connected website lets fixes you approve go live for you, get checked and be undone in one click. Passwords are stored safely and never shown again."
        />
        {integrations.length === 0 ? (
          <EmptyState
            bordered
            icon={<Plug />}
            title="Nothing connected yet"
            description="That's fine. Without a connection our team makes each change for you by hand. Tell us below where your website is built."
          />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {integrations.map((i) => {
              const tr = testResult[i.id];
              return (
                <li key={i.id}>
                  <Card as="article" padding="md" className="flex h-full flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
                        {i.provider === "manual" ? <FileDown className="size-5" /> : <Globe className="size-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-h4 text-fg">{providerName(i.provider)}</h3>
                          <HealthBadge health={i.health} />
                        </div>
                        {i.siteUrl && (
                          <a href={i.siteUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-small text-primary hover:underline">
                            {hostOf(i.siteUrl)}
                            <span className="sr-only"> (opens in new tab)</span>
                          </a>
                        )}
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-small">
                      <div>
                        <dt className="text-caption uppercase tracking-[0.06em] text-muted">Last checked</dt>
                        <dd className="mt-0.5 text-fg">{i.lastSyncAt ? fmtRelative(i.lastSyncAt) : "Never"}</dd>
                      </div>
                      <div>
                        <dt className="text-caption uppercase tracking-[0.06em] text-muted">Connected</dt>
                        <dd className="mt-0.5 text-fg">{fmtDate(i.createdAt)}</dd>
                      </div>
                    </dl>
                    <p className="text-caption font-normal text-muted">{(HEALTH[i.health] ?? HEALTH.unknown).help}</p>
                    {tr && (
                      <p role="status" className={clsx("rounded-lg px-3 py-2 text-small", tr.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                        {tr.text}
                      </p>
                    )}
                    {(canTest || canAdmin) && (
                      <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                        {canAdmin && (
                          <Button variant="ghost" size="sm" icon={<Unplug />} className="text-danger" onClick={() => setConfirm(i)}>
                            Disconnect
                          </Button>
                        )}
                        {canTest && (
                          <Button variant="secondary" size="sm" icon={<Activity />} loading={busy === `test-${i.id}`} loadingText="Testing…" onClick={() => test(i)}>
                            Test connection
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Connect a platform: ask where the website is built, then show ONE card for that platform */}
      <section aria-labelledby="int-connect">
        <SectionHeading
          id="int-connect"
          title="Where is your website built?"
          description="Tell us and we'll show what we can change for you there, and how to connect it."
        />
        <Card padding="md" className="space-y-4">
          {showDetected && detected && (
            <Notice
              tone="info"
              title={`We found ${detected.name}. Is that right?`}
              actions={
                <Button size="sm" icon={<Check />} onClick={() => setConfirmed(true)}>
                  Yes, that&apos;s right
                </Button>
              }
            >
              If not, choose where your website is built below.
            </Notice>
          )}
          <Field label="My website is built with" htmlFor="int-platform">
            <Select
              id="int-platform"
              value={picked ?? ""}
              onChange={(e) => {
                setPicked(e.target.value || null);
                setConfirmed(true);
              }}
            >
              <option value="">Choose…</option>
              {PLATFORM_CHOICES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {isConnected(c.connector) ? " (connected)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        </Card>

        {choice && (
          <div id="int-setup" className="mt-6 space-y-4">
            {choice.connector ? (
              <>
                <Card padding="md">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <h3 className="text-h4 text-fg">{choice.name}</h3>
                    {isConnected(choice.connector) && (
                      <Badge tone="success" size="sm">
                        <Check aria-hidden className="size-3" />
                        Connected
                      </Badge>
                    )}
                  </div>
                  <CapabilityList name={choice.name} caps={capabilityMap[choice.connector]} />
                </Card>
                {choice.connector === "wordpress" && wordpressPanel}
                {descriptors
                  .filter((d) => d.id === choice.connector)
                  .map((d) => (
                    <ConnectGeneric
                      key={d.id}
                      descriptor={d}
                      projectId={projectId}
                      canAdmin={canAdmin}
                      defaults={{ siteUrl: defaultSiteUrl }}
                      connected={isConnected(d.id)}
                      onConnected={() => router.refresh()}
                    />
                  ))}
              </>
            ) : (
              <Card padding="lg">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
                    <Hand className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-h4 text-fg">{choice.id === "other" ? "No connection needed" : `No ${choice.name} connection`}</h3>
                    <p className="mt-1 max-w-2xl text-small text-fg-soft">
                      {choice.id === "other"
                        ? "We don't have a connection for this kind of website. Our team makes the changes for you by hand."
                        : noConnectionLine(choice.name)}{" "}
                      Nothing to set up here.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}
      </section>

      {/* Google is for reports, not for fixes: kept apart from the website connection above */}
      <section aria-labelledby="int-google">
        <SectionHeading
          id="int-google"
          title="Connect Google for reports"
          description="Optional and read-only. Adds real Google clicks, searches and visits to your reports. Nothing on your website changes."
        />
        <ConnectGoogle projectId={projectId} canAdmin={canAdmin} />
      </section>

      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        icon={<Unplug />}
        tone="danger"
        title={`Disconnect ${confirm ? providerName(confirm.provider) : "this connection"}?`}
        description={
          <>
            We’ll delete the saved password{confirm?.siteUrl ? <> for <span className="font-medium text-fg">{hostOf(confirm.siteUrl)}</span></> : null}.
            Fixes waiting to go live will switch to copy-and-paste steps. Changes already made stay on your site. You may also want to
            revoke the Application Password in WordPress.
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={!!confirm && busy === `del-${confirm.id}`} loadingText="Disconnecting…" onClick={() => confirm && disconnect(confirm)}>
              Disconnect
            </Button>
          </>
        }
      />
    </div>
  );
}
