"use client";
// "Buy more answers": one-time AI-answer top-up packs (not autopay; the plan doesn't change). The dialog lists the
// packs with price + GST + total and validity, opens Razorpay Checkout for an ORDER, then waits until the signed
// webhook has added the answers (the browser callback alone never adds them).
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { CheckCircle2, Clock, PackagePlus, Plus } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { fmtDate } from "@/lib/dashboard/format";
import { formatInr } from "@/lib/billing/gst";
import { BRAND } from "@/lib/brand";
import { Badge, Button, Card, CardBody, CardHeader, Dialog, Notice, Skeleton, type ButtonSize, type ButtonVariant } from "@/components/ui";
import { openRazorpayOrder, type CheckoutSuccess } from "./topup-checkout";

/** Mirrors TopUpOverview in src/lib/billing/topup-service.ts (JSON dates as strings). */
export interface TopUpOverviewJson {
  offers: { id: string; name: string; answers: number; basePaise: number; gstPaise: number; totalPaise: number; ratePercent: number; priceLabel: string; validityMonths: number }[];
  checkoutAvailable: boolean;
  trial: boolean;
  accessActive: boolean;
  extraLeft: number;
  extraExpiresAt: string | null;
  packs: { id: string; name: string; answers: number; left: number; purchasedAt: string; expiresAt: string; status: "active" | "used" | "expired" | "refunded" }[];
  orders: { id: string; razorpayOrderId: string; name: string; answers: number; totalPaise: number; status: "pending" | "paid" | "failed" | "refunded"; createdAt: string; paidAt: string | null }[];
}

/** Event other widgets (header "AI answers left") listen to, to reload after answers were added. */
export const ALLOWANCE_CHANGED_EVENT = "mwr:ai-allowance-changed";

const POLL_MS = 3_000;
const POLL_MAX = 40; // ~2 minutes

type Phase =
  | { kind: "choose" }
  | { kind: "starting" }
  | { kind: "paying" }
  | { kind: "confirming"; orderId: string }
  | { kind: "slow" }
  | { kind: "done"; answers: number }
  | { kind: "failed"; message: string };

const n = (x: number) => x.toLocaleString("en-IN");

