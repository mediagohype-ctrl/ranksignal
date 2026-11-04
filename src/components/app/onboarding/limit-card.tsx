"use client";
// Shown before setup screen 1 when the plan's website limit is already used: Upgrade, or replace a current website
// (confirm, delete the old project, then continue setup).
import { useState } from "react";
import { ArrowUpRight, RefreshCw, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { BRAND } from "@/lib/brand";
import { Button, Card, CardBody, Dialog, LinkButton, Notice } from "@/components/ui";

export interface LimitInfo {
  planName: string;
  maxProjects: number;
  projects: { id: string; name: string; websiteUrl: string }[];
  /** Owner/Admin: may delete a project to make room. */
  canManage: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function LimitCard({ limit, onReplaced }: { limit: LimitInfo; onReplaced: () => void }) {
  const [chosen, setChosen] = useState(limit.projects[0]?.id ?? "");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = limit.projects.find((p) => p.id === chosen);

  async function replace() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/projects/${encodeURIComponent(target.id)}`, { method: "DELETE" });
      setConfirming(false);
      onReplaced();
    } catch (e) {
      setError(errorMessage(e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card variant="elevated">
      <CardBody className="space-y-5">
        <div>
          <h1 className="text-h3 text-fg">Your plan is full</h1>
          <p className="mt-1 text-body text-muted">
            Your {limit.planName} plan includes {plural(limit.maxProjects, "website", "websites")}. Upgrade to add another, or replace{" "}
            {limit.projects.length === 1 ? "your current website" : "one of your websites"}.
          </p>
        </div>

        {limit.canManage && limit.projects.length > 1 && (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-small font-medium text-fg">Which website should we replace?</legend>
            {limit.projects.map((p) => (
              <label
                key={p.id}
                className={
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-surface-2 " +
                  (chosen === p.id ? "border-primary bg-primary-soft" : "border-border")
                }
              >
                <input type="radio" name="replace" className="size-4 accent-[var(--primary)]" checked={chosen === p.id} onChange={() => setChosen(p.id)} />
                <span className="min-w-0">
                  <span className="block truncate text-small font-medium text-fg">{p.name}</span>
                  <span className="block truncate text-xs text-muted">{hostOf(p.websiteUrl)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {error && (
          <Notice tone="danger" title="We couldn't replace the website">
            {error} Try again, or contact us at{" "}
            <a className="font-medium text-primary hover:underline" href={`mailto:${BRAND.supportEmail}`}>
              {BRAND.supportEmail}
            </a>
            .
          </Notice>
        )}

        <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
          <LinkButton href="/app/settings?tab=billing" size="lg" iconRight={<ArrowUpRight />} className="w-full sm:w-auto">
            Upgrade
          </LinkButton>
          {limit.canManage && target && (
            <Button variant="secondary" size="lg" icon={<RefreshCw />} onClick={() => setConfirming(true)} className="w-full sm:w-auto">
              Replace current website
            </Button>
          )}
        </div>
        {!limit.canManage && <p className="text-small text-muted">Only the Owner or an Admin can replace a website. Ask them, or upgrade.</p>}
      </CardBody>

      <Dialog
        open={confirming}
        onClose={() => !busy && setConfirming(false)}
        tone="danger"
        icon={<Trash2 />}
        title={`Replace ${target ? hostOf(target.websiteUrl) : "this website"}?`}
        description="We'll delete it and all its results, questions and fixes, then set up your new website. This can't be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" onClick={replace} loading={busy} loadingText="Deleting…">
              Delete and continue
            </Button>
          </>
        }
      />
    </Card>
  );
}
