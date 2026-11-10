// English ↔ Hindi page pairs for the marketing site: one map drives hreflang (page metadata + sitemap),
// the header/footer language switcher and the tests. Plain data, safe to import from client and server code.

/** English path → its Hindi counterpart. Add a pair here when a new Hindi page ships. */
export const HINDI_PAIRS = {
  "/": "/hi",
  "/pricing": "/hi/pricing",
  "/services": "/hi/services",
  "/free-check": "/hi/free-check",
  "/about": "/hi/about",
  "/contact": "/hi/contact",
} as const;

export type EnglishPairedPath = keyof typeof HINDI_PAIRS;
export type HindiPath = (typeof HINDI_PAIRS)[EnglishPairedPath];

export const HINDI_PATHS = Object.values(HINDI_PAIRS) as HindiPath[];

const EN_BY_HI: Record<string, string> = Object.fromEntries(Object.entries(HINDI_PAIRS).map(([en, hi]) => [hi, en]));

/** True for "/hi" and anything under "/hi/". */
export function isHindiPath(pathname: string): boolean {
  return pathname === "/hi" || pathname.startsWith("/hi/");
}

/** The English page a Hindi page translates, or undefined. */
export function englishFor(path: string): string | undefined {
  return EN_BY_HI[path];
}

/** The Hindi page for an English page, or undefined. */
export function hindiFor(path: string): string | undefined {
  return (HINDI_PAIRS as Record<string, string>)[path];
}

/**
 * hreflang map (language → site-relative path) for either side of a pair, or undefined for unpaired pages.
 * Both sides return the same map, so the annotations are reciprocal; x-default is the English page.
 */
export function hreflangFor(path: string): Record<string, string> | undefined {
  const en = englishFor(path) ?? (hindiFor(path) ? path : undefined);
  if (!en) return undefined;
  const hi = hindiFor(en)!;
  return { "en-IN": en, "hi-IN": hi, "x-default": en };
}

/**
 * Where the language switcher points from `pathname`: the counterpart page when one exists, otherwise the other
 * language's home page (so Hindi stays discoverable from every English page).
 */
export function switchTarget(pathname: string): { href: string; lang: "hi" | "en"; label: string } {
  if (isHindiPath(pathname)) return { href: englishFor(pathname) ?? "/", lang: "en", label: "English" };
  return { href: hindiFor(pathname) ?? "/hi", lang: "hi", label: "हिन्दी" };
}
