/**
 * Pages that moved for good (308, wired up in next.config.ts). Old links, bookmarks and Google results keep working.
 * Keep a row here for as long as the old address may still be linked from anywhere.
 */
export const PERMANENT_REDIRECTS: { source: string; destination: string }[] = [
  // 15 Nov 2026: the done-for-you service page got the name customers use.
  { source: "/services", destination: "/done-for-you" },
  // The AI visibility checker was the same check as the free website check.
  { source: "/tools/ai-mention-checker", destination: "/free-check" },
  // Tools renamed to the words people search for.
  { source: "/tools/ai-guide-file-maker", destination: "/tools/llms-txt-generator" },
  { source: "/tools/faq-markup-maker", destination: "/tools/faq-schema-generator" },
];

const MOVED = new Map(PERMANENT_REDIRECTS.map((r) => [r.source, r.destination]));

/**
 * An internal path with moved pages swapped for their new address ("/services?x#y" → "/done-for-you?x#y"), so links
 * written before a move (e.g. in blog posts) point straight at the live page instead of through a redirect.
 */
export function currentPath(path: string): string {
  const m = /^([^?#]*)(.*)$/.exec(path);
  const [pathname, rest] = m ? [m[1], m[2]] : [path, ""];
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const dest = MOVED.get(trimmed);
  return dest ? dest + rest : path;
}
