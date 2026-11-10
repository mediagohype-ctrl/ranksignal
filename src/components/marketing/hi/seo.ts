// Structured data helpers for the Hindi pages: WebPage in hi-IN that points at the English original.
import { webPageLd, siteUrl } from "@/lib/seo/schema";
import { englishFor } from "./pairs";

const abs = (base: string, path: string) => (path === "/" ? `${base}/` : `${base}${path}`);

/** webPageLd() for a /hi page: inLanguage "hi-IN" and translationOfWork → the English page's WebPage. */
export function hiWebPageLd(
  path: string,
  opts: { type?: string; name?: string; extra?: Record<string, unknown>; base?: string } = {},
): Record<string, unknown> {
  const base = opts.base ?? siteUrl();
  const en = englishFor(path);
  return webPageLd(path, {
    ...opts,
    base,
    extra: {
      inLanguage: "hi-IN",
      ...(en ? { translationOfWork: { "@id": `${abs(base, en)}#webpage` } } : {}),
      ...opts.extra,
    },
  });
}
