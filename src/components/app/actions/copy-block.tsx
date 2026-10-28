"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, useToast } from "@/components/ui";

/** Pre-formatted text with a copy button (used for manual instructions and briefs). */
export function CopyBlock({ text, label, maxHeight = "20rem" }: { text: string; label: string; maxHeight?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Copied to clipboard.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn't copy automatically — select the text and copy it instead.", "warning");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="text-caption uppercase tracking-[0.06em] text-muted">{label}</span>
        <Button variant="ghost" size="xs" icon={copied ? <Check /> : <Copy />} onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre
        className="overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-fg-soft"
        style={{ maxHeight }}
        tabIndex={0}
      >
        {text}
      </pre>
    </div>
  );
}
