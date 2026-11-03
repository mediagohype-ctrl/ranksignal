"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { APP_TABS, projectHref, tabForSection } from "@/components/app/nav";

function useProjectRoute() {
  const pathname = usePathname();
  const match = pathname.match(/^\/app\/projects\/([^/]+)(?:\/([^/]+))?/);
  return { projectId: match?.[1] ?? null, section: match?.[2] ?? "" };
}

/** Mobile bottom bar with the same 4 tabs as the sidebar (hidden on desktop). */
export function MobileTabBar() {
  const { projectId, section } = useProjectRoute();
  if (!projectId) return null;
  const activeKey = tabForSection(section)?.key;
  return (
    <nav
      aria-label="Main tabs"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {APP_TABS.map((tab) => {
          const active = tab.key === activeKey;
          const Icon = tab.icon;
          return (
            <li key={tab.key}>
              <Link
                href={projectHref(projectId, tab.pages[0].slug)}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
                  active ? "text-primary" : "text-muted hover:text-fg",
                )}
              >
                <Icon size={20} aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Links between the pages inside the current tab, e.g. To-do: Website problems · Fixes to approve · … */
export function SectionTabs() {
  const { projectId, section } = useProjectRoute();
  const tab = tabForSection(section);
  if (!projectId || !tab || tab.pages.length < 2) return null;
  return (
    <nav aria-label={`${tab.label} pages`} className="no-print -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1.5">
        {tab.pages.map((p) => {
          const active = p.slug === section;
          return (
            <li key={p.slug || "home"}>
              <Link
                href={projectHref(projectId, p.slug)}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "inline-flex h-9 items-center whitespace-nowrap rounded-full border px-3.5 text-small font-medium transition-colors",
                  active
                    ? "border-primary bg-primary-soft text-primary-soft-fg"
                    : "border-border bg-surface text-fg-soft hover:border-border-strong hover:text-fg",
                )}
              >
                {p.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