export function TopUpDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded?: () => void }) {
  const router = useRouter();
  const [data, setData] = useState<TopUpOverviewJson | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ item: TopUpOverviewJson }>("/api/billing/topups");
      setData(r.item);
      setLoadError(null);
      return r.item;
    } catch (e) {
      setLoadError(errorMessage(e));
      return null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setPhase({ kind: "choose" });
    void load().then((d) => d && setSelected((s) => s ?? d.offers[0]?.id ?? null));
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [open, load]);

  const finished = useCallback(
    (answers: number) => {
      setPhase({ kind: "done", answers });
      window.dispatchEvent(new Event(ALLOWANCE_CHANGED_EVENT));
      onAdded?.();
      router.refresh();
    },
    [onAdded, router],
  );

  /** Wait for the signed webhook to add the answers (order → paid). */
  const waitForAnswers = useCallback(
    (orderId: string, attempt = 0) => {
      if (attempt >= POLL_MAX) return setPhase({ kind: "slow" });
      pollRef.current = setTimeout(async () => {
        const d = await load();
        const o = d?.orders.find((x) => x.razorpayOrderId === orderId);
        if (o?.status === "paid") return finished(o.answers);
        if (o?.status === "failed") return setPhase({ kind: "failed", message: "Your payment didn't go through, so no answers were added. No money was taken — please try again." });
        waitForAnswers(orderId, attempt + 1);
      }, POLL_MS);
    },
    [load, finished],
  );

  async function pay() {
    const offer = data?.offers.find((o) => o.id === selected);
    if (!offer) return;
    setPhase({ kind: "starting" });
    try {
      const r = await api<{ item: { orderId: string; keyId: string; amount: number } }>("/api/billing/topups", { body: { packId: offer.id } });
      setPhase({ kind: "paying" });
      await openRazorpayOrder({
        keyId: r.item.keyId,
        orderId: r.item.orderId,
        amount: r.item.amount,
        name: BRAND.name,
        description: `${offer.name} — one-time payment`,
        onSuccess: (resp: CheckoutSuccess | null) => {
          setPhase({ kind: "confirming", orderId: r.item.orderId });
          // Signature check only speeds up the message; the webhook adds the answers.
          if (resp) {
            void api<{ item: { status: string } }>("/api/billing/topups/verify", { body: resp })
              .then((v) => (v.item.status === "added" ? finished(offer.answers) : waitForAnswers(r.item.orderId)))
              .catch(() => waitForAnswers(r.item.orderId));
          } else waitForAnswers(r.item.orderId);
        },
        onDismiss: () => setPhase((p) => (p.kind === "paying" ? { kind: "choose" } : p)),
        onFailure: (message) => setPhase({ kind: "failed", message }),
      });
    } catch (e) {
      setPhase({ kind: "failed", message: errorMessage(e) });
    }
  }

  const offer = data?.offers.find((o) => o.id === selected) ?? null;
  const busy = phase.kind === "starting" || phase.kind === "paying" || phase.kind === "confirming";
  const close = () => {
    if (phase.kind === "starting" || phase.kind === "paying") return;
    if (pollRef.current) clearTimeout(pollRef.current);
    onClose();
  };

  let body: React.ReactNode;
  if (phase.kind === "confirming") {
    body = (
      <Notice tone="info" title="Payment received — adding your answers…" icon={<Clock />}>
        This usually takes a few seconds. You can keep this window open.
      </Notice>
    );
  } else if (phase.kind === "slow") {
    body = (
      <Notice tone="warning" title="Your payment is still being confirmed">
        If money was taken, your extra answers are added automatically within a few minutes — you can close this window. If they
        don&apos;t show up within an hour, write to {BRAND.supportEmail}.
      </Notice>
    );
  } else if (phase.kind === "done") {
    body = (
      <Notice tone="success" title={`${n(phase.answers)} extra AI answers added`} icon={<CheckCircle2 />}>
        They&apos;re used after your plan&apos;s monthly answers run out. Thank you!
      </Notice>
    );
  } else if (!data) {
    body = loadError ? (
      <Notice tone="danger">{loadError}</Notice>
    ) : (
      <div className="space-y-2" aria-label="Loading packs">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  } else {
    body = (
      <div className="space-y-4">
        {phase.kind === "failed" && <Notice tone="danger">{phase.message}</Notice>}
        {!data.accessActive && (
          <Notice tone="warning">Your plan isn&apos;t active right now, so extra answers can&apos;t be used. Choose a plan first.</Notice>
        )}
        {data.trial && data.accessActive && (
          <Notice tone="warning" title="You're on the free trial">
            Extra answers can only be used while your free trial or a paid plan is active. If your trial ends, they wait (for up
            to 12 months from purchase) until you choose a plan.
          </Notice>
        )}
        <div role="radiogroup" aria-label="Choose a pack" className="space-y-2">
          {data.offers.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected === o.id}
              onClick={() => setSelected(o.id)}
              disabled={busy}
              className={clsx(
                "flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                selected === o.id ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2",
              )}
            >
              <span className="min-w-0">
                <span className="block font-medium text-fg">{n(o.answers)} AI answers</span>
                <span className="block text-xs text-muted">
                  {o.gstPaise > 0 ? `${formatInr(o.basePaise)} + ${formatInr(o.gstPaise)} GST (${o.ratePercent}%) · ` : ""}Valid {o.validityMonths} months
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold tabular-nums text-fg">{formatInr(o.totalPaise)}</span>
                <span className="block text-xs text-muted">total</span>
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          One-time payment — not autopay, and your plan doesn&apos;t change. Extra answers are used only after your plan&apos;s
          monthly answers run out, oldest pack first, and expire 12 months after purchase. Your invoice is added to Settings &amp; billing.
        </p>
        {!data.checkoutAvailable && <Notice tone="info">Payments are coming soon. Write to {BRAND.supportEmail} to buy extra answers.</Notice>}
      </div>
    );
  }

  const footer =
    phase.kind === "done" || phase.kind === "slow" ? (
      <Button onClick={close}>Close</Button>
    ) : (
      <>
        <Button variant="ghost" onClick={close} disabled={phase.kind === "starting" || phase.kind === "paying"}>
          Cancel
        </Button>
        <Button
          onClick={pay}
          loading={busy}
          loadingText={phase.kind === "confirming" ? "Adding answers…" : "Opening payment…"}
          disabled={!offer || !data?.checkoutAvailable || !data?.accessActive}
        >
          {offer ? `Pay ${formatInr(offer.totalPaise)}` : "Pay"}
        </Button>
      </>
    );

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Buy more AI answers"
      description="Pick a pack. Pay once — nothing renews."
      icon={<PackagePlus />}
      footer={footer}
    >
      {body}
    </Dialog>
  );
}

