"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellOff, CreditCard, LogOut, Settings, Users } from "lucide-react";
import clsx from "clsx";
import { api, errorMessage } from "@/lib/dashboard/client";
import { fmtRelative } from "@/lib/dashboard/format";
import { Avatar, Meter, Skeleton, Spinner, useToast } from "@/components/ui";

/* ------------------------------------------------------------- shared popover hook */

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const POPOVER =
  "z-50 overflow-hidden rounded-xl border border-border bg-surface shadow-lg animate-pop-in";

/* ------------------------------------------------------------- usage meter */

interface UsageItem {
  period: string;
  used: number;
  reserved: number;
  limit: number;
  percentUsed?: number;
}

export function UsageMeter() {
  const [usage, setUsage] = useState<UsageItem | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ item: UsageItem }>("/api/usage")
        .then((r) => {
          if (!alive) return;
          setUsage(r.item);
          setFailed(false);
        })
        .catch(() => alive && setFailed(true));
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  if (failed) return null;
  if (!usage)
    return (
      <div className="hidden w-40 flex-col gap-1.5 md:flex" aria-hidden>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-1.5 w-full" rounded="full" />
      </div>
    );
  const left = Math.max(0, usage.limit - usage.used - usage.reserved);
  return (
    <Link
      href="/app/settings?tab=billing"
      className="hidden w-44 flex-col gap-1.5 rounded-lg px-2 py-1 hover:bg-surface-2 md:flex"
      title={`${usage.used.toLocaleString()} used + ${usage.reserved.toLocaleString()} reserved of ${usage.limit.toLocaleString()} credits (${usage.period})`}
    >
      <span className="flex items-baseline justify-between text-xs">
        <span className="text-muted">Credits</span>
        <span className="tabular-nums font-medium text-fg">
          {left.toLocaleString()} <span className="font-normal text-muted">left</span>
        </span>
      </span>
      <Meter value={usage.used + usage.reserved} max={Math.max(usage.limit, 1)} label="Monthly credit usage" size="xs" />
    </Link>
  );
}

/* ------------------------------------------------------------- notifications */

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsBell() {
  const { open, setOpen, ref } = usePopover();
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const r = await api<{ items: NotificationRow[]; unreadCount?: number }>("/api/notifications");
      setItems(r.items);
      setUnread(r.unreadCount ?? r.items.filter((n) => !n.readAt).length);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function markAll() {
    try {
      await api("/api/notifications/mark-read", { body: { all: true } });
      await load();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }
  async function markOne(id: string) {
    try {
      await api("/api/notifications/mark-read", { body: { ids: [id] } });
      load();
    } catch {
      /* non-critical */
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
        className={clsx(
          "relative flex size-10 items-center justify-center rounded-lg text-fg-soft hover:bg-surface-2 hover:text-fg",
          open && "bg-surface-2 text-fg",
        )}
      >
        <Bell size={18} aria-hidden />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-danger-fg ring-2 ring-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className={clsx(POPOVER, "fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96")}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-small font-semibold text-fg">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-xs font-medium text-primary hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <ul className="max-h-[26rem] overflow-y-auto">
            {error && <li className="px-4 py-3 text-small text-danger">{error}</li>}
            {!error && items === null && (
              <li className="space-y-3 px-4 py-4" aria-label="Loading notifications">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </li>
            )}
            {items?.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-muted">
                  <BellOff size={18} aria-hidden />
                </span>
                <span className="text-small font-medium text-fg">You&apos;re all caught up</span>
                <span className="text-xs text-muted">We&apos;ll let you know when a scan finishes or a fix needs your OK.</span>
              </li>
            )}
            {items?.map((n) => {
              const content = (
                <div className="flex gap-3">
                  <span
                    aria-hidden
                    className={clsx("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className={clsx("text-small text-fg", !n.readAt && "font-semibold")}>{n.title}</span>
                      <span className="shrink-0 text-xs text-muted">{fmtRelative(n.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.body}</p>
                  </div>
                </div>
              );
              const cls = "block w-full px-4 py-3 text-left hover:bg-surface-2";
              return (
                <li key={n.id} className="border-b border-border last:border-0">
                  {n.link ? (
                    <Link
                      href={n.link}
                      className={cls}
                      onClick={() => {
                        if (!n.readAt) markOne(n.id);
                        setOpen(false);
                      }}
                    >
                      {content}
                      {!n.readAt && <span className="sr-only"> (unread)</span>}
                    </Link>
                  ) : (
                    <button type="button" className={cls} onClick={() => !n.readAt && markOne(n.id)}>
                      {content}
                      {!n.readAt && <span className="sr-only"> (unread)</span>}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- user menu */

function useLogout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const logout = async () => {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* cookie may already be gone */
    }
    router.replace("/login");
    router.refresh();
  };
  return { busy, logout };
}

export function UserMenu({
  name,
  email,
  role,
  orgName,
}: {
  name: string | null;
  email: string;
  role: string;
  orgName: string;
}) {
  const { open, setOpen, ref } = usePopover();
  const { busy, logout } = useLogout();
  const display = name || email;
  const itemCls =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-small text-fg-soft hover:bg-surface-2 hover:text-fg [&_svg]:text-muted";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Account menu for ${display}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className={clsx("flex items-center gap-2.5 rounded-full p-1 hover:bg-surface-2 lg:rounded-lg lg:pr-3", open && "bg-surface-2")}
      >
        <Avatar name={display} size="sm" />
        <span className="hidden min-w-0 text-left leading-tight lg:block">
          <span className="block max-w-36 truncate text-small font-medium text-fg">{display}</span>
          <span className="block text-xs capitalize text-muted">{role}</span>
        </span>
      </button>
      {open && (
        <div role="menu" aria-label="Account" className={clsx(POPOVER, "absolute right-0 top-12 w-64")}>
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Avatar name={display} size="md" />
            <div className="min-w-0">
              <div className="truncate text-small font-semibold text-fg">{display}</div>
              {name && <div className="truncate text-xs text-muted">{email}</div>}
              <div className="truncate text-xs text-muted">
                <span className="capitalize">{role}</span> · {orgName}
              </div>
            </div>
          </div>
          <div className="p-1.5">
            <Link role="menuitem" href="/app/settings" className={itemCls} onClick={() => setOpen(false)}>
              <Settings size={16} aria-hidden /> Workspace settings
            </Link>
            <Link role="menuitem" href="/app/settings?tab=members" className={itemCls} onClick={() => setOpen(false)}>
              <Users size={16} aria-hidden /> Team members
            </Link>
            <Link role="menuitem" href="/app/settings?tab=billing" className={itemCls} onClick={() => setOpen(false)}>
              <CreditCard size={16} aria-hidden /> Billing & usage
            </Link>
          </div>
          <div className="border-t border-border p-1.5">
            <button
              role="menuitem"
              type="button"
              onClick={logout}
              disabled={busy}
              className={clsx(itemCls, "disabled:opacity-60")}
            >
              {busy ? <Spinner size={16} /> : <LogOut size={16} aria-hidden />} {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Stand-alone sign-out icon button (kept for compatibility). */
export function LogoutButton() {
  const { busy, logout } = useLogout();
  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      aria-label="Sign out"
      className="flex size-10 items-center justify-center rounded-lg text-fg-soft hover:bg-surface-2 hover:text-fg disabled:opacity-50"
    >
      {busy ? <Spinner size={18} /> : <LogOut size={18} aria-hidden />}
    </button>
  );
}
