"use client";
// Public score badge embed code (brief §9). Self-contained: reads / writes /api/growth/badge.
// Used on Progress and inside the Full report's Share dialog ("Show your score on your website").
// The badge has its own on/off switch: it does NOT need the report share link, and turning the share link off never
// breaks a badge already on a website.
import { useEffect, useState } from "react";
import { Award, Copy } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Notice, Spinner, useToast } from "@/components/ui";

interface BadgeState {
  enabled: boolean;
  canManage: boolean;
  svgUrl: string | null;
  reportUrl: string | null;
  html: string | null;
  markdown: string | null;
}

export const BADGE_TITLE = "Show your score on your website";
const BADGE_DESCRIPTION = "A small Found Score badge for your website. It updates by itself after each check.";

async function call(projectId: string, enabled?: boolean): Promise<BadgeState> {
  const res = await fetch(
    enabled === undefined ? `/api/growth/badge?projectId=${encodeURIComponent(projectId)}` : "/api/growth/badge",
    enabled === undefined
      ? { cache: "no-store" }
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, enabled }), cache: "no-store" },
  );
  const data = (await res.json().catch(() => null)) as { item?: BadgeState; error?: { message?: string } } | null;
  if (!res.ok || !data?.item) throw new Error(data?.error?.message ?? "Couldn't load the badge.");
  return data.item;
}

/** `bare`: no card around it (for use inside a dialog). */
export function BadgeEmbed({ projectId, bare = false }: { projectId: string; bare?: boolean }) {
  const toast = useToast();
  const [state, setState] = useState<BadgeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call(projectId)
      .then(setState)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load the badge."));
  }, [projectId]);

  async function toggle(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      setState(await call(projectId, enabled));
      toast(enabled ? "Badge is on" : "Badge is off — it now shows “not checked” on your website", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!state?.html) return;
    try {
      await navigator.clipboard.writeText(state.html);
      toast("Code copied", "success");
    } catch {
      toast("Couldn't copy. Select the code and copy it yourself.", "warning");
    }
  }

  const body = (
    <>
      {!state && !error && <Spinner label="Loading…" />}
      {error && <Notice tone="danger">{error}</Notice>}
      {state && !state.canManage && <p className="text-small text-muted">Only the Owner or an Admin can get the badge code.</p>}
      {state && state.canManage && !state.enabled && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-small text-muted">
            Turn the badge on to get a short piece of code to paste into your website. You don&apos;t need to share your report for this.
          </p>
          <Button size="sm" icon={<Award />} loading={busy} onClick={() => toggle(true)}>
            Turn on badge
          </Button>
        </div>
      )}
      {state?.enabled && state.html && state.svgUrl && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- our own SVG badge */}
            <img src={state.svgUrl} alt="Your Found Score badge" height={20} />
            <span className="text-xs text-muted">Preview</span>
          </div>
          <div>
            <p className="mb-1.5 text-small font-medium text-fg">Paste this code into your website</p>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg-soft">{state.html}</pre>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon={<Copy />} onClick={copy}>
              Copy code
            </Button>
            <Button variant="ghost" size="sm" loading={busy} onClick={() => toggle(false)}>
              Turn off badge
            </Button>
          </div>
          <p className="text-xs text-muted">
            The badge keeps working if you turn your report link off. Clicking it opens your shared report while sharing is on, and our
            home page when it&apos;s off.
          </p>
        </div>
      )}
    </>
  );

  if (bare) {
    return (
      <section aria-label={BADGE_TITLE} className="space-y-3">
        <div>
          <p className="text-small font-medium text-fg">{BADGE_TITLE}</p>
          <p className="text-xs text-muted">{BADGE_DESCRIPTION}</p>
        </div>
        {body}
      </section>
    );
  }
  return (
    <Card>
      <CardHeader icon={<Award />} title={BADGE_TITLE} description={BADGE_DESCRIPTION} />
      <CardBody>{body}</CardBody>
    </Card>
  );
}
