"use client";
// Settings → Branding. White-label shared reports, monthly reports and report emails.
// The server re-validates everything (src/lib/branding.ts); the checks here are only for instant feedback.
import { useMemo, useState } from "react";
import { Eye, ImageOff, Mail, Palette, Sparkles } from "lucide-react";
import { BRAND } from "@/lib/brand";
import type { Branding, StoredBranding } from "@/lib/branding";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Field,
  Input,
  LinkButton,
  Notice,
  Textarea,
  fieldDescribedBy,
  useToast,
} from "@/components/ui";

export interface BrandingPanelProps {
  eligible: boolean;
  canHidePoweredBy: boolean;
  canManage: boolean;
  stored: StoredBranding | null;
  orgName: string;
}

const FOOTER_MAX = 200;

// Mirrors normalizeHex/contrastRatio in src/lib/branding.ts (that module is server-only: it imports the db client).
function hex(v: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return null;
  const h = m[1]!.toLowerCase();
  return `#${h.length === 3 ? h.split("").map((c) => c + c).join("") : h}`;
}
function contrastOnWhite(h: string): number {
  const n = parseInt(h.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (l + 0.05);
}
function httpsUrl(v: string): string | null {
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

interface FormState {
  displayName: string;
  logoUrl: string;
  accentColor: string;
  replyTo: string;
  footerText: string;
  hidePoweredBy: boolean;
}

export function BrandingPanel({ eligible, canHidePoweredBy, canManage, stored, orgName }: BrandingPanelProps) {
  const toast = useToast();
  const [f, setF] = useState<FormState>({
    displayName: stored?.displayName ?? "",
    logoUrl: stored?.logoUrl ?? "",
    accentColor: stored?.accentColor ?? "",
    replyTo: stored?.replyTo ?? "",
    footerText: stored?.footerText ?? "",
    hidePoweredBy: stored?.hidePoweredBy ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoBroken, setLogoBroken] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const accent = hex(f.accentColor);
  const ratio = accent ? contrastOnWhite(accent) : null;
  const errors = useMemo(
    () => ({
      logoUrl: f.logoUrl.trim() && !httpsUrl(f.logoUrl) ? "Use an https:// link to an image (data: and http: links aren't allowed)." : undefined,
      accentColor: f.accentColor.trim()
        ? !accent
          ? "Use a hex colour like #1f6feb."
          : ratio !== null && ratio < 4.5
            ? `Too light to read on white (${ratio.toFixed(1)}:1). Pick a darker shade — it needs 4.5:1.`
            : undefined
        : undefined,
      replyTo: f.replyTo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.replyTo.trim()) ? "Enter a valid email address." : undefined,
      footerText: f.footerText.length > FOOTER_MAX ? `Keep it under ${FOOTER_MAX} characters.` : undefined,
    }),
    [f, accent, ratio],
  );
  const invalid = Object.values(errors).some(Boolean);

  const preview: Pick<Branding, "displayName" | "logoUrl" | "accentColor" | "footerText" | "hidePoweredBy"> = {
    displayName: f.displayName.trim() || BRAND.name,
    logoUrl: httpsUrl(f.logoUrl) && !logoBroken ? httpsUrl(f.logoUrl) : null,
    accentColor: !errors.accentColor && accent ? accent : null,
    footerText: f.footerText.trim() || null,
    hidePoweredBy: canHidePoweredBy && f.hidePoweredBy,
  };

  if (!eligible) {
    return (
      <Card>
        <CardHeader icon={<Palette />} title="Branding" description="Put your own name, logo and colour on reports and report emails." />
        <CardBody className="space-y-4">
          <Notice tone="info" icon={<Sparkles />} title="Available on the Agency plan and done-for-you services">
            White-label reports let agencies send client reports under their own name and logo. Upgrade to Agency, or talk to us
            about a done-for-you plan, to turn it on.
          </Notice>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/app/settings?tab=billing" size="sm">
              See plans
            </LinkButton>
            <LinkButton href="/contact?topic=services" variant="secondary" size="sm">
              Ask about done-for-you
            </LinkButton>
          </div>
        </CardBody>
      </Card>
    );
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (invalid) return setError("Fix the highlighted fields first.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/org/branding", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: f.displayName,
          logoUrl: f.logoUrl,
          accentColor: f.accentColor,
          replyTo: f.replyTo,
          footerText: f.footerText,
          ...(canHidePoweredBy ? { hidePoweredBy: f.hidePoweredBy } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } };
      };
      if (!res.ok) {
        const fe = data.error?.details?.fieldErrors;
        const first = fe ? Object.entries(fe).find(([, v]) => v?.length) : undefined;
        throw new Error(first ? first[1][0] : (data.error?.message ?? "Couldn't save branding"));
      }
      toast("Branding saved", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save branding");
    } finally {
      setBusy(false);
    }
  }

  const id = (k: string) => `branding-${k}`;
  const disabled = !canManage;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card as="section">
        <CardHeader
          icon={<Palette />}
          title="Branding"
          description="Used on shared report links, monthly reports and monthly report emails."
          actions={<Badge tone="success" variant="dot">Included in your plan</Badge>}
        />
        <form onSubmit={save} noValidate>
          <CardBody className="space-y-5">
            {!canManage && (
              <Notice tone="neutral" title="View only">
                Only owners and admins can change branding.
              </Notice>
            )}
            {error && (
              <Notice tone="danger" title="Couldn't save">
                {error}
              </Notice>
            )}
            <Field label="Name on reports" htmlFor={id("name")} optional hint={`Defaults to ${BRAND.name}. For example “${orgName}”.`}>
              <Input
                id={id("name")}
                value={f.displayName}
                maxLength={80}
                disabled={disabled}
                onChange={(e) => set("displayName", e.target.value)}
                aria-describedby={fieldDescribedBy(id("name"), { hint: true })}
              />
            </Field>
            <Field label="Logo link" htmlFor={id("logo")} optional hint="An https:// link to a PNG, JPG or SVG, ideally about 64px tall." error={errors.logoUrl}>
              <Input
                id={id("logo")}
                type="url"
                inputMode="url"
                placeholder="https://youragency.com/logo.png"
                value={f.logoUrl}
                disabled={disabled}
                invalid={!!errors.logoUrl}
                onChange={(e) => {
                  set("logoUrl", e.target.value);
                  setLogoBroken(false);
                }}
                aria-describedby={fieldDescribedBy(id("logo"), { hint: true, error: errors.logoUrl })}
              />
            </Field>
            <Field
              label="Accent colour"
              htmlFor={id("accent")}
              optional
              hint="Hex code. Must be dark enough to read on white."
              error={errors.accentColor}
              labelAside={ratio !== null && !errors.accentColor ? <span className="text-xs text-muted tabular-nums">{ratio.toFixed(1)}:1 contrast</span> : undefined}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-9 shrink-0 rounded-lg border border-border"
                  style={accent ? { background: accent } : undefined}
                />
                <Input
                  id={id("accent")}
                  placeholder="#1f6feb"
                  value={f.accentColor}
                  maxLength={7}
                  disabled={disabled}
                  invalid={!!errors.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  aria-describedby={fieldDescribedBy(id("accent"), { hint: true, error: errors.accentColor })}
                />
              </div>
            </Field>
            <Field label="Reply-to email" htmlFor={id("reply")} optional hint="Replies to report emails go here instead of to us." error={errors.replyTo}>
              <Input
                id={id("reply")}
                type="email"
                placeholder="reports@youragency.com"
                value={f.replyTo}
                disabled={disabled}
                invalid={!!errors.replyTo}
                onChange={(e) => set("replyTo", e.target.value)}
                aria-describedby={fieldDescribedBy(id("reply"), { hint: true, error: errors.replyTo })}
              />
            </Field>
            <Field
              label="Footer text"
              htmlFor={id("footer")}
              optional
              hint="One short line, e.g. your address or phone number."
              error={errors.footerText}
              labelAside={<span className="text-xs text-muted tabular-nums">{f.footerText.length}/{FOOTER_MAX}</span>}
            >
              <Textarea
                id={id("footer")}
                rows={2}
                value={f.footerText}
                disabled={disabled}
                invalid={!!errors.footerText}
                onChange={(e) => set("footerText", e.target.value)}
                aria-describedby={fieldDescribedBy(id("footer"), { hint: true, error: errors.footerText })}
              />
            </Field>
            <label className="flex items-start gap-3 text-small text-fg-soft">
              <input
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-primary"
                checked={canHidePoweredBy && f.hidePoweredBy}
                disabled={disabled || !canHidePoweredBy}
                onChange={(e) => set("hidePoweredBy", e.target.checked)}
              />
              <span>
                <span className="font-medium text-fg">Hide “Powered by {BRAND.name}”</span>
                <span className="block text-xs text-muted">
                  {canHidePoweredBy ? "Removes our name from shared reports and emails." : "Available on the Agency plan."}
                </span>
              </span>
            </label>
          </CardBody>
          {canManage && (
            <CardFooter>
              <div className="flex w-full justify-end gap-2">
                <Button type="submit" loading={busy} loadingText="Saving…" disabled={invalid}>
                  Save branding
                </Button>
              </div>
            </CardFooter>
          )}
        </form>
      </Card>

      <div className="space-y-6">
        <Card as="section" aria-label="Report header preview">
          <CardHeader icon={<Eye />} title="Report preview" description="How the top and bottom of a shared report will look." />
          <CardBody className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-border bg-bg">
              <div className="h-1" style={{ background: preview.accentColor ?? "var(--primary)" }} aria-hidden />
              <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
                <BrandMark name={preview.displayName} logoUrl={preview.logoUrl} onBroken={() => setLogoBroken(true)} />
                <Badge tone="neutral" size="sm">Shared report · read only</Badge>
              </div>
              <div className="space-y-1 px-4 py-4">
                <p className="eyebrow" style={preview.accentColor ? { color: preview.accentColor } : undefined}>
                  Monthly impact report
                </p>
                <p className="text-h4 text-fg">October 2026 · Client website</p>
                <div className="mt-3 h-2 w-2/3 rounded-full bg-surface-3" aria-hidden />
                <div className="h-2 w-1/2 rounded-full bg-surface-3" aria-hidden />
              </div>
              <div className="border-t border-border bg-surface px-4 py-3 text-xs text-muted">
                Report by <span className="font-semibold text-fg-soft">{preview.displayName}</span>
                {preview.footerText && <> · {preview.footerText}</>}
                {!preview.hidePoweredBy && preview.displayName !== BRAND.name && <> · Powered by {BRAND.name}</>}
              </div>
            </div>
            {f.logoUrl && logoBroken && (
              <p className="flex items-center gap-1.5 text-xs text-warning">
                <ImageOff aria-hidden className="size-3.5" /> We couldn&apos;t load that logo. Check the link opens an image.
              </p>
            )}
          </CardBody>
        </Card>

        <Card as="section" aria-label="Email preview">
          <CardHeader icon={<Mail />} title="Email preview" description="Monthly report emails use the same name, logo and colour." />
          <CardBody>
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="mb-3 border-t-4 pt-2" style={{ borderColor: preview.accentColor ?? "var(--primary)" }}>
                <BrandMark name={preview.displayName} logoUrl={preview.logoUrl} />
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-h4 text-fg">October 2026 impact report</p>
                <p className="mt-2 text-small text-fg-soft">Website score: 61 → 68 out of 100. Work shipped: 9.</p>
                <span
                  className="mt-3 inline-block rounded-lg px-3 py-1.5 text-small font-semibold text-primary-fg"
                  style={{ background: preview.accentColor ?? "var(--primary)" }}
                >
                  Open the full report
                </span>
              </div>
              <p className="mt-3 text-xs text-muted">
                {preview.footerText && (
                  <>
                    {preview.footerText}
                    <br />
                  </>
                )}
                {preview.displayName}
                {!preview.hidePoweredBy && preview.displayName !== BRAND.name && <> · Sent with {BRAND.name}</>}
                {f.replyTo.trim() && !errors.replyTo && <> · Replies go to {f.replyTo.trim()}</>}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function BrandMark({ name, logoUrl, onBroken }: { name: string; logoUrl: string | null; onBroken?: () => void }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- customer logo from an arbitrary https host
        <img src={logoUrl} alt="" referrerPolicy="no-referrer" className="h-7 w-auto max-w-[140px] object-contain" onError={onBroken} />
      )}
      <span className="truncate text-small font-semibold text-fg">{name}</span>
    </span>
  );
}
