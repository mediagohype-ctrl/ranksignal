"use client";
// "Wrong facts" box (brief 5.6): what AI tools got wrong about the business. "Correct this" adds a To-do task.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import { correctionTaskTitle, type WrongFact } from "@/lib/dashboard/ai-answers";
import { engineName } from "@/components/app/providers-status";
import { Button, Card, CardHeader, useToast } from "@/components/ui";

export function WrongFacts({ projectId, facts, canEdit }: { projectId: string; facts: WrongFact[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  if (facts.length === 0) return null;

  async function correct(i: number) {
    const f = facts[i];
    setBusy(i);
    try {
      await api(`/api/projects/${projectId}/tasks`, {
        body: {
          title: correctionTaskTitle(f.statement),
          description: `${f.engine ? `${engineName(f.engine)} said` : "An AI tool said"}: “${f.statement}”. Fix the facts on your website and your business profiles (Google, directories) so AI tools learn the right ones.`,
          category: "offsite",
          performedBy: "client",
        },
      });
      setDone((s) => new Set(s).add(i));
      toast("Added to your To-do list.", "success");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader icon={<AlertTriangle />} title="Wrong facts" description="Things AI tools said about you that aren't right." />
      <ul className="divide-y divide-border">
        {facts.map((f, i) => (
          <li key={i} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:px-6">
            <p className="min-w-0 flex-1 text-small text-fg">
              {f.statement}
              {f.engine && <span className="block text-xs text-muted">Said by {engineName(f.engine)}</span>}
            </p>
            {canEdit &&
              (done.has(i) ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-small text-success">
                  <Check aria-hidden size={14} /> Added to To-do
                </span>
              ) : (
                <Button size="sm" variant="secondary" loading={busy === i} onClick={() => correct(i)} className="shrink-0">
                  Correct this
                </Button>
              ))}
          </li>
        ))}
      </ul>
    </Card>
  );
}
