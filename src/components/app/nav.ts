// The app's main tabs (Developer Brief v1, section 5). Each tab answers one question and groups the pages that
// used to be separate menu items; the first page of a tab is where the tab opens.
import { Home, ListChecks, MessageCircleQuestion, Search, TrendingUp } from "lucide-react";

export interface NavPage {
  /** Route segment under /app/projects/[id] ("" = the project home). */
  slug: string;
  label: string;
}

export interface NavTab {
  key: "home" | "todo" | "answers" | "google" | "progress";
  label: string;
  /** The question this tab answers, shown as a hint. */
  question: string;
  icon: typeof Home;
  pages: NavPage[];
  /** Old route segments that now redirect into this tab (kept so the tab stays highlighted meanwhile). */
  aliases?: string[];
}

export const APP_TABS: NavTab[] = [
  {
    key: "home",
    label: "Home",
    question: "How am I doing? What next?",
    icon: Home,
    pages: [
      { slug: "", label: "Home" },
      { slug: "report", label: "Full report" },
      { slug: "business-profile", label: "Business profile" },
    ],
  },
  {
    key: "todo",
    label: "To-do",
    question: "What do I fix?",
    icon: ListChecks,
    // One list replaces Website problems, Fixes to approve, Outside your website and the Task board. The old
    // routes redirect into it (see legacyTodoTarget in src/lib/tasks/todo.ts).
    pages: [
      { slug: "todo", label: "To-do" },
      { slug: "links", label: "Internal links" },
    ],
    aliases: ["audit", "actions", "offsite", "work"],
  },
  {
    key: "answers",
    label: "AI Answers",
    question: "What does AI say about me?",
    icon: MessageCircleQuestion,
    pages: [
      { slug: "visibility", label: "AI answers" },
      { slug: "prompts", label: "Customer questions" },
      { slug: "ai-bots", label: "AI crawler visits" },
    ],
  },
  {
    key: "google",
    label: "Google",
    question: "Where do I rank? Who's ahead?",
    icon: Search,
    // Keywords (from the owner's own Google Search Console) always works. The other pages use paid Google data
    // (DataForSEO: src/lib/dataforseo) and are left out of the menu until that is switched on — see buildMenu.
    pages: [
      { slug: "keywords", label: "Keywords" },
      { slug: "rankings", label: "Rankings" },
      { slug: "research", label: "Keyword research" },
      { slug: "competitors", label: "Competitors" },
      { slug: "backlinks", label: "Backlinks" },
    ],
  },
  {
    key: "progress",
    label: "Progress",
    question: "Is it working?",
    icon: TrendingUp,
    pages: [
      { slug: "reports", label: "Score history" },
      { slug: "monthly", label: "Monthly reports" },
      { slug: "monthly/builder", label: "Report builder" },
    ],
  },
];

/** Project pages that live outside the 4 tabs (setup things, reached from the sidebar footer / menu). */
export const PROJECT_SETUP_PAGES: NavPage[] = [
  { slug: "integrations", label: "Connect website" },
  { slug: "alerts", label: "Alerts" },
  { slug: "indexnow", label: "IndexNow" },
  { slug: "settings", label: "Settings" },
];

// ---------------------------------------------------------------------------------------------
// What the menu shows. ONE pure function of the offer, what is switched on, Expert mode and the number of
// websites, so the sidebar, the page tabs and the mobile bar always agree (and it can be tested).

export interface MenuInput {
  /** Do it for me / Custom: our team changes the website (canConnectWebsite in src/lib/billing/offer.ts). */
  canConnect: boolean;
  /** Paid Google data is switched on (dfsConfigured). */
  googleData: boolean;
  /** Backlink data is switched on (backlinksEnabled). */
  backlinks: boolean;
  /** Google Business Profile monitoring is switched on (isPlacesConfigured). */
  businessProfile: boolean;
  /** The signed-in person's Expert mode. */
  expert: boolean;
  /** Websites in the account. */
  websiteCount: number;
  /** MyWebRank staff in support mode see every page. */
  staff?: boolean;
}

export interface MenuLink {
  key: "websites" | "portfolio" | "prospect" | "settings" | "api" | "indexnow";
  label: string;
  /** Account pages have a fixed address… */
  href?: string;
  /** …website pages have a route segment under /app/projects/[id]. */
  slug?: string;
  /** Highlight only on the exact address (not on pages under it). */
  exact?: boolean;
}

export interface AppMenu {
  tabs: NavTab[];
  /** The "Setup" group (pages of the current website). */
  setup: NavPage[];
  /** The "Advanced" group: only with Expert mode on. Empty = no group. */
  advanced: MenuLink[];
  /** The "Account" group. */
  account: MenuLink[];
}

/** What the menu shows before the server has told us anything: the smallest menu. */
export const DEFAULT_MENU_INPUT: MenuInput = {
  canConnect: false,
  googleData: false,
  backlinks: false,
  businessProfile: false,
  expert: false,
  websiteCount: 1,
};

