"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Activity, Blocks, Eye, EyeOff, FileDown, Globe, Plug, PlugZap, ShieldCheck, Unplug } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { fmtDate, fmtRelative, hostOf } from "@/lib/dashboard/format";
import type { ConnectorCapabilities } from "@/lib/types";
import {
  Badge, Button, Card, CardBody, CardHeader, Dialog, EmptyState, Field, Input, Notice, SectionHeading, fieldDescribedBy, useToast,
  type Tone,
} from "@/components/ui";
import { CapabilityMatrix, type CatalogEntry } from "./integrations/capability-matrix";
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
  failed: { tone: "danger", label: "Not working", help: "We couldn't sign in. The password may have been revoked or the site is down." },
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
  manual: "Manual export",
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
  catalog,
  capabilityMap,
  descriptors = [],
  canAdmin,
  canTest,
}: {
  projectId: string;
  defaultSiteUrl: string;
  integrations: IntegrationView[];
  catalog: CatalogEntry[];
  capabilityMap: Record<string, ConnectorCapabilities>;
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

  const available = catalog.filter((c) => c.status === "available");
  const planned = catalog.filter((c) => c.status === "planned");
  const hasWordPress = integrations.some((i) => i.provider === "wordpress");

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setConnecting(true);
    setFormError(null);
    try {
      await api("/api/integrations/wordpress/connect", { body: { projectId, ...form } });
      toast("WordPress connected. Run a test any time to check it.", "success");
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
        const text = `Test failed: ${t?.error ?? "we couldn't reach your site"}.`;
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

  return (
    <div className="space-y-10">
      {/* Connected */}
      <section aria-labelledby="int-connected">
        <SectionHeading
          id="int-connected"
          title="Your connections"
          description="Connected sites let approved changes be applied, checked and undone automatically. Passwords are encrypted and never shown again."
        />
        {integrations.length === 0 ? (
          <EmptyState
            bordered
            icon={<Plug />}
            title="Nothing connected yet"
            description="That's fine — without a connection, every approved change comes with copy-ready steps you can paste into your website editor."
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

      {/* Connect WordPress */}
      <section aria-labelledby="int-connect">
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
                <Notice tone="info" title="Admins only">
                  Only an organization admin can connect a website. Ask an admin on your team to do this step.
                </Notice>
              )}
            </div>
            <div className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <WordPressHelp />
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Google Search Console + GA4 (OAuth, read-only) */}
      <section aria-labelledby="int-google">
        <SectionHeading
          id="int-google"
          title="Google Search Console & Analytics"
          description="Read-only. Adds real clicks, impressions and AI-referred visits to your reports and monthly impact report."
        />
        <ConnectGoogle projectId={projectId} canAdmin={canAdmin} />
      </section>

      {/* Other platforms */}
      {descriptors.length > 0 && (
        <section aria-labelledby="int-more">
          <SectionHeading
            id="int-more"
            title="Other platforms"
            description="Code repositories, stores, website builders and headless CMSs. Changes are saved as drafts or pull requests wherever the platform allows."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {descriptors.map((d) => (
              <ConnectGeneric
                key={d.id}
                descriptor={d}
                projectId={projectId}
                canAdmin={canAdmin}
                defaults={{ siteUrl: defaultSiteUrl }}
                connected={integrations.some((i) => i.provider === d.id)}
                onConnected={() => router.refresh()}
              />
            ))}
          </div>
        </section>
      )}

      {/* Catalog */}
      <section aria-labelledby="int-catalog">
        <SectionHeading
          id="int-catalog"
          title="Available connections"
          description="What you can connect today, and what's on the way."
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...available, ...planned].map((c) => (
            <li key={c.id}>
              <Card as="article" padding="md" className={clsx("flex h-full flex-col gap-2", c.status === "planned" && "bg-surface-2/50")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={clsx(
                        "flex size-9 items-center justify-center rounded-lg [&_svg]:size-[18px]",
                        c.status === "available" ? "bg-primary-soft text-primary-soft-fg" : "bg-surface-3 text-muted",
                      )}
                    >
                      {c.id === "manual" ? <FileDown /> : c.id === "wordpress" ? <Globe /> : <Blocks />}
                    </span>
                    <div>
                      <h3 className="text-small font-semibold text-fg">{c.name}</h3>
                      <p className="text-caption font-normal text-muted">{c.family}</p>
                    </div>
                  </div>
                  {c.status === "available" ? <Badge tone="success">Available</Badge> : <Badge>Planned</Badge>}
                </div>
                <p className="text-small text-fg-soft">{c.description}</p>
                {capabilityMap[c.id]?.limitations?.length ? (
                  <details className="mt-auto text-caption text-muted">
                    <summary className="cursor-pointer font-medium hover:text-fg">Limitations</summary>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 font-normal">
                      {capabilityMap[c.id].limitations.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="int-matrix">
        <SectionHeading
          id="int-matrix"
          title="What each connection can do"
          description="A tick means we can do it for you (after your approval where needed). Planned connections don't have confirmed features yet."
        />
        <Card className="overflow-hidden">
          <CapabilityMatrix catalog={catalog} capabilityMap={capabilityMap} />
        </Card>
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
            Changes waiting to be applied will switch to copy-ready manual steps. Changes already made stay on your site. You may also want to
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