/** "Buy more answers" button + dialog. Renders nothing for members who can't buy (owner/admin only). */
export function BuyAnswersButton({
  canBuy = true,
  size = "sm",
  variant = "secondary",
  label = "Buy more answers",
  className,
}: {
  canBuy?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!canBuy) return null;
  return (
    <>
      <Button size={size} variant={variant} icon={<Plus />} onClick={() => setOpen(true)} className={className}>
        {label}
      </Button>
      <TopUpDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const ORDER_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  paid: { label: "Paid", tone: "success" },
  pending: { label: "Waiting for payment", tone: "warning" },
  failed: { label: "Payment didn't go through", tone: "danger" },
  refunded: { label: "Refunded", tone: "neutral" },
};

const PACK_STATUS: Record<string, string> = { active: "", used: "All used", expired: "Expired", refunded: "Refunded" };

/** Settings → Billing: "Extra AI answers" — answers left per pack with expiry, purchase history, buy button. */
export function ExtraAnswersCard({ canManage }: { canManage: boolean }) {
  const [data, setData] = useState<TopUpOverviewJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => {
    api<{ item: TopUpOverviewJson }>("/api/billing/topups")
      .then((r) => {
        setData(r.item);
        setError(null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => load(), [load]);

  const fromPaise = data?.offers.length ? Math.min(...data.offers.map((o) => o.basePaise)) : null;
  const gst = data?.offers.some((o) => o.gstPaise > 0);
  const live = data?.packs.filter((p) => p.status === "active") ?? [];
  const old = data?.packs.filter((p) => p.status !== "active") ?? [];

  return (
    <Card as="section">
      <CardHeader
        icon={<PackagePlus />}
        title="Extra AI answers"
        description={`Ran out before the month ends? Buy a one-time pack${fromPaise !== null ? ` from ${formatInr(fromPaise)}${gst ? " + GST" : ""}` : ""}. Not autopay — your plan doesn't change.`}
        actions={
          canManage ? (
            <Button size="sm" icon={<Plus />} onClick={() => setOpen(true)}>
              Buy more answers
            </Button>
          ) : undefined
        }
      />
      <CardBody className="space-y-5">
        {error && <Notice tone="danger">{error}</Notice>}
        {!data && !error && <Skeleton className="h-16 w-full" />}
        {data && (
          <>
            <div>
              <p className="text-small text-fg">
                <span className="font-semibold tabular-nums">{n(data.extraLeft)}</span> extra AI answers left
                {data.extraExpiresAt && data.extraLeft > 0 ? ` · the oldest expire on ${fmtDate(data.extraExpiresAt)}` : ""}
              </p>
              <p className="text-xs text-muted">Used only after your plan&apos;s monthly answers run out, oldest pack first.</p>
            </div>
            {live.length + old.length > 0 && (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {[...live, ...old].map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-small">
                    <span className="min-w-0">
                      <span className="block text-fg">{p.name}</span>
                      <span className="block text-xs text-muted">
                        Bought {fmtDate(p.purchasedAt)} · {p.status === "expired" ? "expired" : "expires"} {fmtDate(p.expiresAt)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {p.status === "active" ? (
                        <span className="tabular-nums text-fg">
                          {n(p.left)} of {n(p.answers)} left
                        </span>
                      ) : (
                        <Badge tone="neutral">{PACK_STATUS[p.status]}</Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {data.orders.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-small font-semibold text-fg">Purchase history</h3>
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {data.orders.map((o) => {
                    const st = ORDER_STATUS[o.status] ?? { label: o.status, tone: "neutral" as const };
                    return (
                      <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-small">
                        <span className="min-w-0">
                          <span className="block text-fg">{o.name}</span>
                          <span className="block text-xs text-muted">
                            {fmtDate(o.paidAt ?? o.createdAt)} · {formatInr(o.totalPaise)} (one-time)
                          </span>
                        </span>
                        <Badge tone={st.tone} variant="dot">
                          {st.label}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
                {data.orders.some((o) => o.status === "pending") && (
                  <p className="text-xs text-muted">
                    &quot;Waiting for payment&quot; means the payment window was opened but we haven&apos;t heard back from the bank yet.
                    If money was taken, the answers are added automatically within a few minutes.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardBody>
      <TopUpDialog open={open} onClose={() => setOpen(false)} onAdded={load} />
    </Card>
  );
}
