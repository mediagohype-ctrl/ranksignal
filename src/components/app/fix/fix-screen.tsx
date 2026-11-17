"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Eye, PartyPopper, PenLine, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { api, errorMessage } from "@/lib/dashboard/client";
import type { TaskRecheck } from "@/lib/tasks/types";
import { notSeenDetail, recheckLine, todoHref } from "@/lib/tasks/todo";
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
  /** The fix's real "+N points" estimate (0 = not tied to the score). */
  points?: number;
}

/** "seen" = confirmed live (small celebration); "notSeen" = we looked and couldn't see it yet. */
type Outcome = { tone: "success" | "info"; text: string; kind?: "seen" | "notSeen"; detail?: string } | null;

export function FixScreen(p: FixScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const points = p.points ?? 0;
  const [outcome, setOutcome] = useState<Outcome>(p.done ? recheckLine(p.recheck, points) : null);
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

  // "I've done it": we look at the page (or file) first. Seen → done (+points). Not seen → stays on the list with
  // "Check again" / "Mark done anyway". Can't be checked by reading the site → done, confirmed at the next check.
  const done = (key = "primary") =>
    run(key, async () => {
      const r = await setState("done");
      const fixed = r.item.recheck?.fixed;
      if (fixed === false) {
        setOutcome({ tone: "info", kind: "notSeen", text: "We couldn't see the change yet.", detail: notSeenDetail(r.item.recheck) });
        return;
      }
      const line = recheckLine(r.item.recheck, points) ?? { tone: "info" as const, text: "Marked done — we'll confirm at your next website check." };
      setOutcome(fixed === true ? { ...line, kind: "seen" } : line);
      goNext(r.item.nextId, fixed === true ? 2600 : 3000);
    });

  const markDoneAnyway = () =>
    run("anyway", async () => {
      const r = await setState("done", { recheck: false });
      setOutcome({ tone: "info", text: "Marked done — we'll confirm at your next website check." });
      goNext(r.item.nextId, 2500);
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
      const line = recheckLine(r.item, points);
      setOutcome(r.item?.fixed === false ? { tone: "info", kind: "notSeen", text: "We couldn't see the change yet.", detail: notSeenDetail(r.item) } : line && r.item?.fixed === true ? { ...line, kind: "seen" } : line);
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

  const notSeen = outcome?.kind === "notSeen";
  const disabled = !p.canEdit || !!busy || (!!outcome && !p.done && !notSeen);
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
    if (notSeen)
      return (
        <>
          <Button size="lg" icon={<RefreshCw />} onClick={() => done()} loading={busy === "primary"} disabled={disabled} className="w-full sm:w-auto">
            Check again
          </Button>
          <Button size="lg" variant="secondary" onClick={markDoneAnyway} loading={busy === "anyway"} disabled={disabled} className="w-full sm:w-auto">
            Mark done anyway
          </Button>
        </>
      );
    return (
      <Button size="lg" icon={<CheckCircle2 />} onClick={() => done()} loading={busy === "primary"} disabled={disabled} className="w-full sm:w-auto">
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
          {outcome.kind === "seen" ? (
            <PartyPopper size={18} aria-hidden className="shrink-0 motion-safe:animate-bounce" />
          ) : outcome.tone === "success" ? (
            <CheckCircle2 size={18} aria-hidden className="shrink-0" />
          ) : (
            <Eye size={18} aria-hidden className="shrink-0" />
          )}
          <span>
            {outcome.kind === "seen" ? "✓ " : ""}
            {outcome.text}
            {outcome.detail && <span className="mt-1 block font-normal text-fg-soft">{outcome.detail}</span>}
          </span>
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