/** Pages that are left out of the menu right now (their addresses still open and explain themselves). */
export function hiddenPageSlugs(input: MenuInput): Set<string> {
  const hidden = new Set<string>();
  if (input.staff) return hidden;
  if (!input.googleData) for (const s of ["rankings", "research", "competitors"]) hidden.add(s);
  if (!input.backlinks) hidden.add("backlinks");
  if (!input.businessProfile) hidden.add("business-profile");
  return hidden;
}

export function buildMenu(input: MenuInput): AppMenu {
  const hidden = hiddenPageSlugs(input);
  const all = input.staff === true;
  const tabs = APP_TABS.map((t) => ({ ...t, pages: t.pages.filter((p) => !hidden.has(p.slug)) })).filter((t) => t.pages.length > 0);

  // Do it myself has no website connections: the owner makes each change by hand (owner decision 1).
  const canConnect = all || input.canConnect;
  const expert = all || input.expert;
  const setup: NavPage[] = [
    ...(canConnect ? [{ slug: "integrations", label: "Connect website" }] : []),
    { slug: "alerts", label: "Alerts" },
    { slug: "settings", label: "Settings" },
  ];
  const advanced: MenuLink[] = expert
    ? [
        // IndexNow needs a key file uploaded to the website: only where our team works on the website.
        ...(canConnect ? [{ key: "indexnow" as const, label: "IndexNow", slug: "indexnow" }] : []),
        { key: "api" as const, label: "API keys", href: "/app/settings/api" },
      ]
    : [];
  const account: MenuLink[] = [
    { key: "websites", label: "All websites", href: "/app", exact: true },
    ...(all || input.websiteCount >= 2 ? [{ key: "portfolio" as const, label: "Portfolio", href: "/app/portfolio" }] : []),
    { key: "prospect", label: "Prospect report", href: "/app/prospect" },
    { key: "settings", label: "Settings & billing", href: "/app/settings", exact: true },
  ];
  return { tabs, setup, advanced, account };
}

/** The red number on the notification bell: the unread count, capped so it always fits ("99+"). */
export function unreadBadgeText(unread: number): string {
  const n = Number.isFinite(unread) ? Math.max(0, Math.floor(unread)) : 0;
  return n > 99 ? "99+" : String(n);
}

/** Where the "Getting started guide" links go (the public guide; /app/help shows the same help options). */
export const HELP_GUIDE_HREF = "/docs";
/** Where every "Upgrade" button goes: the plan cards on the Billing tab (anchor id "plans"; owned by billing). */
export { UPGRADE_HREF } from "@/lib/billing/links";

/**
 * One line under the Expert mode switch: exactly what it shows today (kept next to buildMenu so they can't drift).
 * Expert mode changes: the Advanced menu (buildMenu), every score part on Score history, the check picker and
 * technical tables on AI answers, "Download as text" on the Full report, and Markets + technical fix names in
 * Settings. It does not change Home.
 */
export function expertModeHelp(canConnect: boolean): string {
  return `Adds an Advanced menu (${canConnect ? "IndexNow and API keys" : "API keys"}), every score part on Score history, the detailed tables on AI answers, a text download of the Full report and Markets in Settings.`;
}

export function tabForSection(section: string): NavTab | null {
  return APP_TABS.find((t) => t.pages.some((p) => p.slug === section) || t.aliases?.includes(section)) ?? null;
}

/** A To-do item's fix screen (one problem, one button). */
export function todoItemHref(projectId: string, itemId: string) {
  return `/app/projects/${projectId}/todo/${encodeURIComponent(itemId)}`;
}

/** Step-by-step help for a To-do item; under /todo so the menu stays on To-do while fixing. */
export function todoHelpHref(projectId: string, itemId: string) {
  return `${todoItemHref(projectId, itemId)}/help`;
}

export function projectHref(projectId: string, slug: string) {
  return `/app/projects/${projectId}${slug ? `/${slug}` : ""}`;
}

/** A single problem's own page (opened from Home, the report and the To-do lists). */
export function issueHref(projectId: string, issueId: string) {
  return `/app/projects/${projectId}/report/issues/${encodeURIComponent(issueId)}`;
}

/** One page of a problem: what we found there, and how to fix it on that page. */
export function issuePageHref(projectId: string, issueId: string, pageUrl: string) {
  return `${issueHref(projectId, issueId)}/pages?url=${encodeURIComponent(pageUrl)}`;
}

/** One customer question on its own page: every AI tool's answer, who they named instead, sources and how to get named. */
export function questionHref(projectId: string, promptId: string, runId?: string | null) {
  return `/app/projects/${projectId}/visibility/questions/${encodeURIComponent(promptId)}${runId ? `?run=${encodeURIComponent(runId)}` : ""}`;
}
