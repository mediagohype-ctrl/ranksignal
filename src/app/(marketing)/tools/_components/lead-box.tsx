"use client";
// Optional email box under each free tool: saves a Lead (source "tool:<name>") via /api/public/tool-lead.
import { useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { Button, Input } from "@/components/ui";
import type { ToolName } from "@/lib/growth/tools";

export function LeadBox({ tool, title = "Get one easy tip a week", body = "We'll email you one simple fix each week to help Google and AI find your business. No spam. Leave any time." }: { tool: ToolName; title?: string; body?: string }) {
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("That doesn't look like an email address. Check it and try again.");
      return;
    }
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/public/tool-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, email: email.trim(), ...(trap ? { website: trap } : {}) }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(data?.error?.message ?? "We couldn't save your email. Please try again.");
      }
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save your email. Please try again.");
      setState("idle");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg [&_svg]:size-5">
          <Mail />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-h4 text-fg">{title}</h2>
          <p className="mt-1 text-small text-muted">{body}</p>
          {state === "done" ? (
            <p className="mt-4 text-small font-medium text-success" role="status">
              Thanks! Your first tip is on its way.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <label htmlFor={`lead-${tool}`} className="sr-only">
                Your email
              </label>
              <Input id={`lead-${tool}`} type="email" autoComplete="email" placeholder="you@business.com" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} className="sm:flex-1" />
              {/* Hidden from people; bots fill it. */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} className="hidden" aria-hidden />
              <Button type="submit" loading={state === "busy"} disabled={state === "busy"}>
                Send me tips
              </Button>
            </form>
          )}
          {error && (
            <p className="mt-2 text-small text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
