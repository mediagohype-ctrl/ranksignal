"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, Link2Off, RefreshCw, Share2 } from "lucide-react";
import { Badge, Button, Dialog, Field, Input, Notice, Spinner, useToast } from "@/components/ui";

interface ShareState {
  enabled: boolean;
  url: string | null;
  canManage: boolean;
}

async function call(projectId: string, body?: { enabled?: boolean; rotate?: true }): Promise<ShareState> {
  const res = await fetch(`/api/projects/${projectId}/share`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { item?: ShareState; error?: { message?: string } } | null;
  if (!res.ok || !data?.item) throw new Error(data?.error?.message ?? "Something went wrong");
  return data.item;
}

/** "Share" button + dialog: create / copy / rotate / turn off a read-only client link. Admins manage; others see a hint. */
export function ShareReportButton({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ShareState | null>(null);
  const [busy, setBusy] = useState<null | "toggle" | "rotate">(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setState(await call(projectId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load sharing settings");
    }
  }, [projectId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function update(body: { enabled?: boolean; rotate?: true }, kind: "toggle" | "rotate") {
    setBusy(kind);
    setError(null);
    try {
      const next = await call(projectId, body);
      setState(next);
      setConfirmRotate(false);
      toast(
        kind === "rotate" ? "New link created — the old link no longer works" : next.enabled ? "Sharing is on" : "Sharing is off — the link no longer works",
        "success",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!state?.url) return;
    try {
      await navigator.clipboard.writeText(state.url);
      toast("Link copied", "success");
    } catch {
      toast("Couldn't copy — select the link and copy it manually", "warning");
    }
  }

  return (
    <>
      <Button variant="secondary" icon={<Share2 />} onClick={() => setOpen(true)}>
        Share
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Share this report"
        description="Anyone with the link can view a read-only copy of this report — no sign-in needed. It always shows your latest results."
        icon={<Share2 />}
        footer={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-5">
          {error && <Notice tone="danger">{error}</Notice>}
          {!state && !error && <Spinner label="Loading sharing settings…" />}

          {state && !canManage && (
            <Notice tone="info" title={state.enabled ? "Sharing is on for this project" : "Sharing is off"}>
              Only admins and owners can create, copy or turn off share links. Ask an admin in your team if you need one.
            </Notice>
          )}

          {state && canManage && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-small font-medium text-fg">Public link</p>
                  <p className="text-xs text-muted">
                    {state.enabled ? "Anyone with the link can view the report." : "Turned off. Nobody can open a link to this report."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={state.enabled ? "success" : "neutral"} variant="dot">
                    {state.enabled ? "On" : "Off"}
                  </Badge>
                  <Button
                    size="sm"
                    variant={state.enabled ? "secondary" : "primary"}
                    icon={state.enabled ? <Link2Off /> : <Link2 />}
                    loading={busy === "toggle"}
                    disabled={busy !== null}
                    onClick={() => update({ enabled: !state.enabled }, "toggle")}
                  >
                    {state.enabled ? "Turn off" : "Create link"}
                  </Button>
                </div>
              </div>

              {state.enabled && state.url && (
                <>
                  <Field label="Share link" htmlFor="share-url" hint="Send this to your client. The page is hidden from search engines.">
                    <div className="flex gap-2">
                      <Input id="share-url" readOnly value={state.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
                      <Button icon={<Copy />} onClick={copy} disabled={busy !== null}>
                        Copy
                      </Button>
                    </div>
                  </Field>

                  {confirmRotate ? (
                    <Notice
                      tone="warning"
                      title="Replace the link?"
                      actions={
                        <>
                          <Button size="sm" variant="secondary" onClick={() => setConfirmRotate(false)} disabled={busy !== null}>
                            Cancel
                          </Button>
                          <Button size="sm" loading={busy === "rotate"} onClick={() => update({ rotate: true }, "rotate")}>
                            Create new link
                          </Button>
                        </>
                      }
                    >
                      Anyone using the current link will lose access straight away. You&apos;ll need to send the new link again.
                    </Notice>
                  ) : (
                    <Button variant="ghost" size="sm" icon={<RefreshCw />} onClick={() => setConfirmRotate(true)} disabled={busy !== null}>
                      Replace with a new link
                    </Button>
                  )}
                </>
              )}
              <p className="text-xs text-muted">
                Shared reports show scores, issues and fixes, and AI visibility numbers. They never show your team, settings, raw AI answers
                or the Actions center. Turning sharing off and on again re-activates the same link; replace it to cut off old copies for good.
              </p>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
