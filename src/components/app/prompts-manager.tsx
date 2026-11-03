"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Info, ListChecks, Pencil, Plus, Search, Sparkles } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import {
  Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, Input, Select, Table, TD, TH, THead, TR, Tooltip, fieldDescribedBy,
  useToast,
} from "@/components/ui";

const INTENTS = ["informational", "commercial", "comparison", "navigational", "transactional"] as const;

/** Plain-English meaning of each intent, for help text and tooltips. */
const INTENT_HELP: Record<string, string> = {
  informational: "Learning: “how do I…”, “what is…”",
  commercial: "Shopping around: “best … for …”",
  comparison: "Weighing options: “X vs Y”, “alternatives to X”",
  navigational: "Looking for you: “<your brand> pricing”",
  transactional: "Ready to buy: “buy …”, “book …”",
};

/** Short plain name for each intent (the stored value stays the same). */
const INTENT_LABEL: Record<string, string> = {
  informational: "Learning",
  commercial: "Shopping around",
  comparison: "Comparing",
  navigational: "Looking for you",
  transactional: "Ready to buy",
};
const intentLabel = (i: string) => INTENT_LABEL[i] ?? i;

const PRIORITY_LABEL: Record<number, string> = { 1: "High", 2: "Normal", 3: "Low" };

export interface PromptRow {
  id: string;
  text: string;
  intent: string;
  topic: string | null;
  locale: string;
  priority: number;
  active: boolean;
  promptSetVersion: number;
}

interface Candidate {
  text: string;
  intent: string;
  topic: string | null;
  locale: string;
  source?: string;
}

function HelpTH({ children, help }: { children: string; help: string }) {
  return (
    <TH>
      <span className="inline-flex items-center gap-1">
        {children}
        <Tooltip content={help}>
          <button type="button" aria-label={`What is “${children}”?`} className="focus-ring rounded text-muted hover:text-fg">
            <Info aria-hidden size={13} />
          </button>
        </Tooltip>
      </span>
    </TH>
  );
}

const chipCls = (on: boolean) =>
  clsx(
    "focus-ring inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-small font-medium capitalize transition-colors",
    on ? "border-primary bg-primary-soft text-primary-soft-fg" : "border-border bg-surface text-fg-soft hover:bg-surface-2",
  );

