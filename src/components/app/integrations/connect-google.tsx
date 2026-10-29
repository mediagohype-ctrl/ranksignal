"use client";
// Connect Google Search Console + GA4 (read-only OAuth), pick the property, see sync health, disconnect.
// Shows owner setup instructions when the server has no Google OAuth client configured.
import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, ExternalLink, Link2, Search, Unplug } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Notice, Select, Skeleton, buttonClass } from "@/components/ui";

type Product = "gsc" | "ga4";

interface View {
  product: Product;
  label: string;
  connected: boolean;
  id: string | null;
  googleEmail: string | null;
  siteUrl: string | null;
  propertyId: string | null;
  propertyName: string | null;
  health: string;
  lastSyncAt: string | null;
  lastError: string | null;
  needsSelection: boolean;
}

interface Status {
  configured: boolean;
  message: string | null;
  redirectUri: string;
  items: View[];
}

interface Option {
  id: string;
  label: string;
  detail: string;
}

const BLURB: Record<Product, string> = {
  gsc: "Real clicks, impressions and the searches people use to find you on Google.",
  ga4: "Website visits, key events and visits that came from AI assistants like ChatGPT and Perplexity.",
};

const ERRORS: Record<string, string> = {
  access_denied: "Google access wasn't granted, so nothing was connected.",
  scope_missing: "The read-only data permission was unticked on Google's screen. Please connect again and leave it ticked.",
  no_refresh_token: "Google didn't give us lasting access. Remove this app under your Google account's third-party access, then connect again.",
  invalid_state: "That Google sign-in link expired or was started in another browser. Please try again.",
  not_signed_in: "Please sign in as an admin, then connect again.",
  exchange_failed: "We couldn't finish connecting to Google. Please try again.",
  missing_code: "Google didn't return a sign-in code. Please try again.",
  project_not_found: "That project wasn't found.",
  google_error: "Google reported a problem. Please try again.",
};

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "not yet";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(j?.error?.message ?? "Something went wrong");
  return j as T;
}

function SetupHelp({ redirectUri }: { redirectUri: string }) {
  return (
    <Notice tone="info" title="Google connections need a one-time setup by the site owner">
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>In Google Cloud Console, create a project and configure the OAuth consent screen (External, app name, support email).</li>
        <li>Enable the Google Search Console API, Google Analytics Admin API and Google Analytics Data API.</li>
        <li>
          Create an OAuth client ID of type &quot;Web application&quot; with this authorised redirect URI:{" "}
          <code className="break-all rounded bg-surface px-1 py-0.5 text-xs">{redirectUri}</code>
        </li>
        <li>Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server and restart.</li>
      </ol>
    </Notice>
  );
}

