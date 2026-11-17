"use client";
// "Check these facts" (AI answers page). AI tools say things about the business that we can't judge ourselves, so
// nothing here is called "wrong" until the owner says so:
//   ✓ Correct — saved for this website, never asked again, and used in later checks;
//   ✗ Wrong   — asks what is right (optional), adds a task to the To-do list and links straight to it.
// Statements about complaints, payment disputes, scams… are shown apart in a red box with steps to respond.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ListChecks, ShieldAlert, X } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import type { FactToCheck } from "@/lib/visibility/fact-review";
import { engineName } from "@/components/app/providers-status";
import { Badge, Button, Card, CardHeader, Dialog, Field, Input, useToast } from "@/components/ui";

type Outcome = { verdict: "correct" } | { verdict: "wrong"; href: string | null };

const RISK_STEPS = [
  "Check if it is true. Search your business name with the word “complaints” or “reviews” to find the page the AI read.",
  "If a customer really complained: reply politely where they wrote it, put the problem right, and ask them to update their review.",
  "If it is false, or about another business with a similar name: press “✗ Wrong” below. We'll add a task to your To-do list with the steps to get it corrected.",
  "Ask happy customers for honest reviews on Google. AI tools read many recent reviews, not just one old complaint.",
];

export function WrongFacts({
  projectId,
  facts,
  canEdit,
  checkedOn,
}: {
  projectId: string;
  facts: FactToCheck[];
  canEdit: boolean;
  /** Date of the AI check these statements come from, already formatted (e.g. "15 Nov 2026"). */
  checkedOn?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, Outcome>>({});
  const [asking, setAsking] = useState<FactToCheck | null>(null);
  const [correction, setCorrection] = useState("");
  if (facts.length === 0) return null;

  const risks = facts.filter((f) => f.risk);
  const normal = facts.filter((f) => !f.risk);

  async function answer(f: FactToCheck, verdict: "correct" | "wrong", right?: string) {
    setBusy(f.statement);
    try {
      const r = await api<{ item: { task: { id: string; href: string } | null } }>(`/api/projects/${projectId}/ai-facts`, {
        body: { statement: f.statement, verdict, ...(f.engine ? { engine: f.engine } : {}), ...(right?.trim() ? { correction: right.trim() } : {}) },
      });
      setDone((d) => ({ ...d, [f.statement]: verdict === "correct" ? { verdict } : { verdict, href: r.item.task?.href ?? null } }));
      toast(verdict === "correct" ? "Saved. We won't ask about this again." : "Added to your To-do list.", "success");
      setAsking(null);
      setCorrection("");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  const row = (f: FactToCheck) => {
    const out = done[f.statement];
    return (
      <li key={f.statement} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-small text-fg">{f.statement}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {f.status === "conflict" ? (
              <Badge tone="warning" title="This is different from the business details you gave us. Tell us which is right.">
                Doesn&apos;t match your details
              </Badge>
            ) : (
              <Badge tone="neutral" title="We can't tell if this is right. Only you know.">
                Not confirmed
              </Badge>
            )}
            {f.engine && <span>Said by {engineName(f.engine)}</span>}
          </p>
        </div>
        {out ? (
          out.verdict === "correct" ? (
            <span role="status" className="inline-flex shrink-0 items-center gap-1 text-small text-success">
              <Check aria-hidden size={14} /> Marked correct
            </span>
          ) : (
            <span role="status" className="inline-flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-small text-fg-soft">
              <ListChecks aria-hidden size={14} /> Added to To-do.
              {out.href && (
                <Link href={out.href} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  Open the task <ArrowRight aria-hidden size={14} />
                </Link>
              )}
            </span>
          )
        ) : (
          canEdit && (
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="secondary" icon={<Check />} loading={busy === f.statement} disabled={busy !== null} onClick={() => answer(f, "correct")}>
                Correct
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon={<X />}
                disabled={busy !== null}
                onClick={() => {
                  setCorrection("");
                  setAsking(f);
                }}
              >
                Wrong
              </Button>
            </div>
          )
        )}
      </li>
    );
  };

  const from = checkedOn ? ` From your AI check on ${checkedOn}.` : "";

  return (
    <div className="space-y-6">
      {risks.length > 0 && (
        <section aria-labelledby="ai-risk-title" className="overflow-hidden rounded-xl border border-danger/30 bg-danger-soft">
          <div className="flex items-start gap-3 px-4 pt-4 sm:px-6">
            <ShieldAlert aria-hidden size={20} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0">
              <h2 id="ai-risk-title" className="text-h4 text-fg">
                AI mentions complaints about you
              </h2>
              <p className="mt-1 text-small text-fg-soft">
                People who ask AI about you may read this. We can&apos;t tell if it is true — you can. Here is what to do:
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-small text-fg-soft">
                {RISK_STEPS.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-danger/20 border-t border-danger/20 bg-surface">{risks.map(row)}</ul>
        </section>
      )}

      {normal.length > 0 && (
        <Card>
          <CardHeader
            icon={<ListChecks />}
            title="Check these facts"
            description={`Things AI tools say about you. We can't tell if they are right — tell us, and we'll remember.${from}`}
          />
          <ul className="divide-y divide-border">{normal.map(row)}</ul>
        </Card>
      )}

      <Dialog
        open={!!asking}
        onClose={() => (busy ? undefined : setAsking(null))}
        title="What is right?"
        description={asking ? `AI said: “${asking.statement}”` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(null)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button onClick={() => asking && answer(asking, "wrong", correction)} loading={busy !== null} loadingText="Adding…">
              Add to my To-do list
            </Button>
          </>
        }
      >
        <Field label="The right fact" htmlFor="ai-fact-correction" optional hint="For example: “Our office is in Noida, not Delhi.” You can leave this empty.">
          <Input id="ai-fact-correction" value={correction} maxLength={300} onChange={(e) => setCorrection(e.target.value)} />
        </Field>
        <p className="mt-3 text-small text-muted">We&apos;ll add a task to your To-do list with the steps to get this corrected, and show you where it is.</p>
      </Dialog>
    </div>
  );
}
