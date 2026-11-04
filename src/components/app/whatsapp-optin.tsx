"use client";
// WhatsApp updates opt-in card (brief §9). Self-contained: reads and saves /api/growth/whatsapp.
// Drop into Settings: <WhatsAppOptIn canManage={role is Owner or Admin} />
import { useEffect, useState, type FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, Notice, Spinner, useToast } from "@/components/ui";

interface WhatsAppState {
  number: string | null;
  display: string | null;
  optIn: boolean;
}

async function call(body?: { number?: string | null; optIn?: boolean }): Promise<WhatsAppState> {
  const res = await fetch("/api/growth/whatsapp", {
    method: body ? "PATCH" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { item?: WhatsAppState; error?: { message?: string } } | null;
  if (!res.ok || !data?.item) throw new Error(data?.error?.message ?? "Something went wrong. Please try again.");
  return data.item;
}

export function WhatsAppOptIn({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const [state, setState] = useState<WhatsAppState | null>(null);
  const [number, setNumber] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    call()
      .then((s) => {
        setState(s);
        setNumber(s.display ?? "");
        setOptIn(s.optIn);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load your WhatsApp setting."));
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await call({ number: number.trim() || null, optIn });
      setState(s);
      setNumber(s.display ?? "");
      setOptIn(s.optIn);
      toast(s.optIn ? "WhatsApp updates are on" : "WhatsApp updates are off", "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<MessageCircle />}
        title="WhatsApp updates"
        description="Get a short message when your score goes up, and a weekly reminder of fixes waiting."
        actions={
          state && (
            <Badge tone={state.optIn ? "success" : "neutral"} variant="dot">
              {state.optIn ? "On" : "Off"}
            </Badge>
          )
        }
      />
      <CardBody>
        {!state && !error && <Spinner label="Loading…" />}
        {error && (
          <Notice tone="danger" className="mb-4">
            {error}
          </Notice>
        )}
        {state && !canManage && (
          <p className="text-small text-muted">
            {state.optIn ? `Updates go to ${state.display}.` : "WhatsApp updates are off."} Only the Owner or an Admin can change this.
          </p>
        )}
        {state && canManage && (
          <form onSubmit={save} className="space-y-4">
            <Field label="WhatsApp number" htmlFor="wa-number" hint="With the country code, like +91 98765 43210.">
              <Input
                id="wa-number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+91 98765 43210"
                value={number}
                maxLength={32}
                onChange={(e) => setNumber(e.target.value)}
              />
            </Field>
            <label className="flex items-start gap-3 text-small text-fg">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--color-primary)]"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
              />
              <span>Send me updates on WhatsApp. You can turn this off any time.</span>
            </label>
            <Button type="submit" loading={busy} disabled={busy}>
              Save
            </Button>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
