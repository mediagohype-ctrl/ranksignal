"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Eye, PenLine, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import type { TaskRecheck } from "@/lib/tasks/types";
import { recheckLine, todoHref } from "@/lib/tasks/todo";
import { todoItemHref } from "@/components/app/nav";
import { DiffView } from "@/components/app/diff-view";
import { roleLabel } from "@/components/app/role-label";
import { Button, Textarea, useToast } from "@/components/ui";

/** Which single button the screen shows (Developer Brief v1, fix screen). */
export type FixMode =
  /** Website connected and a drafted change exists: approve + put it live. */
  | "auto"
  /** A drafted page plan exists: approve it. */
  | "approve"
  /** Content that needs writing and nothing is drafted yet. */
  | "write"
  /** Not connected: copy the new text, do it yourself, then say so. */
  | "manual";

export interface FixScreenProps {
  projectId: string;
  itemId: string;
  mode: FixMode;
  /** Before → After box (null when the fix isn't a text change). */
  diff: { field: string; before: string | null; after: string } | null;
  /** The drafted change behind "auto" / "approve". */
  action: { id: string; status: string; draftHash: string; policyDecision: string } | null;
  /** True when this is the last drafted change for the problem (so approving it finishes the item). */
  lastAction: boolean;
  /** A draft is being written right now (after "Write it for me"). */
  writing: boolean;
  /** The page to look at again after "I've done it". */
  recheckUrl: string | null;
  /** Problems can be re-checked one page at a time; other items can't. */
  canRecheck: boolean;
  canEdit: boolean;
  canPublish: boolean;
  done: boolean;
  recheck: TaskRecheck | null;
  /** Fallback when there's no next fix. */
  nextHref: string | null;
}

type Outcome = { tone: "success" | "info"; text: string } | null;