export function PromptsManager({ projectId, prompts, canEdit }: { projectId: string; prompts: PromptRow[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [showInactive, setShowInactive] = useState(false);
  const [q, setQ] = useState("");
  const [intent, setIntent] = useState<string>("all");
  const [editing, setEditing] = useState<PromptRow | "new" | null>(null);
  const [form, setForm] = useState({ text: "", intent: "informational", topic: "", priority: 2 });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [savingSuggestions, setSavingSuggestions] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(() => prompts.filter((p) => showInactive || p.active), [prompts, showInactive]);
  const intentCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of visible) c[p.intent] = (c[p.intent] ?? 0) + 1;
    return c;
  }, [visible]);
  const needle = q.trim().toLowerCase();
  const shown = visible.filter(
    (p) =>
      (intent === "all" || p.intent === intent) &&
      (!needle || p.text.toLowerCase().includes(needle) || (p.topic ?? "").toLowerCase().includes(needle)),
  );
  const activeCount = prompts.filter((p) => p.active).length;

  function openEditor(p: PromptRow | "new") {
    setEditing(p);
    setFormError(null);
    setForm(
      p === "new"
        ? { text: "", intent: "informational", topic: "", priority: 2 }
        : { text: p.text, intent: p.intent, topic: p.topic ?? "", priority: p.priority },
    );
  }

  async function save() {
    if (form.text.trim().length < 3) {
      setFormError("Please write a question of at least 3 characters.");
      return;
    }
    setSaving(true);
    setFormError(null);
    const body = { text: form.text.trim(), intent: form.intent, topic: form.topic.trim() || null, priority: form.priority };
    try {
      if (editing === "new") {
        await api(`/api/projects/${projectId}/prompts`, { body: { prompts: [body] } });
        toast("Question added.", "success");
      } else if (editing) {
        const r = await api<{ discontinuity?: boolean }>(`/api/projects/${projectId}/prompts/${editing.id}`, { method: "PATCH", body });
        toast(
          r.discontinuity
            ? "Question updated. Charts will mark the change so old and new results aren't mixed up."
            : "Question updated.",
          "success",
        );
      }
      setEditing(null);
      router.refresh();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function setActive(p: PromptRow, active: boolean) {
    setBusyId(p.id);
    try {
      if (active) await api(`/api/projects/${projectId}/prompts/${p.id}`, { method: "PATCH", body: { active: true } });
      else await api(`/api/projects/${projectId}/prompts/${p.id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const r = await api<{ items: Candidate[]; source?: string }>(`/api/projects/${projectId}/prompts`, {
        body: { generate: true, save: false, max: 25 },
      });
      setCandidates(r.items);
      setSelected(new Set(r.items.map((_, i) => i)));
      if (r.items.length === 0) toast("No new suggestions. You already have questions like these — add your own instead.", "info");
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setGenerating(false);
    }
  }

  async function saveSuggestions() {
    if (!candidates) return;
    const chosen = candidates.filter((_, i) => selected.has(i));
    if (!chosen.length) return;
    setSavingSuggestions(true);
    try {
      const r = await api<{ items: unknown[]; skippedDuplicates?: number }>(`/api/projects/${projectId}/prompts`, {
        body: { prompts: chosen.map((c) => ({ text: c.text, intent: c.intent, topic: c.topic, locale: c.locale })) },
      });
      toast(
        `Saved ${r.items.length} question${r.items.length === 1 ? "" : "s"}${r.skippedDuplicates ? `, skipped ${r.skippedDuplicates} duplicate(s)` : ""}.`,
        "success",
      );
      setCandidates(null);
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setSavingSuggestions(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={<ListChecks />}
          title={`Questions we ask AI tools (${activeCount} switched on)`}
          description="Each AI check asks every switched-on question to every AI tool. If you reword a question, charts mark the change so results stay fair."
          actions={
            canEdit ? (
              <>
                <Button variant="secondary" icon={<Sparkles />} onClick={generate} loading={generating} loadingText="Thinking…">
                  Suggest questions
                </Button>
                <Button icon={<Plus />} onClick={() => openEditor("new")}>
                  Add question
                </Button>
              </>
            ) : undefined
          }
        />
        {prompts.length > 0 && (
          <div className="space-y-3 border-b border-border px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-xs">
                <Search aria-hidden size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <label className="sr-only" htmlFor="pm-q">
                  Search questions
                </label>
                <Input
                  id="pm-q"
                  inputSize="sm"
                  placeholder="Search questions or topics…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                />
              </div>
              <label className="flex items-center gap-2 text-small text-fg-soft">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Show switched-off questions
              </label>
              <span className="ml-auto text-xs tabular-nums text-muted" aria-live="polite">
                {shown.length} of {visible.length} shown
              </span>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by what the customer wants">
              <button type="button" aria-pressed={intent === "all"} onClick={() => setIntent("all")} className={chipCls(intent === "all")}>
                All types <span className="text-xs tabular-nums opacity-80">{visible.length}</span>
              </button>
              {INTENTS.filter((i) => (intentCounts[i] ?? 0) > 0).map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={intent === i}
                  onClick={() => setIntent(i)}
                  title={INTENT_HELP[i]}
                  className={chipCls(intent === i)}
                >
                  {intentLabel(i)} <span className="text-xs tabular-nums opacity-80">{intentCounts[i]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {shown.length === 0 ? (
          <EmptyState
            icon={<ListChecks />}
            title={prompts.length === 0 ? "No questions yet" : "No questions match"}
            description={
              prompts.length === 0
                ? "Add the questions your customers would ask an AI tool, or let us suggest some for you."
                : "Try a different search or filter."
            }
            action={
              prompts.length === 0 && canEdit ? (
                <Button icon={<Sparkles />} onClick={generate} loading={generating}>
                  Suggest questions for me
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table caption="Customer questions" zebra>
            <THead>
              <tr>
                <TH>Question</TH>
                <HelpTH help="What the person asking is trying to do: learn, compare or buy.">Type</HelpTH>
                <HelpTH help="Optional label to group related questions.">Topic</HelpTH>
                <HelpTH help="Language and country the question is asked in.">Language</HelpTH>
                <HelpTH help="High-priority questions are asked first when your plan limits how many questions each AI check can ask.">Priority</HelpTH>
                <TH>Status</TH>
                {canEdit && (
                  <TH>
                    <span className="sr-only">Actions</span>
                  </TH>
                )}
              </tr>
            </THead>
            <tbody>
              {shown.map((p) => (
                <TR key={p.id} className={p.active ? undefined : "opacity-60"}>
                  <TD className="max-w-md font-medium text-fg">{p.text}</TD>
                  <TD>
                    <Badge tone="primary" title={INTENT_HELP[p.intent]}>
                      {intentLabel(p.intent)}
                    </Badge>
                  </TD>
                  <TD className="text-muted">{p.topic ?? "—"}</TD>
                  <TD className="text-muted">{p.locale}</TD>
                  <TD>
                    <span className={clsx("text-small", p.priority === 1 ? "font-medium text-fg" : "text-muted")}>
                      {PRIORITY_LABEL[p.priority] ?? `P${p.priority}`}
                    </span>
                  </TD>
                  <TD>
                    {p.active ? (
                      <Badge tone="success" variant="dot">
                        On
                      </Badge>
                    ) : (
                      <Badge variant="dot">Off</Badge>
                    )}
                  </TD>
                  {canEdit && (
                    <TD className="whitespace-nowrap text-right">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEditor(p)} aria-label={`Edit question: ${p.text}`}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="sm" loading={busyId === p.id} onClick={() => setActive(p, !p.active)}>
                        {p.active ? "Pause" : "Resume"}
                      </Button>
                    </TD>
                  )}
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {candidates && candidates.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader
            icon={<Sparkles />}
            title="Suggested questions"
            description="Tick the ones your customers would really ask. We left out ones that are almost the same as questions you already have."
            actions={
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set(selected.size === candidates.length ? [] : candidates.map((_, i) => i)))}
                >
                  {selected.size === candidates.length ? "Select none" : "Select all"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCandidates(null)}>
                  Discard
                </Button>
                <Button size="sm" onClick={saveSuggestions} loading={savingSuggestions} disabled={selected.size === 0}>
                  Save {selected.size} selected
                </Button>
              </>
            }
          />
          <ul className="divide-y divide-border">
            {candidates.map((c, i) => (
              <li key={`${c.text}-${i}`}>
                <label className="flex cursor-pointer flex-wrap items-start gap-3 px-5 py-3 hover:bg-surface-2 sm:px-6">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={selected.has(i)}
                    onChange={(e) =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (e.target.checked) n.add(i);
                        else n.delete(i);
                        return n;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1 text-small text-fg">{c.text}</span>
                  <Badge tone="primary" title={INTENT_HELP[c.intent]}>
                    {intentLabel(c.intent)}
                  </Badge>
                  {c.source && <Badge>{c.source === "llm" ? "Suggested by AI" : "Common question"}</Badge>}
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add a question" : "Edit question"}
        description={
          editing !== "new"
            ? "If you reword a question, charts mark the change so before and after results aren't mixed up."
            : "Write it the way a customer would type it into ChatGPT or Gemini."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <Field label="Question" htmlFor="pm-text" hint="For example: “What's the best bakery in Pune for custom cakes?”" error={formError} required>
            <Input
              id="pm-text"
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              maxLength={500}
              invalid={!!formError}
              aria-describedby={fieldDescribedBy("pm-text", { hint: true, error: formError })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type of question" htmlFor="pm-intent" hint={INTENT_HELP[form.intent]}>
              <Select
                id="pm-intent"
                value={form.intent}
                onChange={(e) => setForm({ ...form, intent: e.target.value })}
              >
                {INTENTS.map((i) => (
                  <option key={i} value={i}>
                    {intentLabel(i)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Topic" htmlFor="pm-topic" optional>
              <Input id="pm-topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} maxLength={120} />
            </Field>
            <Field label="Priority" htmlFor="pm-pri">
              <Select id="pm-pri" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}>
                <option value={1}>High</option>
                <option value={2}>Normal</option>
                <option value={3}>Low</option>
              </Select>
            </Field>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
