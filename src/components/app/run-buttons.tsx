"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, ScanSearch } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { Button, useToast, type ButtonSize, type ButtonVariant } from "@/components/ui";

type Kind = "audit" | "visibility";

const DEFAULT_LABELS: Record<Kind, { idle: string; running: string; queued: string }> = {
  audit: { idle: "Scan website", running: "Scanning…", queued: "Website scan started. This usually takes a minute or two." },
  visibility: { idle: "Check AI visibility", running: "Checking AI…", queued: "AI visibility check started." },
};

export function RunButtons({
  projectId,
  crawlActive,
  visibilityActive,
  canRun,
  show = ["audit", "visibility"],
  labels,
  size = "md",
  primary,
}: {
  projectId: string;
  crawlActive: boolean;
  visibilityActive: boolean;
  canRun: boolean;
  show?: Kind[];
  /** Override button text, e.g. { audit: "Re-scan website" }. */
  labels?: Partial<Record<Kind, string>>;
  size?: ButtonSize;
  /** Which button gets the primary style (default: the only one shown, else visibility). */
  primary?: Kind | "none";
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<Kind | null>(null);

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

  const title = canRun ? undefined : "Your role can view results but not start new checks";
  const primaryKind = primary ?? (show.length === 1 ? show[0] : "visibility");
  const variant = (k: Kind): ButtonVariant => (primaryKind === k ? "primary" : "secondary");
  return (
    <>
      {show.includes("audit") && (
        <Button
          variant={variant("audit")}
          size={size}
          icon={<ScanSearch />}
          onClick={() => start("audit")}
          loading={busy === "audit"}
          loadingText="Starting…"
          disabled={!canRun || crawlActive}
          title={title}
        >
          {crawlActive ? DEFAULT_LABELS.audit.running : (labels?.audit ?? DEFAULT_LABELS.audit.idle)}
        </Button>
      )}
      {show.includes("visibility") && (
        <Button
          variant={variant("visibility")}
          size={size}
          icon={<Radar />}
          onClick={() => start("visibility")}
          loading={busy === "visibility"}
          loadingText="Starting…"
          disabled={!canRun || visibilityActive}
          title={title}
        >
          {visibilityActive ? DEFAULT_LABELS.visibility.running : (labels?.visibility ?? DEFAULT_LABELS.visibility.idle)}
        </Button>
      )}
    </>
  );
}
