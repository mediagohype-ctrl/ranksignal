"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Send, ShieldCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { Button, Textarea, useToast } from "@/components/ui";

export function VerifyButton({ projectId, verified }: { projectId: string; verified: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <Button
        icon={<ShieldCheck />}
        variant={verified ? "secondary" : "primary"}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const r = await api<{ item: { ok: boolean; message: string } }>(`/api/projects/${projectId}/indexnow/verify`, { method: "POST", body: {} });
            setMsg({ ok: r.item.ok, text: r.item.ok ? "Key file found. IndexNow is on." : r.item.message });
            router.refresh();
          } catch (e) {
            toast(errorMessage(e), "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking…" : verified ? "Check key file again" : "Check key file and turn on"}
      </Button>
      {msg && (
        <p role="status" className={msg.ok ? "text-small text-success" : "text-small text-danger"}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export function TriggerToggles({ projectId, onFixPublished, onCrawlChanges, enabled }: { projectId: string; onFixPublished: boolean; onCrawlChanges: boolean; enabled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function patch(body: Record<string, unknown>, ok?: string) {
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/indexnow`, { method: "PATCH", body });
      if (ok) toast(ok, "success");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-3 text-small text-fg">
        <input type="checkbox" className="mt-1" checked={onFixPublished} disabled={busy} onChange={(e) => void patch({ onFixPublished: e.target.checked })} />
        <span>When a fix you approved is published to a page</span>
      </label>
      <label className="flex items-start gap-3 text-small text-fg">
        <input type="checkbox" className="mt-1" checked={onCrawlChanges} disabled={busy} onChange={(e) => void patch({ onCrawlChanges: e.target.checked })} />
        <span>When a website check finds new or changed pages</span>
      </label>
      <div className="flex flex-wrap gap-2 pt-1">
        {enabled && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void patch({ enabled: false }, "IndexNow turned off.")}>
            Turn off IndexNow
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw />}
          disabled={busy}
          onClick={() => {
            if (confirm("Make a new key? IndexNow stays off until you upload the new key file and check it again.")) void patch({ rotateKey: true }, "New key created. Upload the new file, then check it.");
          }}
        >
          Make a new key
        </Button>
      </div>
    </div>
  );
}

export function ManualSubmit({ projectId, host }: { projectId: string; host: string }) {
  const router = useRouter();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const urls = text.split(/\s+/).map((s) => s.trim()).filter(Boolean).slice(0, 100);
        if (!urls.length) return;
        setBusy(true);
        try {
          const r = await api<{ item: { queued: number } }>(`/api/projects/${projectId}/indexnow/submit`, { body: { urls } });
          toast(`${r.item.queued} page${r.item.queued === 1 ? "" : "s"} queued. They're sent within a couple of minutes.`, "success");
          setText("");
          router.refresh();
        } catch (err) {
          toast(errorMessage(err), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="indexnow-urls" className="text-small font-medium text-fg">
        Send specific pages now (one address per line, up to 100)
      </label>
      <Textarea id="indexnow-urls" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={`https://${host}/new-page`} />
      <Button type="submit" variant="secondary" size="sm" icon={<Send />} disabled={busy || !text.trim()}>
        {busy ? "Sending…" : "Send to search engines"}
      </Button>
    </form>
  );
}
