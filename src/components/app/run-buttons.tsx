"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, ScanSearch } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { fmtDate } from "@/lib/dashboard/format";
import { Button, useToast, type ButtonSize, type ButtonVariant } from "@/components/ui";
import { useTimeZone } from "@/components/app/time-zone";

type Kind = "audit" | "visibility";

const DEFAULT_LABELS: Record<Kind, { idle: string; running: string; queued: string }> = {
  audit: { idle: "Check website", running: "Checking website…", queued: "Website check started. This usually takes a minute or two." },
  visibility: { idle: "Check AI", running: "Checking AI…", queued: "AI check started. Results appear in a few minutes." },
};

/** Plan limits as returned by GET /api/billing/allowance (pass in to skip the fetch). */
export interface RunAllowance {
  ai: { used: number; cap: number; left: number; resetsAt: string | null };
  website: { allowed: boolean; resetsAt: string };
}

/** Why a check can't start at the plan limit, and the button text to show instead. Null = it can start. */
export function limitState(kind: Kind, a: RunAllowance | null, timeZone?: string | null): { label: string; title: string } | null {
  if (!a) return null;
  const day = (iso: string) => fmtDate(iso, { timeZone });
  if (kind === "visibility" && a.ai.cap > 0 && a.ai.left <= 0) {
    return a.ai.resetsAt
      ? { label: `Resets on ${day(a.ai.resetsAt)}`, title: `You've used all ${a.ai.cap.toLocaleString("en-IN")} AI answers this month. Upgrade for more.` }
      : { label: "No AI answers left", title: "You've used the AI answers in your free trial. Choose a plan to keep checking." };
  }
  if (kind === "audit" && !a.website.allowed) {
    return { label: `Resets on ${day(a.website.resetsAt)}`, title: "Your plan's website checks for this month are used up. Upgrade for more." };
  }
  return null;
}

export function RunButtons({
  projectId,
  crawlActive,
  visibilityActive,
  canRun,
  show = ["audit", "visibility"],
  labels,
  size = "md",
  primary,
  allowance: allowanceProp,
}: {
  projectId: string;
  crawlActive: boolean;
  visibilityActive: boolean;
  canRun: boolean;
  show?: Kind[];
  /** Override button text, e.g. { audit: "Check website again" }. */
  labels?: Partial<Record<Kind, string>>;
  size?: ButtonSize;
  /** Which button gets the primary style (default: the only one shown, else visibility). */
  primary?: Kind | "none";
  /** Plan limits; fetched from /api/billing/allowance when not given. */
  allowance?: RunAllowance | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const timeZone = useTimeZone();
  const [busy, setBusy] = useState<Kind | null>(null);
  const [fetched, setFetched] = useState<RunAllowance | null>(null);
  const allowance = allowanceProp ?? fetched;

  useEffect(() => {
    if (allowanceProp !== undefined || !canRun) return;
    let alive = true;
    api<{ item: RunAllowance }>("/api/billing/allowance")
      .then((r) => alive && setFetched(r.item))
      .catch(() => undefined); // limits unknown: let the server decide (it answers 402 with the reset date)
    return () => {
      alive = false;
    };
  }, [allowanceProp, canRun, visibilityActive, crawlActive]);

  async function start(kind: Kind) {
    setBusy(kind);
    try {
      await api(`/api/projects/${projectId}/${kind === "audit" ? "crawl-runs" : "visibility-runs"}`, { body: {} });
      toast(DEFAULT_LABELS[kind].queued, "success");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  const roleTitle = canRun ? undefined : "You can see results, but only an Owner, Admin or Member can start new checks";
  const primaryKind = primary ?? (show.length === 1 ? show[0] : "visibility");
  const variant = (k: Kind): ButtonVariant => (primaryKind === k ? "primary" : "secondary");
  const button = (kind: Kind, active: boolean, icon: React.ReactNode) => {
    const limit = active ? null : limitState(kind, allowance, timeZone);
    return (
      <Button
        variant={variant(kind)}
        size={size}
        icon={icon}
        onClick={() => start(kind)}
        loading={busy === kind}
        loadingText="Starting…"
        disabled={!canRun || active || !!limit}
        title={roleTitle ?? limit?.title}
      >
        {active ? DEFAULT_LABELS[kind].running : (limit?.label ?? labels?.[kind] ?? DEFAULT_LABELS[kind].idle)}
      </Button>
    );
  };
  return (
    <>
      {show.includes("audit") && button("audit", crawlActive, <ScanSearch />)}
      {show.includes("visibility") && button("visibility", visibilityActive, <Radar />)}
    </>
  );
}
