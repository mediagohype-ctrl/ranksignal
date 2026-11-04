"use client";
// AI Answers tab (brief 5.6): one row per customer question with ✓ / ✗, "Recommended instead", tap to read each
// AI tool's full answer, Pause per question and an "Add question" box — all on one screen.
import { useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, ChevronRight, ExternalLink, Plus, X } from "lucide-react";
import { questionHref } from "@/components/app/nav";
import type { QuestionView } from "@/lib/dashboard/ai-answers";
import { engineName } from "@/components/app/providers-status";
import { usePromptActions } from "@/components/app/prompts-manager";
import { Badge, Button, Card, Input, LinkButton } from "@/components/ui";
import { AnswerText } from "./answer-text";

export interface PromptState {
  id: string;
  text: string;
  active: boolean;
}

function Mark({ named }: { named: boolean }) {
  return named ? (
    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
      <Check aria-hidden size={16} strokeWidth={3} />
      <span className="sr-only">AI named you</span>
    </span>
  ) : (
    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
      <X aria-hidden size={16} strokeWidth={3} />
      <span className="sr-only">AI didn&apos;t name you</span>
    </span>
  );
}

function Answer({ a, brandNames }: { a: QuestionView["answers"][number]; brandNames: string[] }) {
  const owned = a.citations.filter((c) => c.ownedByCustomer);
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-small font-semibold text-fg">{engineName(a.platformLabel || a.provider)}</span>
        {a.brandMentioned ? (
          <Badge tone="success" size="sm">Named you</Badge>
        ) : (
          <Badge tone="neutral" size="sm">Didn&apos;t name you</Badge>
        )}
        {a.simulated && <Badge tone="warning" size="sm">Sample</Badge>}
      </div>
      {/* Untrusted provider text: parsed and rendered as elements, never as HTML. */}
      <div className="max-h-[28rem] overflow-y-auto pr-1">
        {a.rawResponse ? <AnswerText text={a.rawResponse} brandNames={brandNames} /> : <span className="text-small text-muted">(empty answer)</span>}
      </div>
      {owned.length > 0 && (
        <ul className="space-y-1">
          {owned.map((c, i) => (
            <li key={`${c.url}-${i}`}>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex max-w-full items-start gap-1 text-xs text-primary hover:underline"
              >
                <span className="min-w-0 break-all">Linked to your site: {c.title || c.url}</span>
                <ExternalLink size={11} className="mt-0.5 shrink-0" aria-hidden />
                <span className="sr-only">(opens in new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnswersList({
  projectId,
  questions,
  prompts,
  canEdit,
  brandNames = [],
  runId,
}: {
  projectId: string;
  questions: QuestionView[];
  /** The business's own names, highlighted inside answers. */
  brandNames?: string[];
  /** The AI check being shown (kept when opening a question's own page). */
  runId?: string | null;
  /** Every customer question (switched on or paused), so new and paused ones show too. */
  prompts: PromptState[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const { add, adding, setActive, busyId } = usePromptActions(projectId);
  const byId = new Map(prompts.map((p) => [p.id, p]));
  const asked = new Set(questions.map((q) => q.promptId));
  const waiting = prompts.filter((p) => p.active && !asked.has(p.id));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (await add(text)) setText("");
  }

  return (
    <Card>
      <ul className="divide-y divide-border">
        {questions.map((q) => {
          const p = byId.get(q.promptId);
          const paused = p ? !p.active : false;
          const isOpen = open === q.promptId;
          return (
            <li key={q.promptId} className={clsx(paused && "opacity-70")}>
              <div className="flex items-start gap-3 px-4 py-3 sm:px-6">
                <Mark named={q.named} />
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : q.promptId)}
                  aria-expanded={isOpen}
                  aria-controls={`q-${q.promptId}`}
                  className="focus-ring min-w-0 flex-1 rounded text-left"
                >
                  <span className="block text-small font-medium text-fg">{q.text}</span>
                  {!q.named && q.recommendedInstead.length > 0 && (
                    <span className="mt-0.5 block text-xs text-muted">Recommended instead: {q.recommendedInstead.join(", ")}</span>
                  )}
                  {q.named && q.answers.length > 1 && (
                    <span className="mt-0.5 block text-xs text-muted">
                      Named you in {q.namedCount} of {q.answers.length} answers
                    </span>
                  )}
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    {isOpen ? "Hide answers" : "Read answers"}
                    <ChevronDown aria-hidden size={14} className={clsx("transition-transform", isOpen && "rotate-180")} />
                  </span>
                </button>
                <LinkButton
                  href={questionHref(projectId, q.promptId, runId)}
                  variant="secondary"
                  size="sm"
                  iconRight={<ChevronRight />}
                  aria-label={`See details: ${q.text}`}
                  className="shrink-0"
                >
                  <span className="hidden sm:inline">See details</span>
                  <span className="sm:hidden">Details</span>
                </LinkButton>
                {canEdit && p && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={busyId === p.id}
                    onClick={() => setActive(p.id, paused)}
                    aria-label={`${paused ? "Resume" : "Pause"} question: ${q.text}`}
                  >
                    {paused ? "Resume" : "Pause"}
                  </Button>
                )}
              </div>
              {isOpen && (
                <div id={`q-${q.promptId}`} className="space-y-3 bg-surface-2 px-4 py-4 sm:px-6">
                  {q.answers.map((a) => (
                    <Answer key={a.id} a={a} brandNames={brandNames} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {waiting.map((p) => (
          <li key={p.id} className="flex items-start gap-3 px-4 py-3 sm:px-6">
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted" aria-hidden>
              ·
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-small font-medium text-fg">{p.text}</span>
              <span className="block text-xs text-muted">Not asked yet. We&apos;ll ask it in the next AI check.</span>
            </span>
            {canEdit && (
              <Button variant="ghost" size="sm" loading={busyId === p.id} onClick={() => setActive(p.id, false)} aria-label={`Pause question: ${p.text}`}>
                Pause
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form onSubmit={submit} className="flex flex-col gap-2 border-t border-border px-4 py-4 sm:flex-row sm:px-6">
          <label htmlFor="aa-new" className="sr-only">
            Add a question
          </label>
          <Input
            id="aa-new"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            placeholder="Add a question your customers ask, e.g. best bakery in Pune"
          />
          <Button type="submit" variant="secondary" icon={<Plus />} loading={adding} className="shrink-0">
            Add question
          </Button>
        </form>
      )}
    </Card>
  );
}
