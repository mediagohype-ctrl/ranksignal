// The app's 4 tabs (Developer Brief v1, section 5). Each tab answers one question and groups the pages that
// used to be separate menu items; the first page of a tab is where the tab opens.
import { Home, ListChecks, MessageCircleQuestion, TrendingUp } from "lucide-react";

export interface NavPage {
  /** Route segment under /app/projects/[id] ("" = the project home). */
  slug: string;
  label: string;
}

export interface NavTab {
  key: "home" | "todo" | "answers" | "progress";
  label: string;
  /** The question this tab answers, shown as a hint. */
  question: string;
  icon: typeof Home;
  pages: NavPage[];
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
    ],
  },
  {
    key: "todo",
    label: "To-do",
    question: "What do I fix?",
    icon: ListChecks,
    pages: [
      { slug: "audit", label: "Website problems" },
      { slug: "actions", label: "Fixes to approve" },
      { slug: "offsite", label: "Outside your website" },
      { slug: "work", label: "Task board" },
    ],
  },
  {
    key: "answers",
    label: "AI Answers",
    question: "What does AI say about me?",
    icon: MessageCircleQuestion,
    pages: [
      { slug: "visibility", label: "AI answers" },
      { slug: "prompts", label: "Customer questions" },
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
    ],
  },
];

/** Project pages that live outside the 4 tabs (setup things, reached from the sidebar footer / menu). */
export const PROJECT_SETUP_PAGES: NavPage[] = [
  { slug: "integrations", label: "Connect website" },
  { slug: "settings", label: "Project settings" },
];

export function tabForSection(section: string): NavTab | null {
  return APP_TABS.find((t) => t.pages.some((p) => p.slug === section)) ?? null;
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
