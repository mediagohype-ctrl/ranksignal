"use client";
// Public score badge embed snippet (brief §9). Self-contained: reads /api/growth/badge?projectId=…
// Drop into Progress or Project settings: <BadgeEmbed projectId={id} />
// The badge uses the report share link, so it only works while "Share this full report" is on.
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

export function BadgeEmbed({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [state, setState] = useState<BadgeState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/growth/badge?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { item?: BadgeState; error?: { message?: string } } | null;
        if (!res.ok || !data?.item) throw new Error(data?.error?.message ?? "Couldn't load the badge.");
        setState(data.item);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load the badge."));
  }, [projectId]);

  async function copy() {
    if (!state?.html) return;
    try {
      await navigator.clipboard.writeText(state.html);
      toast("Code copied", "success");
    } catch {
      toast("Couldn't copy. Select the code and copy it yourself.", "warning");
    }
  }

  return (
    <Card>
      <CardHeader icon={<Award />} title="Score badge for your website" description="Show your AI-ready score on your website. It updates by itself after each check." />
      <CardBody>
        {!state && !error && <Spinner label="Loading…" />}
        {error && <Notice tone="danger">{error}</Notice>}
        {state && !state.canManage && <p className="text-small text-muted">Only the Owner or an Admin can get the badge code.</p>}
        {state && state.canManage && !state.enabled && (
          <Notice tone="info" title="Turn on sharing first">
            The badge links to your shared report. Open Full report → Share and turn the link on, then come back here.
          </Notice>
        )}
        {state?.enabled && state.html && state.svgUrl && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- our own SVG badge */}
              <img src={state.svgUrl} alt="Your AI-ready score badge" height={20} />
              <span className="text-xs text-muted">Preview</span>
            </div>
            <div>
              <p className="mb-1.5 text-small font-medium text-fg">Paste this code into your website</p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg-soft">{state.html}</pre>
            </div>
            <Button variant="secondary" icon={<Copy />} onClick={copy}>
              Copy code
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
