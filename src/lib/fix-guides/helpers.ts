// Small helpers shared by fix guides: readable page names and suggested text built from the page itself.
import type { FixPage } from "./types";

export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** "/about-us" → "/about-us"; the home page → "Home page". */
export function pageName(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" && !u.search ? "Home page" : `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

export function isHome(url: string): boolean {
  try {
    return new URL(url).pathname === "/";
  } catch {
    return false;
  }
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** The page's topic: its main heading when it's specific, else the last part of the address ("fees-pricing" → "Fees Pricing"). */
export function topicOf(p: FixPage, brand: string): string {
  const h1 = p.extracted?.h1[0]?.trim();
  if (h1 && h1.length <= 60 && h1.toLowerCase() !== brand.toLowerCase()) return h1;
  try {
    const seg = new URL(p.url).pathname.split("/").filter(Boolean).pop();
    if (seg) return titleCase(decodeURIComponent(seg).replace(/[-_]+/g, " ").replace(/\.\w+$/, ""));
  } catch {
    /* fall through */
  }
  return h1 || brand;
}

/** Suggested Google headline, rule "Page topic | Brand", max 60 characters. */
export function suggestTitle(p: FixPage, brand: string): string {
  if (isHome(p.url)) {
    const h1 = p.extracted?.h1[0]?.trim();
    return clip(h1 && h1.toLowerCase() !== brand.toLowerCase() ? `${brand} – ${h1}` : `${brand} – what you offer and where`, 60);
  }
  const topic = topicOf(p, brand);
  const suffix = ` | ${brand}`;
  return `${clip(topic, Math.max(10, 60 - suffix.length))}${suffix}`;
}

/** A numbered list for prompts: "1. /about — Only 120 words". */
export function pageList(pages: FixPage[], max = 40): string {
  const lines = pages.slice(0, max).map((p, i) => `${i + 1}. ${p.url}${p.note ? ` — ${p.note}` : ""}`);
  if (pages.length > max) lines.push(`…and ${pages.length - max} more pages with the same problem.`);
  return lines.join("\n");
}
