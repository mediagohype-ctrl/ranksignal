"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  CalendarCheck,
  ChevronsUpDown,
  Eye,
  FileBarChart2,
  FolderKanban,
  Globe2,
  History,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessageSquareText,
  Plug,
  Plus,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Avatar } from "@/components/ui";
import { LogoLockup } from "@/components/brand/logo";

interface ProjectLite {
  id: string;
  name: string;
  websiteUrl: string;
}

const NAV = [
  { slug: "report", label: "Report", icon: FileBarChart2 },
  { slug: "", label: "Overview", icon: LayoutDashboard },
  { slug: "visibility", label: "AI Visibility", icon: Eye },
  { slug: "prompts", label: "Prompts", icon: MessageSquareText },
  { slug: "audit", label: "Audit", icon: ListChecks },
  { slug: "actions", label: "Actions & Approvals", icon: ShieldCheck },
  { slug: "work", label: "Work", icon: KanbanSquare },
  { slug: "offsite", label: "Off-site", icon: Globe2 },
  { slug: "monthly", label: "Monthly reports", icon: CalendarCheck },
  { slug: "integrations", label: "Integrations", icon: Plug },
  { slug: "reports", label: "History & print", icon: History },
  { slug: "settings", label: "Settings", icon: SlidersHorizontal },
];

const LAST_PROJECT_KEY = "app.lastProjectId";

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function NavLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ size?: number; "aria-hidden"?: boolean; className?: string }>;
  children: React.ReactNode;
}) {
  return (
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
      <span className="truncate">{children}</span>
    </Link>
  );
}

export function AppSidebar({ projects }: { projects: ProjectLite[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [remembered, setRemembered] = useState<string | null>(null);

  const match = pathname.match(/^\/app\/projects\/([^/]+)(?:\/([^/]+))?/);
  const routeProjectId = match?.[1] ?? null;
  const section = match?.[2] ?? "";

  useEffect(() => {
    try {
      if (routeProjectId) localStorage.setItem(LAST_PROJECT_KEY, routeProjectId);
      else setRemembered(localStorage.getItem(LAST_PROJECT_KEY));
    } catch {
      /* storage unavailable */
    }
  }, [routeProjectId]);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const current =
    projects.find((p) => p.id === routeProjectId) ?? projects.find((p) => p.id === remembered) ?? projects[0] ?? null;

  const nav = (
    <nav aria-label="Primary" className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-4">
        <Link href="/app" className="flex items-center rounded-lg" aria-label={`${BRAND.name} projects`}>
          <LogoLockup size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
          className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg lg:hidden"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div className="space-y-2 px-1">
          <label htmlFor="project-switcher" className="text-caption uppercase tracking-[0.06em] text-muted">
            Project
          </label>
          {projects.length > 0 && current ? (
            <div className="relative flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 p-2 pr-8 transition-colors focus-within:border-primary hover:border-border-strong">
              <Avatar name={current.name} size="sm" className="ring-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-small font-semibold text-fg">{current.name}</div>
                <div className="truncate text-xs text-muted">{hostOf(current.websiteUrl)}</div>
              </div>
              <ChevronsUpDown size={15} aria-hidden className="pointer-events-none absolute right-2.5 text-muted" />
              <select
                id="project-switcher"
                value={current.id}
                onChange={(e) => {
                  if (e.target.value === "__new") router.push("/app/onboarding");
                  else router.push(`/app/projects/${e.target.value}${section ? `/${section}` : ""}`);
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({hostOf(p.websiteUrl)})
                  </option>
                ))}
                <option value="__new">+ New project…</option>
              </select>
            </div>
          ) : (
            <Link
              href="/app/onboarding"
              className="flex h-11 items-center gap-2 rounded-xl border border-dashed border-border-strong px-3 text-small font-medium text-fg-soft hover:bg-surface-2 hover:text-fg"
            >
              <Plus size={15} aria-hidden /> Create your first project
            </Link>
          )}
        </div>

        {current && (
          <div>
            <div className="mb-1.5 px-3 text-caption uppercase tracking-[0.06em] text-muted">Workspace</div>
            <ul className="space-y-0.5">
              {NAV.map((item) => {
                const href = `/app/projects/${current.id}${item.slug ? `/${item.slug}` : ""}`;
                const active = routeProjectId === current.id && section === item.slug;
                return (
                  <li key={item.slug || "overview"}>
                    <NavLink href={href} active={active} icon={item.icon}>
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-0.5 border-t border-border px-3 py-3">
        <NavLink href="/app" active={pathname === "/app"} icon={FolderKanban}>
          All projects
        </NavLink>
        <NavLink href="/app/settings" active={pathname.startsWith("/app/settings")} icon={Settings}>
          Settings & billing
        </NavLink>
      </div>
    </nav>
  );

  return (
    <>
      <button
        type="button"
        className="no-print fixed left-3 top-3 z-40 rounded-lg border border-border bg-surface p-2 text-fg shadow-xs hover:bg-surface-2 lg:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="app-sidebar"
        onClick={() => setOpen(true)}
      >
        <Menu size={18} aria-hidden />
      </button>
      {open && (
        <div className="fixed inset-0 z-40 bg-overlay animate-fade-in lg:hidden" aria-hidden onClick={() => setOpen(false)} />
      )}
      <aside
        id="app-sidebar"
        className={clsx(
          "no-print fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shrink-0 border-r border-border bg-surface shadow-xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-64 lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {nav}
      </aside>
    </>
  );
}
