"use client";
// Admin back-office shell: left navigation, top bar with global search, support-mode indicator.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  Activity,
  Bot,
  Building2,
  FileText,
  Flag,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Search,
  ServerCog,
  ShieldAlert,
  UserRound,
  Users,
  Webhook,
  X,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Badge, Spinner } from "@/components/ui";
import { LogoLockup } from "@/components/brand/logo";

const NAV: { href: string; label: string; icon: LucideIcon; exact?: boolean }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/customers", label: "Customers", icon: Building2 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/leads", label: "Leads", icon: Inbox },
  { href: "/admin/revenue", label: "Revenue & plans", icon: IndianRupee },
  { href: "/admin/ai", label: "AI usage & costs", icon: Bot },
  { href: "/admin/jobs", label: "Jobs", icon: Activity },
  { href: "/admin/monthly-reports", label: "Monthly reports", icon: FileText },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/admin/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/admin/flags", label: "Feature flags", icon: Flag },
  { href: "/admin/system", label: "System", icon: ServerCog },
];

interface Hit {
  type: "org" | "user" | "project" | "lead";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}
const TYPE_LABEL: Record<Hit["type"], string> = { org: "Customer", user: "User", project: "Project", lead: "Lead" };

function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { items?: Hit[] };
        setHits(data.items ?? []);
        setActive(-1);
        setOpen(true);
      } catch {
        /* aborted or offline */
      } finally {
        setBusy(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-xl">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && hits[active]) go(hits[active].href);
          else if (q.trim().length >= 2) go(`/admin/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <label htmlFor="admin-search" className="sr-only">
          Search customers, users, projects and leads
        </label>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          id="admin-search"
          type="search"
          autoComplete="off"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(hits.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search name, email, domain or id…"
          role="combobox"
          aria-expanded={open}
          aria-controls="admin-search-results"
          aria-activedescendant={active >= 0 ? `admin-hit-${active}` : undefined}
          className="h-10 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-9 text-small text-fg placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        {busy && <Spinner size={14} className="absolute right-3 top-1/2 -translate-y-1/2" />}
      </form>
      {open && q.trim().length >= 2 && (
        <ul
          id="admin-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-12 z-50 max-h-[70vh] overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg"
        >
          {hits.length === 0 && !busy && <li className="px-3 py-2 text-small text-muted">No matches</li>}
          {hits.map((h, i) => (
            <li key={`${h.type}-${h.id}`} id={`admin-hit-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(h.href)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
                  i === active ? "bg-primary-soft" : "hover:bg-surface-2",
                )}
              >
                <Badge size="sm" tone={h.type === "org" ? "primary" : h.type === "user" ? "info" : h.type === "lead" ? "accent" : "neutral"}>
                  {TYPE_LABEL[h.type]}
                </Badge>
                <span className="min-w-0">
                  <span className="block truncate text-small font-medium text-fg">{h.title}</span>
                  <span className="block truncate text-xs text-muted">{h.subtitle}</span>
                </span>
              </button>
            </li>
          ))}
          {hits.length > 0 && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(`/admin/search?q=${encodeURIComponent(q.trim())}`)}
                className="w-full rounded-lg px-3 py-2 text-left text-small font-medium text-primary hover:bg-surface-2"
              >
                See all results for “{q.trim()}”
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function ExitSupport({ orgName }: { orgName: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-1.5 text-xs text-fg">
      <span>
        Support mode in <strong>{orgName}</strong>
      </span>
      <Link href="/app" className="font-semibold text-primary hover:underline">
        Open
      </Link>
      <button
        type="button"
        disabled={busy}
        className="inline-flex items-center gap-1 font-semibold text-danger hover:underline disabled:opacity-60"
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/admin/exit-support", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
            if (res.ok) window.location.assign("/admin");
          } finally {
            setBusy(false);
          }
        }}
      >
        <LogOut aria-hidden className="size-3.5" /> Exit
      </button>
    </div>
  );
}

export function AdminShell({
  staffEmail,
  staffName,
  supportOrgName,
  children,
}: {
  staffEmail: string;
  staffName: string | null;
  supportOrgName: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const nav = (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-4">
        <Link href="/admin" className="flex items-center gap-2 rounded-lg" aria-label="Admin overview">
          <LogoLockup size="sm" />
          <Badge tone="danger" size="sm" icon={<ShieldAlert />}>
            Staff
          </Badge>
        </Link>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 lg:hidden">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-small font-medium transition-colors",
                  active ? "bg-primary-soft text-primary-soft-fg" : "text-fg-soft hover:bg-surface-2 hover:text-fg",
                )}
              >
                {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />}
                <Icon size={17} aria-hidden className={clsx(active ? "text-primary" : "text-muted group-hover:text-fg")} />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <Avatar name={staffName ?? staffEmail} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-small font-medium text-fg">{staffName ?? "Staff"}</div>
            <div className="truncate text-xs text-muted">{staffEmail}</div>
          </div>
        </div>
        <Link href="/app" className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-small text-fg-soft hover:bg-surface-2 hover:text-fg">
          <UserRound size={16} aria-hidden className="text-muted" /> Back to app
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-bg">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-surface lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-overlay" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-fade-in border-r border-border bg-surface shadow-xl">{nav}</aside>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
              className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
            >
              <Menu className="size-5" aria-hidden />
            </button>
            <GlobalSearch />
            <div className="ml-auto hidden md:block">{supportOrgName && <ExitSupport orgName={supportOrgName} />}</div>
          </div>
          {supportOrgName && (
            <div className="border-t border-border px-4 py-2 md:hidden">
              <ExitSupport orgName={supportOrgName} />
            </div>
          )}
        </header>
        <main id="admin-main" className="mx-auto w-full max-w-[96rem] px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
