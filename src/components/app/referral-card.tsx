"use client";
// "Invite a business, get a free month" card (brief §9 referral). Self-contained: reads GET /api/referral.
// Drop into Settings → Billing (or anywhere): <ReferralCard />
import { useEffect, useState } from "react";
import { Copy, Gift } from "lucide-react";
import { REFERRAL_TERMS, REFERRAL_TITLE } from "@/lib/growth/referral-copy";
import { Button, Card, CardBody, CardHeader, Notice, Spinner, useToast } from "@/components/ui";

interface ReferralState {
  code: string;
  link: string;
  signedUp: number;
  paying: number;
  freeMonthsEarned: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** `compact`: the small one-row version for Home (the full card lives in Project settings). */
export function ReferralCard({ compact = false }: { compact?: boolean } = {}) {
  const toast = useToast();
  const [state, setState] = useState<ReferralState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/referral", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { item?: ReferralState; error?: { message?: string } } | null;
        if (!res.ok || !data?.item) throw new Error(data?.error?.message ?? "Couldn't load your invite link.");
        setState(data.item);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't load your invite link."));
  }, []);

  async function copy() {
    if (!state) return;
    try {
      await navigator.clipboard.writeText(state.link);
      toast("Link copied", "success");
    } catch {
      toast("Couldn't copy. Select the link and copy it yourself.", "warning");
    }
  }

  const whatsapp = state
    ? `https://wa.me/?text=${encodeURIComponent(`I use this to see what Google and ChatGPT say about my business. Try it free: ${state.link}`)}`
    : "#";

  if (compact) {
    // Home: stay out of the way — nothing while loading or if the link can't be loaded.
    if (!state) return null;
    return (
      <Card variant="subtle" padding="md" as="aside" aria-label={REFERRAL_TITLE}>
        <div className="flex flex-wrap items-center gap-3">
          <Gift aria-hidden size={20} className="shrink-0 text-primary" />
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-small font-medium text-fg">{REFERRAL_TITLE}</p>
            <p className="text-xs text-muted">{REFERRAL_TERMS}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="secondary" icon={<Copy />} onClick={copy}>
              Copy invite link
            </Button>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="text-small font-medium text-primary hover:underline">
              Share on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader icon={<Gift />} title={REFERRAL_TITLE} description={REFERRAL_TERMS} />
      <CardBody>
        {!state && !error && <Spinner label="Loading…" />}
        {error && <Notice tone="danger">{error}</Notice>}
        {state && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-4 py-3">
              <code className="min-w-0 flex-1 break-all text-small text-fg">{state.link}</code>
              <Button size="sm" variant="secondary" icon={<Copy />} onClick={copy}>
                Copy link
              </Button>
            </div>
            <p className="text-small text-muted">
              {plural(state.signedUp, "business has", "businesses have")} joined with your link · {plural(state.freeMonthsEarned, "free month", "free months")} earned
            </p>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex text-small font-medium text-primary hover:underline">
              Share on WhatsApp
            </a>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
