// Fix guides: report problem + the customer's platform → detailed steps, a page-by-page plan and an AI prompt.
// Add a guide by writing src/lib/fix-guides/guides/<name>.ts (see titles.ts) and registering its check id below.
import { CODE_PLATFORMS, PLATFORM_LABEL } from "@/lib/platform/detect";
import { checkIdOfIssue } from "@/lib/report/page-notes";
import type { ChangeRow, FixContext, FixGuide } from "./types";
import { pageList } from "./helpers";
import { titlesGuide } from "./guides/titles";
import { GOOGLE_GUIDES } from "./guides/google";
import { AI_GUIDES } from "./guides/ai";
import { jsSiteGuide } from "./guides/js-site";

export type { ChangeRow, FixContext, FixGuide, FixPage } from "./types";

/** Check id → guide. Problems without a guide get a fallback built from the report's own fix steps. */
export const GUIDES: Record<string, FixGuide> = {
  ...GOOGLE_GUIDES,
  ...AI_GUIDES,
  "seo.titles": titlesGuide,
  "seo.js_rendering": jsSiteGuide,
};

export interface ResolvedFix {
  effect: string;
  changes: ChangeRow[];
  steps: string[];
  verify: string[];
  time: string;
  category: FixGuide["category"];
  prompt: string;
  /** True when the steps were written for this platform (not the generic fallback). */
  platformSpecific: boolean;
}

const EFFORT_TIME = { quick: "About 15 minutes", moderate: "About 1 hour", involved: "Half a day or more" } as const;

function fallbackGuide(ctx: FixContext): FixGuide {
  return {
    steps: { custom: ctx.issue.howToFix },
    verify: ["Make the change on every page in the list.", "Click \"Check website\" on Home. This problem should disappear from your list."],
    time: EFFORT_TIME[ctx.issue.effort],
    category: ctx.issue.pillar === "seo" ? "technical" : "content",
  };
}

export function guideFor(issueId: string): FixGuide | null {
  const id = checkIdOfIssue(issueId);
  return id ? (GUIDES[id] ?? null) : null;
}

export function resolveFix(ctx: FixContext): ResolvedFix {
  const guide = guideFor(ctx.issue.id) ?? fallbackGuide(ctx);
  const brand = (s: string) => s.split("<Brand>").join(ctx.brand);
  const own = guide.steps[ctx.platform];
  const resolved = {
    effect: guide.effect?.(ctx) ?? ctx.issue.whyItMatters,
    changes: guide.changes?.(ctx) ?? [],
    steps: (own ?? guide.steps.custom).map(brand),
    verify: guide.verify.map(brand),
    time: guide.time,
    category: guide.category,
    platformSpecific: !!own,
  };
  return { ...resolved, prompt: buildPrompt(ctx, guide, resolved.changes) };
}

/** A prompt the owner pastes into an AI assistant: a coding assistant for code sites, ChatGPT-style help otherwise. */
export function buildPrompt(ctx: FixContext, guide: FixGuide, changes: ChangeRow[]): string {
  const { issue, platform } = ctx;
  const label = PLATFORM_LABEL[platform];
  const code = CODE_PLATFORMS.includes(platform);
  const L: string[] = [];
  L.push(
    code
      ? `You are working in the codebase of my website ${ctx.websiteUrl} (business: ${ctx.brand}), built with ${label}.`
      : `I run the website ${ctx.websiteUrl} for my business "${ctx.brand}". It is built with ${label}. I am not technical.`,
    "",
    `PROBLEM: ${issue.title}`,
    issue.whatsWrong,
    "",
    `WHY IT MATTERS: ${issue.whyItMatters}`,
  );
  if (ctx.pages.length) L.push("", "PAGES AFFECTED (and what was found on each):", pageList(ctx.pages));
  if (changes.length) {
    L.push("", "SUGGESTED CHANGE PER PAGE (improve the wording if you can, keep the same rules):");
    for (const c of changes.slice(0, 40)) L.push(`- ${c.page}: now "${c.now}" → "${c.change}"`);
  }
  const hint = guide.promptHints?.[platform] ?? (code ? guide.promptHints?.custom : undefined);
  if (hint) L.push("", `TECHNICAL NOTES: ${hint}`);
  L.push("", "WHAT TO DO:");
  if (code) {
    L.push(
      "1. Find where this is set in the code for each affected page.",
      "2. Make the fix for every affected page (and the shared layout/template if that's the cause), following the notes above.",
      "3. Don't change anything unrelated. Keep the existing code style.",
      "4. Show me the changes file by file, then tell me how to check the fix in the browser (view source) after deploying.",
    );
  } else {
    L.push(
      `1. For each affected page, write the exact new text I should use (as a table I can copy from).`,
      `2. Then give me click-by-click steps for ${label} to put it in place, in simple words.`,
      "3. Tell me how to check that it worked.",
    );
  }
  return L.join("\n");
}
