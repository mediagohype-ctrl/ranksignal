// Small helpers used only by the SEO guides.
import type { FixContext, FixPage } from "../../types";

/** "1 page" / "3 pages". */
export const count = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

/** Number of affected pages: what the report counted, or the pages we have data for. */
export const affected = (ctx: FixContext) => Math.max(ctx.issue.affectedCount, ctx.pages.length);

/** The page's own address without "#…", used as its main version. */
export function ownAddress(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

/** Last part of an image address: "https://x/img/team-photo.jpg?w=800" → "team-photo.jpg". */
export function fileName(src: string): string {
  try {
    return decodeURIComponent(new URL(src, "https://x.invalid").pathname.split("/").filter(Boolean).pop() ?? src);
  } catch {
    return src;
  }
}

/** Images on a page with no description at all (same rule as the check: alt missing, not empty). */
export const imagesWithoutDescription = (p: FixPage) => p.extracted?.images.filter((i) => i.alt === null) ?? [];

/** Path of an address for comparing links ("https://a.com/x/" → "/x"). */
export function pathKey(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname.replace(/\/+$/, "") || "/") + u.search;
  } catch {
    return url;
  }
}