export function FixScreen(p: FixScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(p.done ? recheckLine(p.recheck) : null);
  const [editing, setEditing] = useState(false);
  const [after, setAfter] = useState(p.diff?.after ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const goNext = (nextId: string | null, delayMs: number) => {
    const href = nextId ? todoItemHref(p.projectId, nextId) : (p.nextHref ?? todoHref(p.projectId));
    timer.current = setTimeout(() => router.push(href), delayMs);
  };

  async function setState(state: "done" | "started" | "skipped" | "dismissed", o: { recheck?: boolean } = {}) {
    return api<{ item: { recheck: TaskRecheck | null; nextId: string | null } }>(`/api/projects/${p.projectId}/tasks/todo`, {
      body: { itemId: p.itemId, state, ...(p.recheckUrl ? { url: p.recheckUrl } : {}), ...(o.recheck === false ? { recheck: false } : {}) },
    });
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(null);
    }
  }

  const fixForMe = () =>
    run("primary", async () => {
      const a = p.action!;
      if (a.status === "awaiting_approval") await api(`/api/actions/${a.id}/approve`, { body: { draftHash: a.draftHash } });
      if (!p.canPublish) {
        setOutcome({ tone: "info", text: `Approved. The account ${roleLabel("owner").toLowerCase()} can now put it live.` });
        const r = await setState("started", { recheck: false });
        goNext(r.item.nextId, 2500);
        return;
      }
      await api(`/api/actions/${a.id}/execute`, { body: {} });
      const r = await setState(p.lastAction ? "done" : "started", { recheck: false });
      setOutcome({ tone: "success", text: "We're putting it live now and will check the page when it's done." });
      // More pages to fix for this problem: stay here and show the next one.
      if (p.lastAction) goNext(r.item.nextId, 2200);
      else timer.current = setTimeout(() => {
        setOutcome(null);
        router.refresh();
      }, 2200);
    });

  const approvePlan = () =>
    run("primary", async () => {
      const a = p.action!;
      if (a.status === "awaiting_approval") await api(`/api/actions/${a.id}/approve`, { body: { draftHash: a.draftHash } });
      const r = await setState("started", { recheck: false });
      setOutcome({ tone: "success", text: "Approved. It stays on your list until the page is written." });
      goNext(r.item.nextId, 2000);
    });

  const writeForMe = () =>
    run("primary", async () => {
      await api(`/api/projects/${p.projectId}/analyze`, { body: {} });
      toast("Writing your draft. This takes about a minute.", "success");
      router.refresh();
    });

  const done = () =>
    run("primary", async () => {
      const r = await setState("done");
      const line = recheckLine(r.item.recheck) ?? { tone: "success" as const, text: "Marked as done." };
      setOutcome(line);
      goNext(r.item.nextId, line.tone === "success" ? 1800 : 3500);
    });

  const leave = (state: "skipped" | "dismissed") =>
    run(state, async () => {
      const r = await setState(state, { recheck: false });
      toast(state === "skipped" ? "Skipped. You can put it back from your to-do list." : "Okay, we've taken it off your list.", "success");
      goNext(r.item.nextId, 0);
    });

  const checkAgain = () =>
    run("recheck", async () => {
      const r = await api<{ item: TaskRecheck | null }>(`/api/projects/${p.projectId}/tasks/recheck`, {
        body: { issueId: p.itemId, ...(p.recheckUrl ? { url: p.recheckUrl } : {}) },
      });
      setOutcome(recheckLine(r.item));
    });

  async function copy() {
    try {
      await navigator.clipboard.writeText(after);
      toast("Copied. Paste it on your website, then come back.", "success");
    } catch {
      toast("Couldn't copy automatically — select the text and copy it instead.", "warning");
    }
  }

  const saveEdit = () =>
    run("edit", async () => {
      if (p.action && (p.mode === "auto" || p.mode === "approve")) {
        await api(`/api/actions/${p.action.id}`, { method: "PATCH", body: { after } });
        toast("Saved. Check the new text, then approve it.", "success");
        router.refresh();
      }
      setEditing(false);
    });

  const disabled = !p.canEdit || !!busy || (!!outcome && !p.done);
  const primary = (() => {
    if (p.done) {
      return (
        <Button size="lg" onClick={() => router.push(p.nextHref ?? todoHref(p.projectId))} className="w-full sm:w-auto">
          Next fix
        </Button>
      );
    }
    if (p.mode === "auto")
      return (
        <Button size="lg" icon={<Wand2 />} onClick={fixForMe} loading={busy === "primary"} disabled={disabled} className="w-full sm:w-auto">
          Fix it for me
        </Button>
      );
    if (p.mode === "approve")
      return (
        <Button size="lg" icon={<CheckCircle2 />} onClick={approvePlan} loading={busy === "primary"} disabled={disabled} className="w-full sm:w-auto">
          Approve
        </Button>
      );
    if (p.mode === "write")
      return (
        <Button size="lg" icon={<Sparkles />} onClick={writeForMe} loading={busy === "primary" || p.writing} disabled={disabled || p.writing} className="w-full sm:w-auto">
          {p.writing ? "Writing…" : "Write it for me"}
        </Button>
      );
    return (
      <Button size="lg" icon={<CheckCircle2 />} onClick={done} loading={busy === "primary"} disabled={disabled} className="w-full sm:w-auto">
        I&apos;ve done it
      </Button>
    );
  })();

  const editable = !!p.diff && !p.done && (p.mode === "manual" || ((p.mode === "auto" || p.mode === "approve") && p.canEdit));

  return (
    <div className="space-y-5">
      {p.diff &&
        (editing ? (
          <div className="space-y-2">
            <label htmlFor="fix-after" className="text-caption uppercase tracking-[0.06em] text-muted">
              Your new text
            </label>
            <Textarea id="fix-after" value={after} onChange={(e) => setAfter(e.target.value)} rows={5} />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit} loading={busy === "edit"} disabled={!after.trim()}>
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setAfter(p.diff!.after);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <DiffView field={p.diff.field} before={p.diff.before} after={after} />
        ))}

      {outcome && (
        <p
          role="status"
          className={
            outcome.tone === "success"
              ? "flex items-start gap-2 rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-small font-medium text-success"
              : "flex items-start gap-2 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-small font-medium text-info"
          }
        >
          {outcome.tone === "success" ? <CheckCircle2 size={18} aria-hidden className="shrink-0" /> : <Eye size={18} aria-hidden className="shrink-0" />}
          {outcome.text}
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {p.mode === "manual" && p.diff && !p.done && (
          <Button size="lg" variant="secondary" icon={<Copy />} onClick={copy} className="w-full sm:w-auto">
            Copy
          </Button>
        )}
        {primary}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-small font-medium">
        {editable && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-primary hover:underline">
            <PenLine size={14} aria-hidden /> Edit
          </button>
        )}
        {p.done && p.canRecheck && p.canEdit && (
          <button type="button" onClick={checkAgain} disabled={!!busy} className="inline-flex items-center gap-1.5 text-primary hover:underline disabled:opacity-50">
            <RefreshCw size={14} aria-hidden className={busy === "recheck" ? "animate-spin" : undefined} /> Check again
          </button>
        )}
        {!p.done && p.canEdit && (
          <>
            <button type="button" onClick={() => leave("skipped")} disabled={!!busy} className="text-muted hover:text-fg disabled:opacity-50">
              Skip
            </button>
            <button type="button" onClick={() => leave("dismissed")} disabled={!!busy} className="text-muted hover:text-fg disabled:opacity-50">
              Not for me
            </button>
          </>
        )}
        {!p.canEdit && <span className="text-muted">Your role ({roleLabel("viewer")}) can see fixes but not change them.</span>}
      </div>
    </div>
  );
}

/** "Put back" for a skipped / not-for-me item on the To-do list. */
export function PutBackButton({ projectId, itemId, label }: { projectId: string; itemId: string; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="xs"
      variant="ghost"
      loading={busy}
      aria-label={`Put back: ${label}`}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/projects/${projectId}/tasks/todo`, { body: { itemId, state: "open", recheck: false } });
          router.refresh();
        } catch (e) {
          toast(errorMessage(e), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      Put back
    </Button>
  );
}
