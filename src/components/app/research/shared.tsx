"use client";
// Small pieces shared by the keyword research and Google top 10 panels: JSON fetch with friendly errors, allowance
// meter, 12-month sparkline, recent searches list and the "Track this keyword" button (POSTs to the rank tracker).
import { useState } from "react";
import { Check, Clock, Plus } from "lucide-react";
import { Button, Meter } from "@/components/ui";
import { DFS_LOCATIONS } from "@/lib/dataforseo/locations";

export interface Allowance {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
}
export interface RecentSearch {
  id: string;
  query: string;
  locationId: string;
  languageId: string;
  device: string | null;
  mode: string | null;
  resultCount: number;
  createdAt: string;
}
export interface Overview {
  configured: boolean;
  allowance: Allowance;
  recent: RecentSearch[];
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly allowance?: Allowance) {
    super(message);
  }
}

/** fetch → JSON; throws ApiError with the server's plain-English message (handles both error shapes). */
export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { cache: "no-store", ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  } catch {
    throw new ApiError("We couldn't reach the server. Check your internet connection and try again.", 0);
  }
  const j = await r.json().catch(() => null);
  if (!r.ok) {
    const msg =
      (typeof j?.message === "string" && j.message) ||
      (typeof j?.error?.message === "string" && j.error.message) ||
      "Something went wrong. Please try again.";
    throw new ApiError(msg, r.status, j?.allowance);
  }
  return j as T;
}

export const locationLabel = (id: string) => DFS_LOCATIONS.find((l) => l.id === id)?.label ?? id;
export const fmtNum = (v: number | null | undefined) => (v == null ? "–" : v.toLocaleString("en-IN"));
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function AllowanceMeter({ allowance, what }: { allowance: Allowance; what: string }) {
  const resets = new Date(allowance.resetsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "UTC" });
  if (allowance.limit === 0) return <p className="text-small text-muted">{what} aren&apos;t included in your plan.</p>;
  return (
    <div className="min-w-48 space-y-1">
      <Meter value={allowance.used} max={allowance.limit} label={`${what} used this month`} />
      <p className="text-xs text-muted">
        {fmtNum(allowance.used)} of {fmtNum(allowance.limit)} {what.toLowerCase()} used this month · resets {resets}. Repeat searches are free.
      </p>
    </div>
  );
}

/** 12-month trend as a tiny line. Purely visual; the numbers are in the title for screen readers / hover. */
export function Sparkline({ points, width = 84, height = 24 }: { points: { month: string; volume: number }[]; width?: number; height?: number }) {
  if (points.length < 2) return <span className="text-xs text-muted">–</span>;
  const max = Math.max(...points.map((p) => p.volume), 1);
  const step = width / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(height - 2 - (p.volume / max) * (height - 4)).toFixed(1)}`).join(" ");
  const first = points[0].volume;
  const last = points[points.length - 1].volume;
  const label = `Monthly searches ${points[0].month} to ${points[points.length - 1].month}: ${points.map((p) => p.volume.toLocaleString("en-IN")).join(", ")}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="overflow-visible">
      <title>{label}</title>
      <path d={d} fill="none" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" className={last >= first ? "stroke-success" : "stroke-danger"} />
    </svg>
  );
}

export function RecentSearches({
  items, onOpen, describe, activeId,
}: {
  items: RecentSearch[];
  onOpen: (s: RecentSearch) => void;
  describe: (s: RecentSearch) => string;
  activeId?: string | null;
}) {
  if (!items.length) return <p className="text-small text-muted">Your searches will appear here. Opening a past search is free.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onOpen(s)}
            aria-current={activeId === s.id || undefined}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-fg-soft hover:border-border-strong aria-[current]:border-primary aria-[current]:text-fg"
            title={`${describe(s)} · ${fmtDateTime(s.createdAt)}`}
          >
            <Clock aria-hidden size={12} />
            <span className="truncate font-medium">{s.query}</span>
            <span className="text-muted">· {describe(s)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** "Track this keyword": adds it to the rank tracker (POST /api/projects/[id]/rankings, owned by the rank tracker). */
export function TrackButton({ projectId, keyword, locationId, canEdit }: { projectId: string; keyword: string; locationId: string; canEdit: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  if (!canEdit) return null;
  async function track() {
    setState("busy");
    setMsg(null);
    try {
      const r = await apiJson<{ added?: unknown; skipped?: unknown; limit?: unknown }>(`/api/projects/${projectId}/rankings`, {
        method: "POST",
        body: JSON.stringify({ keywords: [keyword], locationId, device: "mobile" }),
      });
      const added = typeof r.added === "number" ? r.added > 0 : Array.isArray(r.added) ? r.added.length > 0 : true;
      setState("done");
      setMsg(added ? "Tracking" : "Already tracked");
    } catch (e) {
      setState("error");
      setMsg(e instanceof ApiError && e.status === 404 ? "Rank tracking isn't available yet." : (e as Error).message);
    }
  }
  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <Check aria-hidden size={13} /> {msg}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <Button size="xs" variant="ghost" icon={<Plus />} loading={state === "busy"} onClick={track} aria-label={`Track “${keyword}” in rank tracker`}>
        Track
      </Button>
      {state === "error" && msg && (
        <span role="alert" className="max-w-40 text-right text-xs text-danger">
          {msg}
        </span>
      )}
    </span>
  );
}