function ProductRow({
  view, projectId, canAdmin, autoPick, onChanged,
}: { view: View; projectId: string; canAdmin: boolean; autoPick: boolean; onChanged: () => void }) {
  const [picking, setPicking] = useState(false);
  const [options, setOptions] = useState<Option[] | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState<"load" | "save" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = view.product === "gsc" ? view.siteUrl : view.propertyId;
  const Icon = view.product === "gsc" ? Search : BarChart3;

  const openPicker = useCallback(async () => {
    setPicking(true);
    setError(null);
    setBusy("load");
    try {
      const r = await api<{ items: Option[]; suggested: string | null; selected: string | null }>(
        `/api/integrations/google/properties?projectId=${encodeURIComponent(projectId)}&product=${view.product}`,
      );
      setOptions(r.items);
      setChoice(r.selected ?? r.suggested ?? r.items[0]?.id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your Google properties");
    } finally {
      setBusy(null);
    }
  }, [projectId, view.product]);

  useEffect(() => {
    if (canAdmin && view.connected && (view.needsSelection || autoPick)) void openPicker();
  }, [canAdmin, view.connected, view.needsSelection, autoPick, openPicker]);

  async function save() {
    if (!choice) return;
    setBusy("save");
    setError(null);
    try {
      await api("/api/integrations/google/select", {
        method: "POST",
        body: JSON.stringify({ projectId, product: view.product, ...(view.product === "gsc" ? { siteUrl: choice } : { propertyId: choice }) }),
      });
      setPicking(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!window.confirm(`Disconnect ${view.label}? We'll revoke our access at Google. Data already collected stays in your reports.`)) return;
    setBusy("disconnect");
    setError(null);
    try {
      await api("/api/integrations/google/disconnect", { method: "POST", body: JSON.stringify({ projectId, product: view.product }) });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't disconnect");
    } finally {
      setBusy(null);
    }
  }

  const startHref = `/api/integrations/google/start?projectId=${encodeURIComponent(projectId)}&product=${view.product}`;
  const healthTone = view.health === "healthy" ? "success" : view.health === "degraded" || view.health === "failed" ? "warning" : "neutral";

  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-soft [&_svg]:size-[18px]">
            <Icon />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-small font-semibold text-fg">{view.label}</h3>
              {view.connected ? (
                <Badge size="sm" tone={healthTone} icon={view.health === "healthy" ? <CheckCircle2 /> : undefined}>
                  {view.needsSelection ? "Choose a property" : view.health === "healthy" ? "Connected" : view.health === "unknown" ? "Connected" : "Needs attention"}
                </Badge>
              ) : (
                <Badge size="sm" tone="neutral">Not connected</Badge>
              )}
              <Badge size="sm" tone="neutral" variant="outline">Read-only</Badge>
            </div>
            <p className="mt-0.5 text-small text-muted">{BLURB[view.product]}</p>
            {view.connected && (
              <p className="mt-1 text-xs text-muted">
                {view.googleEmail ? `Google account ${view.googleEmail}` : "Google account connected"}
                {selected ? ` · ${view.product === "gsc" ? selected : view.propertyName ?? selected}` : ""} · Last sync {when(view.lastSyncAt)}
              </p>
            )}
          </div>
        </div>
        {canAdmin && (
          <div className="flex flex-wrap gap-2">
            {!view.connected ? (
              <a href={startHref} className={buttonClass("primary", "sm")}>
                <Link2 aria-hidden /> Connect
              </a>
            ) : (
              <>
                {!picking && (
                  <Button size="sm" variant="secondary" onClick={() => void openPicker()}>
                    {selected ? "Change property" : "Choose property"}
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon={<Unplug />} loading={busy === "disconnect"} onClick={() => void disconnect()}>
                  Disconnect
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {view.connected && view.lastError && <Notice tone="warning">{view.lastError}</Notice>}

      {picking && canAdmin && (
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          {busy === "load" ? (
            <Skeleton className="h-10 rounded-lg" />
          ) : options && options.length === 0 ? (
            <p className="text-small text-muted">
              {view.product === "gsc" ? (
                <>
                  This Google account has no verified Search Console properties.{" "}
                  <a className="text-primary underline-offset-4 hover:underline" href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">
                    Add your site in Search Console <ExternalLink aria-hidden className="inline size-3" />
                  </a>
                  , then come back.
                </>
              ) : (
                "This Google account has no GA4 properties it can read."
              )}
            </p>
          ) : options ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1 text-small">
                <span className="mb-1 block font-medium text-fg">{view.product === "gsc" ? "Search Console property" : "GA4 property"}</span>
                <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                      {o.detail ? ` — ${o.detail}` : ""}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="flex gap-2">
                <Button size="md" loading={busy === "save"} disabled={!choice} onClick={() => void save()}>
                  Save
                </Button>
                {selected && (
                  <Button size="md" variant="ghost" onClick={() => setPicking(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ) : null}
          {view.product === "gsc" && options && options.length > 0 && (
            <p className="mt-2 text-xs text-muted">We pre-select the property that matches this project&apos;s website when there is one.</p>
          )}
        </div>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
    </li>
  );
}

export function ConnectGoogle({ projectId, canAdmin }: { projectId: string; canAdmin: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ tone: "success" | "danger"; text: string; product?: Product } | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await api<Status>(`/api/integrations/google/status?projectId=${encodeURIComponent(projectId)}`));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load Google connections");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    // Result of the OAuth round trip (?google=gsc or ?google_error=code); then tidy the URL.
    const q = new URLSearchParams(window.location.search);
    const ok = q.get("google");
    const err = q.get("google_error");
    if (ok === "gsc" || ok === "ga4") setFlash({ tone: "success", text: "Google account connected. Now choose the property to read from.", product: ok });
    else if (err) setFlash({ tone: "danger", text: ERRORS[err] ?? ERRORS.google_error! });
    if (ok || err) {
      ["google", "google_error", "product"].forEach((k) => q.delete(k));
      const rest = q.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
    }
  }, [load]);

  return (
    <Card as="section" aria-labelledby="connect-google-title">
      <CardHeader
        icon={<Search />}
        title={<span id="connect-google-title">Google Search Console &amp; Analytics</span>}
        description="Read-only access to your own Google data, so reports show real clicks and visits next to the work done. We never change anything in your Google accounts."
      />
      <CardBody className="space-y-4">
        {flash && <Notice tone={flash.tone}>{flash.text}</Notice>}
        {loadError && <Notice tone="danger">{loadError}</Notice>}
        {!status && !loadError && <Skeleton className="h-24 rounded-xl" />}
        {status && !status.configured && <SetupHelp redirectUri={status.redirectUri} />}
        {status?.configured && (
          <>
            {!canAdmin && <p className="text-small text-muted">Only admins can connect or change Google accounts.</p>}
            <ul className="divide-y divide-border">
              {status.items.map((v) => (
                <ProductRow
                  key={v.product}
                  view={v}
                  projectId={projectId}
                  canAdmin={canAdmin}
                  autoPick={flash?.product === v.product}
                  onChanged={() => void load()}
                />
              ))}
            </ul>
            <p className="text-xs text-muted">
              Data syncs once a day. The first sync loads the last 90 days; Google Search Console reports with a 2–3 day delay.
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}

export default ConnectGoogle;
