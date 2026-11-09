// Target keywords for our own site (SeoKeyword) — validation, starter list and page coverage.
import { z } from "zod";

export const KEYWORD_PILLARS = ["seo", "aeo", "geo"] as const;
export const KEYWORD_INTENTS = ["informational", "commercial", "transactional", "navigational"] as const;

export const keywordInputSchema = z.object({
  phrase: z.string().trim().toLowerCase().min(2).max(120),
  pillar: z.enum(KEYWORD_PILLARS).default("seo"),
  intent: z.enum(KEYWORD_INTENTS).default("informational"),
  targetPath: z
    .string()
    .trim()
    .max(300)
    .regex(/^\/[^\s]*$/, "Use a path on our site, starting with /")
    .nullable()
    .optional(),
  priority: z.number().int().min(1).max(3).default(2),
  googlePosition: z.number().int().min(1).max(100).nullable().optional(),
  aiMentioned: z.boolean().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});
export const keywordPatchSchema = keywordInputSchema.partial();

/** Phrases worth owning on day one, mapped to the page built for each. */
export const STARTER_KEYWORDS: z.input<typeof keywordInputSchema>[] = [
  { phrase: "seo company in india", intent: "commercial", targetPath: "/services", priority: 1 },
  { phrase: "seo services india", intent: "commercial", targetPath: "/services", priority: 1 },
  { phrase: "aeo geo seo agency", intent: "commercial", targetPath: "/services", priority: 1, pillar: "geo" },
  { phrase: "website seo checker", intent: "transactional", targetPath: "/free-check", priority: 1 },
  { phrase: "free seo report", intent: "transactional", targetPath: "/free-check", priority: 1 },
  { phrase: "website seo audit checklist", targetPath: "/learn/website-seo-audit-checklist", priority: 2 },
  { phrase: "what is aeo", targetPath: "/learn/what-is-aeo", priority: 1, pillar: "aeo" },
  { phrase: "what is geo", targetPath: "/learn/what-is-geo", priority: 1, pillar: "geo" },
  { phrase: "seo vs aeo vs geo", targetPath: "/learn/seo-vs-aeo-vs-geo", priority: 2 },
  { phrase: "how to rank in chatgpt", targetPath: "/learn/how-to-get-mentioned-by-chatgpt", priority: 1, pillar: "geo" },
  { phrase: "ai visibility checker", intent: "transactional", targetPath: "/tools/ai-mention-checker", priority: 2, pillar: "geo" },
  { phrase: "llms.txt generator", intent: "transactional", targetPath: "/tools/ai-guide-file-maker", priority: 2, pillar: "geo" },
  { phrase: "faq schema generator", intent: "transactional", targetPath: "/tools/faq-markup-maker", priority: 2, pillar: "aeo" },
  { phrase: "how to choose an seo company", targetPath: "/learn/how-to-choose-an-seo-company", priority: 2 },
  { phrase: "best seo tool for small business india", intent: "commercial", targetPath: null, priority: 2 },
  { phrase: "seo audit cost in india", intent: "commercial", targetPath: null, priority: 2 },
];

/** Whether a keyword has a live page: a known static route or a published blog post. */
export function hasLivePage(targetPath: string | null | undefined, livePaths: ReadonlySet<string>): boolean {
  if (!targetPath) return false;
  const path = targetPath.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  return livePaths.has(path);
}
