"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { Button, useToast } from "@/components/ui";

export function CopyBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="max-h-96 overflow-auto rounded-xl border border-border bg-surface-2 p-3 pr-12 text-xs leading-relaxed text-fg">
        <code>{text}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute right-2 top-2"
        aria-label={copied ? "Copied" : label}
        title={label}
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

/** Create / rotate / revoke the project's ingest token. The full token is shown once. */
export function IngestToken({ projectId, prefix, lastUsedAt, canManage }: { projectId: string; prefix: string | null; lastUsedAt: string | null; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  async function rotate() {
    if (prefix && !confirm("Make a new token? The old one stops working straight away, so update your Worker's secret too.")) return;
    setBusy(true);
    try {
      const r = await api<{ item: { token: string } }>(`/api/projects/${projectId}/ai-bots/token`, { method: "POST", body: {} });
      setToken(r.item.token);
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!confirm("Turn off live logging? Your Worker's requests will be refused from now on.")) return;
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/ai-bots/token`, { method: "DELETE" });
      setToken(null);
      toast("Live logging turned off.", "success");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-small text-fg-soft">
        {prefix
          ? `Token ${prefix}… is active${lastUsedAt ? `; last used ${new Date(lastUsedAt).toLocaleString("en-IN")}` : "; not used yet"}.`
          : "No token yet. Live logging is off."}
      </p>
      {token && (
        <div className="space-y-2">
          <p className="text-small font-medium text-fg">Your new token. Copy it now; we can&apos;t show it again.</p>
          <CopyBlock text={token} label="Copy token" />
        </div>
      )}
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<KeyRound />} onClick={() => void rotate()} disabled={busy}>
            {prefix ? "Make a new token" : "Create token"}
          </Button>
          {prefix && (
            <Button variant="ghost" onClick={() => void revoke()} disabled={busy}>
              Turn off
            </Button>
          )}
        </div>
      ) : (
        <p className="text-small text-muted">Only admins can create or change the token.</p>
      )}
    </div>
  );
}
