// A fix guide turns one report problem into detailed, platform-specific work: what to change on which page,
// exact steps for the customer's platform, a prompt for an AI assistant, and how to check it worked.
import type { Platform } from "@/lib/platform/detect";
import type { ReportIssue } from "@/lib/report/types";
import type { ExtractedPage } from "@/lib/types";
import type { TaskCategory } from "@/lib/tasks/types";

export interface FixPage {
  url: string;
  /** What we found on this page (src/lib/report/page-notes.ts). */
  note: string | null;
  extracted: ExtractedPage | null;
}

export interface FixContext {
  brand: string;
  websiteUrl: string;
  platform: Platform;
  issue: ReportIssue;
  /** Affected pages with stored crawl data (may be empty for site-wide problems). */
  pages: FixPage[];
}

/** One line of the site-specific plan: this page, what it has now, what to change it to. */
export interface ChangeRow {
  page: string;
  now: string;
  change: string;
}

export interface FixGuide {
  /** One plain sentence: what this problem does to THIS website (use ctx numbers). */
  effect?: (ctx: FixContext) => string;
  /** Page-by-page plan with real values from the site. Omit when the fix is the same everywhere. */
  changes?: (ctx: FixContext) => ChangeRow[];
  /**
   * Detailed numbered steps per platform, in plain words with exact menu names / file paths.
   * `custom` is required and used for any platform without its own steps.
   */
  steps: Partial<Record<Platform, string[]>> & { custom: string[] };
  /** Technical detail added to the AI prompt for a platform (file names, APIs, plugins). */
  promptHints?: Partial<Record<Platform, string>>;
  /** How the owner checks the fix worked, in plain words. */
  verify: string[];
  /** Rough time for a non-technical owner, e.g. "30–60 minutes". */
  time: string;
  /** Task board category when added to the task list. */
  category: TaskCategory;
}
