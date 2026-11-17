"use client";
// "Is your business called 'Go Hype Media'? Yes / Change" — the two buttons in the Home setup banner.
// Yes saves the suggested name as the confirmed business name and keeps the old guess as another name people use.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/dashboard/client";
import { Button, LinkButton, useToast } from "@/components/ui";

const FACT_KEYS = ["sells", "customers", "city", "country", "language", "founder", "address", "phone", "services"] as const;

export function ConfirmNameButtons({
  projectId,
  suggestion,
  previousNames,
  facts,
  changeHref,
  canEdit,
}: {
  projectId: string;
  suggestion: string;
  previousNames: string[];
  facts: Record<string, unknown>;
  changeHref: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      const seen = new Set<string>();
      const brandNames = [suggestion, ...previousNames]
        .map((n) => n.trim())
        .filter((n) => n && !seen.has(n.toLowerCase()) && !!seen.add(n.toLowerCase()))
        .slice(0, 20);
      // PATCH replaces the stored facts, so send the ones already saved along with the confirmed name.
      const kept = Object.fromEntries(FACT_KEYS.filter((k) => typeof facts[k] === "string" && (facts[k] as string).trim()).map((k) => [k, facts[k]]));
      await api(`/api/projects/${projectId}`, { method: "PATCH", body: { name: suggestion, brandNames, facts: { ...kept, name: suggestion } } });
      toast(`Saved. We'll look for "${suggestion}" from now on.`, "success");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={confirm} loading={busy} disabled={!canEdit}>
        Yes
      </Button>
      <LinkButton href={changeHref} size="sm" variant="ghost">
        Change
      </LinkButton>
    </span>
  );
}
