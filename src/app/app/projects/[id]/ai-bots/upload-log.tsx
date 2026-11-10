"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button, useToast } from "@/components/ui";

const MAX_BYTES = 50 * 1024 * 1024;

interface UploadResult {
  linesTotal: number;
  botHits: number;
  firstDate: string | null;
  lastDate: string | null;
  verifiedAgainst: string[];
}

/** Sends the raw file as the request body (streamed server-side; nothing but daily counts is kept). */
export function UploadLog({ projectId }: { projectId: string }) {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function send(file: File) {
    if (file.size > MAX_BYTES) {
      toast("The limit is 50 MB. Upload a shorter period, or gzip the file first (.gz).", "error");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/ai-bots/upload`, {
        method: "POST",
        headers: { "content-type": "application/octet-stream", "x-file-name": encodeURIComponent(file.name) },
        body: file,
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => null)) as { item?: UploadResult; error?: { message?: string } } | null;
      if (!res.ok || !data?.item) throw new Error(data?.error?.message ?? `Upload failed (${res.status}).`);
      const r = data.item;
      const range = r.firstDate ? (r.firstDate === r.lastDate ? ` on ${r.firstDate}` : ` from ${r.firstDate} to ${r.lastDate}`) : "";
      setResult(
        r.botHits > 0
          ? `Read ${r.linesTotal.toLocaleString("en-IN")} lines and found ${r.botHits.toLocaleString("en-IN")} crawler visits${range}.`
          : `Read ${r.linesTotal.toLocaleString("en-IN")} lines but found no AI or search crawler visits. Check that this is an access log with user agents (the "combined" format).`,
      );
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed. Please try again.", "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={input}
        type="file"
        accept=".log,.txt,.gz,.json,.jsonl,text/plain,application/gzip"
        className="sr-only"
        aria-label="Choose an access log file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void send(f);
        }}
      />
      <Button onClick={() => input.current?.click()} disabled={busy} icon={<Upload />}>
        {busy ? "Reading your log…" : "Upload access log"}
      </Button>
      {result && <p className="text-small text-fg-soft" role="status">{result}</p>}
    </div>
  );
}
